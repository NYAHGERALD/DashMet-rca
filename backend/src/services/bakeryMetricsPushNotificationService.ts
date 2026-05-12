import bakeryMetricsService from './bakeryMetricsService';
import { getOrgUsersForBakeryReport } from './bakeryReportEmailService';
import { sendPushNotificationToUser } from './pushNotificationService';
import { prisma } from '../utils/prisma';

type BakeryPushOptions = {
  organizationId: string;
  submissionId: string;
  submittedBy: string;
  weekName: string;
  dayOfWeek: string;
};

type BakeryPushRecipient = {
  id: string;
  email: string;
  firstName: string | null;
};

type BakeryPreference = {
  userId: string;
  mobilePushEnabled: boolean;
  mobileSoundEnabled: boolean;
  bakeryMobilePushEnabled: boolean;
  bakerySubmissionPushEnabled: boolean;
  bakeryOeeBelowTargetPushEnabled: boolean;
};

type PushTotals = {
  successCount: number;
  failureCount: number;
  recipientCount: number;
};

const fmtPercent = (value: unknown, decimals = 1) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? `${numberValue.toFixed(decimals)}%` : '-';
};

const formatWeek = (weekName: string) => weekName.replace('_', ' - ');

const getFirstName = (user: Pick<BakeryPushRecipient, 'email' | 'firstName'>) =>
  user.firstName?.trim() || user.email.split('@')[0] || 'there';

const isEnabled = (
  preference: BakeryPreference | undefined,
  eventField: 'bakerySubmissionPushEnabled' | 'bakeryOeeBelowTargetPushEnabled',
) => {
  if (!preference) return true;
  return Boolean(
    preference.mobilePushEnabled &&
      preference.bakeryMobilePushEnabled &&
      preference[eventField],
  );
};

const getSound = (preference?: Pick<BakeryPreference, 'mobileSoundEnabled'>) =>
  preference?.mobileSoundEnabled === false ? null : 'default';

const compact = (value: string, maxLength = 170) => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}...` : cleaned;
};

const buildSubmissionSummary = (record: any) =>
  compact(
    `Both shifts ${record.day_of_week}: OEE DC1 ${fmtPercent(record.both_shift_die_cut1_oee)}, DC2 ${fmtPercent(record.both_shift_die_cut2_oee)}, Total ${fmtPercent(record.total_oee)}; Waste DC1 ${fmtPercent(record.both_shift_die_cut1_waste_pct)}, DC2 ${fmtPercent(record.both_shift_die_cut2_waste_pct)}, Total ${fmtPercent(record.total_waste_percent)}. Tap to review.`,
    178,
  );

const buildRecommendation = (lineLabels: string[]) => {
  const lineText = lineLabels.length === 1 ? lineLabels[0] : 'affected lines';
  return `Review downtime, setup checks, material flow, and maintenance notes for ${lineText}.`;
};

const buildBelowTargetEvents = (record: any, targets: any) => {
  const events: Array<{
    shiftKey: 'first' | 'second';
    shiftLabel: string;
    details: string[];
    lineLabels: string[];
  }> = [];

  const shiftDefinitions = [
    {
      shiftKey: 'first' as const,
      shiftLabel: 'First Shift',
      hasShift: Boolean(record.has_first_shift),
      fields: [
        { label: 'Die Cut 1', field: 'first_shift_die_cut1_oee', target: Number(targets.oee.die_cut_1 || 0) },
        { label: 'Die Cut 2', field: 'first_shift_die_cut2_oee', target: Number(targets.oee.die_cut_2 || 0) },
        { label: 'Total', field: 'first_shift_oee', target: Number(targets.oee.total || 0) },
      ],
    },
    {
      shiftKey: 'second' as const,
      shiftLabel: 'Second Shift',
      hasShift: Boolean(record.has_second_shift),
      fields: [
        { label: 'Die Cut 1', field: 'second_shift_die_cut1_oee', target: Number(targets.oee.die_cut_1 || 0) },
        { label: 'Die Cut 2', field: 'second_shift_die_cut2_oee', target: Number(targets.oee.die_cut_2 || 0) },
        { label: 'Total', field: 'second_shift_oee', target: Number(targets.oee.total || 0) },
      ],
    },
  ];

  for (const shift of shiftDefinitions) {
    if (!shift.hasShift) continue;

    const belowTarget = shift.fields.filter((item) => {
      const value = Number(record[item.field]);
      return Number.isFinite(value) && item.target > 0 && value < item.target;
    });

    if (!belowTarget.length) continue;

    events.push({
      shiftKey: shift.shiftKey,
      shiftLabel: shift.shiftLabel,
      details: belowTarget.map((item) => `${item.label} ${fmtPercent(record[item.field])} vs ${fmtPercent(item.target)}`),
      lineLabels: belowTarget.filter((item) => item.label !== 'Total').map((item) => item.label),
    });
  }

  return events;
};

const sendToRecipients = async (
  recipients: BakeryPushRecipient[],
  preferences: Map<string, BakeryPreference>,
  buildPayload: (recipient: BakeryPushRecipient, preference?: BakeryPreference) => Parameters<typeof sendPushNotificationToUser>[1],
): Promise<PushTotals> => {
  const results = await Promise.allSettled(
    recipients.map((recipient) => sendPushNotificationToUser(recipient.id, buildPayload(recipient, preferences.get(recipient.id)))),
  );

  return results.reduce(
    (totals, result) => {
      if (result.status === 'fulfilled') {
        totals.successCount += result.value.successCount;
        totals.failureCount += result.value.failureCount;
      } else {
        totals.failureCount += 1;
        console.error('[BakeryPush] Failed to send bakery push:', result.reason);
      }
      return totals;
    },
    { successCount: 0, failureCount: 0, recipientCount: recipients.length },
  );
};

export async function notifyBakeryMetricsPushSubscribers(options: BakeryPushOptions) {
  try {
    const [record, targets, orgUsers] = await Promise.all([
      bakeryMetricsService.getRecordById(options.submissionId),
      bakeryMetricsService.getKpiTargets(),
      getOrgUsersForBakeryReport(options.organizationId),
    ]);

    if (!record || orgUsers.length === 0) {
      return { submitted: { successCount: 0, failureCount: 0, recipientCount: 0 }, oeeBelowTarget: [] };
    }

    const userIds = orgUsers.map((user) => user.id);
    const userPrefs = await prisma.lswNotificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        mobilePushEnabled: true,
        mobileSoundEnabled: true,
        bakeryMobilePushEnabled: true,
        bakerySubmissionPushEnabled: true,
        bakeryOeeBelowTargetPushEnabled: true,
      },
    });
    const preferences = new Map(userPrefs.map((pref) => [pref.userId, pref]));

    const submissionRecipients = orgUsers.filter((user) =>
      isEnabled(preferences.get(user.id), 'bakerySubmissionPushEnabled'),
    );
    const submitted = await sendToRecipients(submissionRecipients, preferences, (recipient, preference) => ({
      title: 'Bakery metrics submitted',
      body: `Hi, ${getFirstName(recipient)}. ${buildSubmissionSummary(record)}`,
      sound: getSound(preference),
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: {
        type: 'BAKERY_METRICS_SUBMITTED',
        screen: 'bakery-metrics',
        submissionId: options.submissionId,
        weekName: options.weekName,
        weekLabel: formatWeek(options.weekName),
        dayOfWeek: options.dayOfWeek,
        channelId: 'dashmet_alerts',
      },
    }));

    const belowTargetEvents = buildBelowTargetEvents(record, targets);
    const belowTargetRecipients = orgUsers.filter((user) =>
      isEnabled(preferences.get(user.id), 'bakeryOeeBelowTargetPushEnabled'),
    );

    const oeeBelowTarget = await Promise.all(
      belowTargetEvents.map((event) =>
        sendToRecipients(belowTargetRecipients, preferences, (_recipient, preference) => ({
          title: `OEE below target - ${event.shiftLabel}`,
          body: compact(
            `${options.dayOfWeek} ${event.shiftLabel}: ${event.details.join('; ')}. ${buildRecommendation(event.lineLabels)}`,
            178,
          ),
          sound: getSound(preference),
          interruptionLevel: 'time-sensitive',
          ttl: 3600,
          data: {
            type: 'BAKERY_OEE_BELOW_TARGET',
            screen: 'bakery-metrics',
            submissionId: options.submissionId,
            weekName: options.weekName,
            weekLabel: formatWeek(options.weekName),
            dayOfWeek: options.dayOfWeek,
            shift: event.shiftKey,
            channelId: 'dashmet_alerts',
          },
        })),
      ),
    );

    return { submitted, oeeBelowTarget };
  } catch (error) {
    console.error('[BakeryPush] Notification fan-out failed:', error);
    return {
      submitted: { successCount: 0, failureCount: 1, recipientCount: 0 },
      oeeBelowTarget: [],
    };
  }
}

import type { UserRole } from '@prisma/client';
import { hasPrivilege } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { sendPushNotificationToUser } from './pushNotificationService';

type IssuePushEvent = 'created' | 'status' | 'edited' | 'deleted';

type IssuePushActor = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type IssuePushPayload = {
  id: string;
  issueNumber: string;
  title: string;
  type?: string | null;
  priority?: string | null;
  status?: string | null;
  organizationId?: string | null;
  Department?: { name: string } | null;
  Area?: { name: string } | null;
  Line?: { name: string; lineNumber?: string | null } | null;
};

type IssuePushOptions = {
  event: IssuePushEvent;
  issue: IssuePushPayload;
  actor: IssuePushActor;
  previousStatus?: string | null;
};

const EVENT_TO_PREFERENCE_FIELD: Record<IssuePushEvent, string> = {
  created: 'issueCreatedPushEnabled',
  status: 'issueStatusPushEnabled',
  edited: 'issueEditedPushEnabled',
  deleted: 'issueDeletedPushEnabled',
};

const EVENT_TO_PUSH_TYPE: Record<IssuePushEvent, string> = {
  created: 'ISSUE_REPORTED',
  status: 'ISSUE_STATUS_CHANGED',
  edited: 'ISSUE_EDITED',
  deleted: 'ISSUE_DELETED',
};

const getPersonName = (person?: IssuePushActor | null) => {
  const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return fullName || person?.email?.split('@')[0] || 'A DashMet user';
};

const getFirstName = (person?: Pick<IssuePushActor, 'firstName' | 'email'> | null) =>
  person?.firstName?.trim() || person?.email?.split('@')[0] || 'there';

const formatStatus = (status?: string | null) =>
  String(status || 'updated')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const compact = (value: string, maxLength = 86) => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}...` : cleaned;
};

const getIssueLocation = (issue: IssuePushPayload) => {
  const location = [
    issue.Department?.name,
    issue.Area?.name,
    issue.Line?.lineNumber ? `${issue.Line.name} ${issue.Line.lineNumber}` : issue.Line?.name,
  ].filter(Boolean);

  return location.length ? ` (${location.join(' / ')})` : '';
};

const buildMessage = (
  recipient: { firstName: string | null; email: string },
  options: IssuePushOptions,
) => {
  const firstName = getFirstName(recipient);
  const actorName = getPersonName(options.actor);
  const issueLabel = `${options.issue.issueNumber}: ${compact(options.issue.title, 58)}`;
  const location = getIssueLocation(options.issue);

  switch (options.event) {
    case 'created':
      return {
        title: 'DashMet issue reported',
        body: `Hi, ${firstName}. ${actorName} reported ${issueLabel}${location}. Tap to review Issue Reporting.`,
      };
    case 'status':
      return {
        title: 'DashMet issue status changed',
        body: `Hi, ${firstName}. ${actorName} moved ${issueLabel} from ${formatStatus(options.previousStatus)} to ${formatStatus(options.issue.status)}. Tap to review Issue Reporting.`,
      };
    case 'edited':
      return {
        title: 'DashMet issue updated',
        body: `Hi, ${firstName}. ${actorName} updated ${issueLabel}. Tap to review Issue Reporting.`,
      };
    case 'deleted':
      return {
        title: 'DashMet issue deleted',
        body: `Hi, ${firstName}. ${actorName} deleted ${issueLabel}. Tap to review Issue Reporting.`,
      };
  }
};

async function getIssuePushRecipients(event: IssuePushEvent, organizationId?: string | null) {
  if (!organizationId) return [];

  const eventField = EVENT_TO_PREFERENCE_FIELD[event];
  const preferenceWhere = {
    mobilePushEnabled: true,
    issueMobilePushEnabled: true,
    [eventField]: true,
  };

  const candidates = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      LswNotificationPreference: { is: preferenceWhere as any },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
    },
  });

  const allowed = await Promise.all(
    candidates.map(async (user) => {
      const hasOperationsAccess = await hasPrivilege(
        user.organizationId!,
        user.role as UserRole,
        'nav.operations',
        user.id,
      );

      return hasOperationsAccess ? user : null;
    }),
  );

  return allowed.filter((user): user is NonNullable<(typeof allowed)[number]> => Boolean(user));
}

export async function notifyIssuePushSubscribers(options: IssuePushOptions) {
  try {
    const recipients = await getIssuePushRecipients(options.event, options.issue.organizationId);
    if (!recipients.length) {
      return { successCount: 0, failureCount: 0, recipientCount: 0 };
    }

    const results = await Promise.allSettled(
      recipients.map((recipient) => {
        const message = buildMessage(recipient, options);
        return sendPushNotificationToUser(recipient.id, {
          title: message.title,
          body: message.body,
          sound: 'default',
          interruptionLevel: 'time-sensitive',
          ttl: 3600,
          data: {
            type: EVENT_TO_PUSH_TYPE[options.event],
            screen: 'report-issue',
            issueId: options.event === 'deleted' ? '' : options.issue.id,
            issueNumber: options.issue.issueNumber,
            issueEvent: options.event,
            channelId: 'dashmet_alerts',
          },
        });
      }),
    );

    return results.reduce(
      (totals, result) => {
        if (result.status === 'fulfilled') {
          totals.successCount += result.value.successCount;
          totals.failureCount += result.value.failureCount;
        } else {
          totals.failureCount += 1;
          console.error('[IssuePush] Failed to send issue push:', result.reason);
        }
        return totals;
      },
      { successCount: 0, failureCount: 0, recipientCount: recipients.length },
    );
  } catch (error) {
    console.error('[IssuePush] Notification fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

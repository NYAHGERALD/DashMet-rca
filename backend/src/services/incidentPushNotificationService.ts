import type { UserRole } from '@prisma/client';
import { hasPrivilege } from '../middleware/rbac';
import { prisma } from '../utils/prisma';
import { sendPushNotificationToUser } from './pushNotificationService';

type PushActor = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type EventPreference =
  | 'incidentCreatedPushEnabled'
  | 'incidentTeamInvitePushEnabled'
  | 'capaBoardCreatedPushEnabled';

type MasterPreference = 'incidentMobilePushEnabled' | 'capaMobilePushEnabled';

type PushUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string | null;
};

type Preference = {
  userId: string;
  mobilePushEnabled: boolean;
  mobileSoundEnabled: boolean;
  incidentMobilePushEnabled: boolean;
  incidentCreatedPushEnabled: boolean;
  incidentTeamInvitePushEnabled: boolean;
  capaMobilePushEnabled: boolean;
  capaBoardCreatedPushEnabled: boolean;
};

type PushTotals = {
  successCount: number;
  failureCount: number;
  recipientCount: number;
};

const compact = (value: string, maxLength = 170) => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}...` : cleaned;
};

const formatEnum = (value?: string | null) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getPersonName = (person?: PushActor | null) => {
  const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return fullName || person?.email?.split('@')[0] || 'A DashMet user';
};

const getFirstName = (user: Pick<PushUser, 'email' | 'firstName'>) =>
  user.firstName?.trim() || user.email.split('@')[0] || 'there';

const getSound = (preference?: Pick<Preference, 'mobileSoundEnabled'>) =>
  preference?.mobileSoundEnabled === false ? null : 'default';

const isPreferenceEnabled = (
  preference: Preference | undefined,
  masterPreference: MasterPreference,
  eventPreference: EventPreference,
) => {
  if (!preference) return true;
  return Boolean(preference.mobilePushEnabled && preference[masterPreference] && preference[eventPreference]);
};

const getPreferenceMap = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, Preference>();

  const preferences = await prisma.lswNotificationPreference.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      mobilePushEnabled: true,
      mobileSoundEnabled: true,
      incidentMobilePushEnabled: true,
      incidentCreatedPushEnabled: true,
      incidentTeamInvitePushEnabled: true,
      capaMobilePushEnabled: true,
      capaBoardCreatedPushEnabled: true,
    },
  });

  return new Map(preferences.map((preference) => [preference.userId, preference]));
};

const sendToRecipients = async (
  recipients: PushUser[],
  preferences: Map<string, Preference>,
  buildPayload: (recipient: PushUser, preference?: Preference) => Parameters<typeof sendPushNotificationToUser>[1],
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
        console.error('[IncidentPush] Failed to send incident push:', result.reason);
      }
      return totals;
    },
    { successCount: 0, failureCount: 0, recipientCount: recipients.length },
  );
};

const getIncidentSummary = (incident: {
  customTitle?: string | null;
  type?: string | null;
  severity?: string | null;
  Category?: { name: string } | null;
  Facility?: { name: string } | null;
  Area?: { name: string } | null;
  Line?: { name: string; lineNumber?: string | null } | null;
}) => {
  const category = incident.Category?.name || formatEnum(incident.type);
  const severity = incident.severity ? ` / ${formatEnum(incident.severity)}` : '';
  const line = incident.Line?.lineNumber ? `${incident.Line.name} ${incident.Line.lineNumber}` : incident.Line?.name;
  const location = [incident.Facility?.name, incident.Area?.name, line].filter(Boolean).join(' / ');
  return compact(`${incident.customTitle || category}${severity}${location ? ` at ${location}` : ''}`, 110);
};

export async function notifyIncidentCreatedPushSubscribers(incidentId: string, actor: PushActor) {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        Category: { select: { name: true } },
        Facility: { select: { name: true } },
        Area: { select: { name: true } },
        Line: { select: { name: true, lineNumber: true } },
      },
    });

    if (!incident?.organizationId) {
      return { successCount: 0, failureCount: 0, recipientCount: 0 };
    }

    const candidates = await prisma.user.findMany({
      where: {
        organizationId: incident.organizationId,
        isActive: true,
        id: { not: actor.id },
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
        const canViewAll = await hasPrivilege(
          incident.organizationId,
          user.role as UserRole,
          'incidents.view_all',
          user.id,
        );
        return canViewAll ? user : null;
      }),
    );

    const preferenceMap = await getPreferenceMap(candidates.map((user) => user.id));
    const recipients = allowed.filter((user): user is PushUser =>
      Boolean(user && isPreferenceEnabled(preferenceMap.get(user.id), 'incidentMobilePushEnabled', 'incidentCreatedPushEnabled')),
    );

    return sendToRecipients(recipients, preferenceMap, (recipient, preference) => ({
      title: 'New RCA incident created',
      body: compact(
        `Hi, ${getFirstName(recipient)}. ${getPersonName(actor)} created ${incident.incidentNumber}: ${getIncidentSummary(incident)}. Tap to review.`,
        178,
      ),
      sound: getSound(preference),
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: {
        type: 'INCIDENT_CREATED',
        screen: 'incidents',
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        channelId: 'dashmet_alerts',
      },
    }));
  } catch (error) {
    console.error('[IncidentPush] Incident-created fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

export async function notifyIncidentTeamInvitePushRecipients(options: {
  incidentId: string;
  invitedUserIds: string[];
  actor: PushActor;
}) {
  try {
    const uniqueUserIds = Array.from(new Set(options.invitedUserIds)).filter((userId) => userId !== options.actor.id);
    if (!uniqueUserIds.length) {
      return { successCount: 0, failureCount: 0, recipientCount: 0 };
    }

    const [incident, users] = await Promise.all([
      prisma.incident.findUnique({
        where: { id: options.incidentId },
        include: {
          Category: { select: { name: true } },
          Facility: { select: { name: true } },
          Area: { select: { name: true } },
          Line: { select: { name: true, lineNumber: true } },
        },
      }),
      prisma.user.findMany({
        where: { id: { in: uniqueUserIds }, isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
        },
      }),
    ]);

    if (!incident) {
      return { successCount: 0, failureCount: 0, recipientCount: 0 };
    }

    const preferenceMap = await getPreferenceMap(users.map((user) => user.id));
    const recipients = users.filter((user) =>
      isPreferenceEnabled(preferenceMap.get(user.id), 'incidentMobilePushEnabled', 'incidentTeamInvitePushEnabled'),
    );

    return sendToRecipients(recipients, preferenceMap, (recipient, preference) => ({
      title: 'Incident team invitation',
      body: compact(
        `Hi, ${getFirstName(recipient)}. ${getPersonName(options.actor)} invited you to ${incident.incidentNumber}: ${getIncidentSummary(incident)}. Tap to join the RCA team.`,
        178,
      ),
      sound: getSound(preference),
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: {
        type: 'INCIDENT_TEAM_INVITE',
        screen: 'incidents',
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        channelId: 'dashmet_alerts',
      },
    }));
  } catch (error) {
    console.error('[IncidentPush] Team-invite fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

export async function notifyCapaBoardCreatedPushSubscribers(options: {
  rcaId: string;
  actionCount: number;
  actor: PushActor;
}) {
  try {
    const rca = await prisma.rCAAnalysis.findUnique({
      where: { id: options.rcaId },
      include: {
        Incident: {
          include: {
            Category: { select: { name: true } },
            Facility: { select: { name: true } },
            Area: { select: { name: true } },
            Line: { select: { name: true, lineNumber: true } },
            IncidentParticipant: {
              where: { isActive: true, invitationStatus: 'ACCEPTED' },
              select: { userId: true },
            },
          },
        },
      },
    });

    const incident = rca?.Incident;
    if (!rca || !incident) {
      return { successCount: 0, failureCount: 0, recipientCount: 0 };
    }

    const recipientIds = new Set<string>();
    recipientIds.add(incident.createdById);
    if (incident.assignedToId) recipientIds.add(incident.assignedToId);
    recipientIds.add(rca.analystId);
    for (const participant of incident.IncidentParticipant) {
      recipientIds.add(participant.userId);
    }
    recipientIds.delete(options.actor.id);

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(recipientIds) }, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });

    const preferenceMap = await getPreferenceMap(users.map((user) => user.id));
    const recipients = users.filter((user) =>
      isPreferenceEnabled(preferenceMap.get(user.id), 'capaMobilePushEnabled', 'capaBoardCreatedPushEnabled'),
    );

    return sendToRecipients(recipients, preferenceMap, (recipient, preference) => ({
      title: 'CAPA Board created',
      body: compact(
        `Hi, ${getFirstName(recipient)}. ${getPersonName(options.actor)} created ${options.actionCount} CAPA action${options.actionCount === 1 ? '' : 's'} for ${incident.incidentNumber}. Tap to review.`,
        178,
      ),
      sound: getSound(preference),
      interruptionLevel: 'time-sensitive',
      ttl: 3600,
      data: {
        type: 'CAPA_BOARD_CREATED',
        screen: 'incidents',
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        rcaId: rca.id,
        channelId: 'dashmet_alerts',
      },
    }));
  } catch (error) {
    console.error('[IncidentPush] CAPA-board fan-out failed:', error);
    return { successCount: 0, failureCount: 1, recipientCount: 0 };
  }
}

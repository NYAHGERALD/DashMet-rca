import { Meeting, MeetingRecordingRetentionPolicy, User } from '@prisma/client';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { adminStorage } from '../config/firebase-admin';
import { prisma } from '../utils/prisma';

export const AUDIO_RETENTION_MODES = [
  'DELETE_AFTER_TRANSCRIPTION',
  'RETAIN_FOR_DAYS',
  'RETAIN_INDEFINITELY',
] as const;

export type AudioRetentionMode = typeof AUDIO_RETENTION_MODES[number];

export const DEFAULT_MEETING_AUDIO_RETENTION_DAYS = 30;
export const DEFAULT_TRANSCRIPT_RETENTION_DAYS = 90;
export const DEFAULT_SUMMARY_RETENTION_DAYS = 90;

type UploadedAudioFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type UploadMeetingAudioInput = {
  meeting: Meeting;
  user: Pick<User, 'id' | 'organizationId'>;
  file: UploadedAudioFile;
  duration?: number | null;
  recordedAt?: Date | null;
};

function normalizeRetentionMode(value: unknown): AudioRetentionMode {
  const normalized = String(value || '').trim().toUpperCase();
  return AUDIO_RETENTION_MODES.includes(normalized as AudioRetentionMode)
    ? normalized as AudioRetentionMode
    : 'RETAIN_FOR_DAYS';
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function sanitizeRetentionPolicyInput(input: Partial<MeetingRecordingRetentionPolicy>) {
  const audioRetentionMode = normalizeRetentionMode(input.audioRetentionMode);
  const audioRetentionDays = normalizePositiveInt(input.audioRetentionDays, DEFAULT_MEETING_AUDIO_RETENTION_DAYS);
  const transcriptRetentionDays = normalizePositiveInt(input.transcriptRetentionDays, DEFAULT_TRANSCRIPT_RETENTION_DAYS);
  const summaryRetentionDays = normalizePositiveInt(input.summaryRetentionDays, DEFAULT_SUMMARY_RETENTION_DAYS);

  return {
    audioRetentionMode,
    audioRetentionDays,
    transcriptRetentionDays,
    summaryRetentionDays,
    allowUsersToDeleteAudio: input.allowUsersToDeleteAudio !== false,
  };
}

export async function getOrCreateMeetingRecordingRetentionPolicy(organizationId: string) {
  const existing = await prisma.meetingRecordingRetentionPolicy.findUnique({
    where: { organizationId },
  });

  if (existing) return existing;

  return prisma.meetingRecordingRetentionPolicy.create({
    data: {
      organizationId,
      audioRetentionMode: 'RETAIN_FOR_DAYS',
      audioRetentionDays: DEFAULT_MEETING_AUDIO_RETENTION_DAYS,
      transcriptRetentionDays: DEFAULT_TRANSCRIPT_RETENTION_DAYS,
      summaryRetentionDays: DEFAULT_SUMMARY_RETENTION_DAYS,
      allowUsersToDeleteAudio: true,
    },
  });
}

export function calculateAudioRetentionExpiresAt(
  policy: Pick<MeetingRecordingRetentionPolicy, 'audioRetentionMode' | 'audioRetentionDays'>,
  fromDate = new Date(),
) {
  const mode = normalizeRetentionMode(policy.audioRetentionMode);
  if (mode !== 'RETAIN_FOR_DAYS') return null;

  const days = Math.max(1, normalizePositiveInt(policy.audioRetentionDays, DEFAULT_MEETING_AUDIO_RETENTION_DAYS));
  return new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting-audio';
}

function extensionFromFile(file: UploadedAudioFile) {
  const rawExtension = file.originalname.split('?')[0].split('.').pop();
  if (rawExtension && /^[a-z0-9]{2,6}$/i.test(rawExtension)) {
    return rawExtension.toLowerCase();
  }

  if (file.mimetype.includes('mp4') || file.mimetype.includes('m4a')) return 'm4a';
  if (file.mimetype.includes('mpeg') || file.mimetype.includes('mp3')) return 'mp3';
  if (file.mimetype.includes('wav')) return 'wav';
  if (file.mimetype.includes('webm')) return 'webm';
  if (file.mimetype.includes('ogg')) return 'ogg';
  return 'm4a';
}

export function buildGsUri(bucketName: string, storagePath: string) {
  return `gs://${bucketName}/${storagePath}`;
}

export function getStoragePathFromMeeting(meeting: Pick<Meeting, 'recordingStoragePath' | 'recordingUrl'>) {
  if (meeting.recordingStoragePath) return meeting.recordingStoragePath;

  const recordingUrl = meeting.recordingUrl || '';
  if (!recordingUrl.startsWith('gs://')) return null;

  const withoutScheme = recordingUrl.slice('gs://'.length);
  const slashIndex = withoutScheme.indexOf('/');
  return slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : null;
}

export async function deleteMeetingAudioObject(
  meeting: Pick<Meeting, 'recordingStoragePath' | 'recordingUrl'>,
) {
  const storagePath = getStoragePathFromMeeting(meeting);
  if (!storagePath) return false;

  const bucket = adminStorage.bucket();
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
  return true;
}

export async function uploadMeetingAudioToFirebase(input: UploadMeetingAudioInput) {
  const { meeting, user, file } = input;
  const bucket = adminStorage.bucket();
  const uploadedAt = new Date();
  const policy = await getOrCreateMeetingRecordingRetentionPolicy(meeting.organizationId);
  const retentionExpiresAt = calculateAudioRetentionExpiresAt(policy, uploadedAt);
  const extension = extensionFromFile(file);
  const originalName = safeFilePart(file.originalname.replace(/\.[^.]+$/, ''));
  const storagePath = [
    'meeting-recordings',
    meeting.organizationId,
    meeting.id,
    `${uploadedAt.getTime()}-${uuidv4()}-${originalName}.${extension}`,
  ].join('/');

  const existingStoragePath = getStoragePathFromMeeting(meeting);
  if (existingStoragePath) {
    await deleteMeetingAudioObject(meeting).catch((error) => {
      console.warn(`[MeetingRecordingStorage] Failed to delete previous audio for meeting ${meeting.id}:`, error?.message || error);
    });
  }

  const firebaseFile = bucket.file(storagePath);
  await firebaseFile.save(file.buffer, {
    resumable: false,
    validation: 'crc32c',
    metadata: {
      contentType: file.mimetype || 'audio/m4a',
      metadata: {
        meetingId: meeting.id,
        organizationId: meeting.organizationId,
        uploadedBy: user.id,
        originalName: file.originalname,
        retentionMode: policy.audioRetentionMode,
        retentionExpiresAt: retentionExpiresAt?.toISOString() || '',
      },
    },
  });

  const gsUri = buildGsUri(bucket.name, storagePath);

  return {
    bucketName: bucket.name,
    storagePath,
    gsUri,
    uploadedAt,
    retentionExpiresAt,
  };
}

export async function createSignedMeetingAudioUrl(
  meeting: Pick<Meeting, 'recordingStoragePath' | 'recordingUrl' | 'recordingDeletedAt'>,
  expiresInMinutes = 20,
) {
  if (meeting.recordingDeletedAt) {
    throw new Error('This meeting audio has been deleted by retention policy.');
  }

  const storagePath = getStoragePathFromMeeting(meeting);
  if (!storagePath) {
    throw new Error('This meeting does not have cloud audio available.');
  }

  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('This meeting audio file is no longer available in storage.');
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: expiresAt,
  });

  return { url, expiresAt };
}

export async function downloadMeetingAudioBuffer(
  meeting: Pick<Meeting, 'recordingStoragePath' | 'recordingUrl' | 'recordingDeletedAt'>,
) {
  if (meeting.recordingDeletedAt) {
    throw new Error('This meeting audio has been deleted by retention policy.');
  }

  const storagePath = getStoragePathFromMeeting(meeting);
  if (!storagePath) {
    throw new Error('This meeting does not have cloud audio available.');
  }

  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('This meeting audio file is no longer available in storage.');
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  const storedName = String(metadata.name || storagePath);
  return {
    buffer,
    fileName: path.basename(storedName) || 'meeting-audio.m4a',
    contentType: String(metadata.contentType || 'audio/m4a'),
  };
}

export async function deleteMeetingAudioByRetention(meetingId: string, reason: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return null;

  await deleteMeetingAudioObject(meeting);

  return prisma.meeting.update({
    where: { id: meetingId },
    data: {
      recordingUrl: null,
      recordingDeletedAt: new Date(),
      recordingDeletionReason: reason,
    },
  });
}

export async function cleanupExpiredMeetingRecordings(limit = 50) {
  const now = new Date();
  const expiredMeetings = await prisma.meeting.findMany({
    where: {
      recordingDeletedAt: null,
      recordingRetentionExpiresAt: { lte: now },
      OR: [
        { recordingStoragePath: { not: null } },
        { recordingUrl: { startsWith: 'gs://' } },
      ],
    },
    take: limit,
    orderBy: { recordingRetentionExpiresAt: 'asc' },
  });

  let deleted = 0;
  for (const meeting of expiredMeetings) {
    try {
      await deleteMeetingAudioByRetention(meeting.id, 'retention_expired');
      deleted += 1;
    } catch (error: any) {
      console.error(`[MeetingRecordingStorage] Failed retention cleanup for meeting ${meeting.id}:`, error?.message || error);
    }
  }

  return { scanned: expiredMeetings.length, deleted };
}

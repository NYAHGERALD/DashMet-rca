'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';

type AudioRetentionMode = 'DELETE_AFTER_TRANSCRIPTION' | 'RETAIN_FOR_DAYS' | 'RETAIN_INDEFINITELY';

type ConsentPolicy = {
  id?: string;
  version: string;
  title: string;
  purposeOfRecording: string;
  dataRetentionPolicy: string;
  dataSecurityPolicy: string;
  dataSharingPolicy: string;
  userRights: string;
  fullPolicyText?: string;
  effectiveDate?: string;
};

type RetentionPolicy = {
  audioRetentionMode: AudioRetentionMode;
  audioRetentionDays: number;
  transcriptRetentionDays: number;
  summaryRetentionDays: number;
  allowUsersToDeleteAudio: boolean;
  updatedAt?: string;
};

type SettingsResponse = {
  policy: ConsentPolicy;
  retentionPolicy: RetentionPolicy;
  stats: {
    storedAudioCount: number;
    expiredAudioCount: number;
    deletedAudioCount: number;
  };
};

const RETENTION_OPTIONS: Array<{ value: AudioRetentionMode; label: string; description: string }> = [
  {
    value: 'RETAIN_FOR_DAYS',
    label: 'Keep audio for a set number of days',
    description: 'Best for review, audit, and playback while still enforcing automatic cleanup.',
  },
  {
    value: 'DELETE_AFTER_TRANSCRIPTION',
    label: 'Delete audio after transcript processing',
    description: 'Keeps transcripts and summaries, then removes the original audio after processing completes.',
  },
  {
    value: 'RETAIN_INDEFINITELY',
    label: 'Keep audio until manually deleted',
    description: 'Use only when your organization has a clear long-term audio retention requirement.',
  },
];

const defaultPolicy: ConsentPolicy = {
  version: '1.0.0',
  title: 'Meeting Recording Consent Policy',
  purposeOfRecording: 'DashMet records meetings only after consent so audio can be transcribed, summarized, and converted into action items.',
  dataRetentionPolicy: 'Audio is stored securely according to the organization retention settings. Transcripts and summaries are retained according to organization policy.',
  dataSecurityPolicy: 'Meeting recordings are stored in controlled cloud storage and accessed through authenticated DashMet workflows.',
  dataSharingPolicy: 'Meeting data is available only to authorized users with access to the meeting or administrative compliance responsibilities.',
  userRights: 'Participants may request access, correction, or deletion according to organization policy and legal requirements.',
};

const defaultRetention: RetentionPolicy = {
  audioRetentionMode: 'RETAIN_FOR_DAYS',
  audioRetentionDays: 30,
  transcriptRetentionDays: 90,
  summaryRetentionDays: 90,
  allowUsersToDeleteAudio: true,
};

function numberValue(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

export default function MeetingRecordingCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<SettingsResponse['stats'] | null>(null);
  const [policy, setPolicy] = useState<ConsentPolicy>(defaultPolicy);
  const [retention, setRetention] = useState<RetentionPolicy>(defaultRetention);

  const selectedRetention = useMemo(
    () => RETENTION_OPTIONS.find((option) => option.value === retention.audioRetentionMode) || RETENTION_OPTIONS[0],
    [retention.audioRetentionMode],
  );

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.get('/consent/admin/meeting-recording-settings');
      const data = response.data?.data as SettingsResponse | undefined;
      if (!data) throw new Error('Settings were not returned.');
      setPolicy({ ...defaultPolicy, ...data.policy });
      setRetention({ ...defaultRetention, ...data.retentionPolicy });
      setStats(data.stats);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load meeting recording settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.put('/consent/admin/meeting-recording-settings', {
        policy,
        retentionPolicy: retention,
      });
      const data = response.data?.data as { policy: ConsentPolicy; retentionPolicy: RetentionPolicy } | undefined;
      if (data) {
        setPolicy(data.policy);
        setRetention(data.retentionPolicy);
      }
      const successMessage = response.data?.message || 'Meeting recording settings saved.';
      await loadSettings();
      setMessage(successMessage);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save meeting recording settings.');
    } finally {
      setSaving(false);
    }
  };

  const runCleanup = async () => {
    setCleanupRunning(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/consent/admin/meeting-recording-settings/cleanup');
      const successMessage = response.data?.message || 'Retention cleanup completed.';
      await loadSettings();
      setMessage(successMessage);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to run retention cleanup.');
    } finally {
      setCleanupRunning(false);
    }
  };

  const updatePolicy = (field: keyof ConsentPolicy, value: string) => {
    setPolicy((current) => ({ ...current, [field]: value }));
  };

  const updateRetention = (field: keyof RetentionPolicy, value: RetentionPolicy[keyof RetentionPolicy]) => {
    setRetention((current) => ({ ...current, [field]: value }));
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/admin" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                ← Admin Panel
              </Link>
              <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">Meeting Recording Compliance</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage cloud audio retention and the consent policy shown before recording begins.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runCleanup}
                disabled={loading || cleanupRunning}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {cleanupRunning ? 'Checking…' : 'Run cleanup'}
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={loading || saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              Loading meeting recording compliance settings…
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Stored audio</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats?.storedAudioCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Past retention date</p>
                  <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-300">{stats?.expiredAudioCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Deleted by policy</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats?.deletedAudioCount ?? 0}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Retention Settings</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Choose how long DashMet keeps original meeting audio after it is uploaded.
                  </p>

                  <div className="mt-5 space-y-3">
                    {RETENTION_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`block rounded-lg border p-4 transition ${
                          retention.audioRetentionMode === option.value
                            ? 'border-primary-500 bg-primary-50 dark:border-primary-500/70 dark:bg-primary-950/30'
                            : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900'
                        }`}
                      >
                        <div className="flex gap-3">
                          <input
                            type="radio"
                            name="audioRetentionMode"
                            value={option.value}
                            checked={retention.audioRetentionMode === option.value}
                            onChange={() => updateRetention('audioRetentionMode', option.value)}
                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white">{option.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-gray-600 dark:text-gray-400">{option.description}</span>
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Audio days</span>
                      <input
                        type="number"
                        min={1}
                        value={numberValue(retention.audioRetentionDays)}
                        onChange={(event) => updateRetention('audioRetentionDays', Number(event.target.value))}
                        disabled={retention.audioRetentionMode !== 'RETAIN_FOR_DAYS'}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Transcript days</span>
                      <input
                        type="number"
                        min={1}
                        value={numberValue(retention.transcriptRetentionDays)}
                        onChange={(event) => updateRetention('transcriptRetentionDays', Number(event.target.value))}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Summary days</span>
                      <input
                        type="number"
                        min={1}
                        value={numberValue(retention.summaryRetentionDays)}
                        onChange={(event) => updateRetention('summaryRetentionDays', Number(event.target.value))}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                      <input
                        type="checkbox"
                        checked={retention.allowUsersToDeleteAudio}
                        onChange={(event) => updateRetention('allowUsersToDeleteAudio', event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Allow users to delete saved audio</span>
                    </label>
                  </div>

                  <div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
                    Current choice: <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedRetention.label}</span>
                    {retention.updatedAt ? ` • Updated ${formatDateTime(retention.updatedAt)}` : ''}
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:col-span-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Consent Policy</h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        This is the policy users review before recording begins.
                      </p>
                    </div>
                    <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      Version {policy.version || 'new'}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Policy title</span>
                      <input
                        value={policy.title}
                        onChange={(event) => updatePolicy('title', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>

                    {([
                      ['purposeOfRecording', 'Purpose of recording'],
                      ['dataRetentionPolicy', 'Data retention'],
                      ['dataSecurityPolicy', 'Data security'],
                      ['dataSharingPolicy', 'Data sharing'],
                      ['userRights', 'User rights'],
                    ] as Array<[keyof ConsentPolicy, string]>).map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
                        <textarea
                          value={String(policy[field] || '')}
                          onChange={(event) => updatePolicy(field, event.target.value)}
                          rows={field === 'dataRetentionPolicy' ? 6 : 5}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

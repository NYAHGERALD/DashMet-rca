'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/dateUtils';

type PolicyType = 'PRIVACY_POLICY' | 'TERMS_OF_SERVICE' | 'COOKIE_POLICY' | 'SECURITY';

type PolicyDocument = {
  id: string;
  type: PolicyType;
  title: string;
  content: string;
  version: number;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

const POLICY_LABELS: Record<PolicyType, string> = {
  PRIVACY_POLICY: 'Privacy Policy',
  TERMS_OF_SERVICE: 'Terms of Service',
  COOKIE_POLICY: 'Cookie Policy',
  SECURITY: 'Security',
};

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedType, setSelectedType] = useState<PolicyType>('PRIVACY_POLICY');

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.type === selectedType) ?? null,
    [policies, selectedType]
  );

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/policies');
        const list = (res.data?.data?.policies ?? []) as PolicyDocument[];
        if (!mounted) return;
        setPolicies(list);
      } catch (e: any) {
        const msg = typeof e?.response?.data?.error === 'string'
          ? e.response.data.error
          : e?.message || 'Failed to load policies';
        if (!mounted) return;
        setError(msg);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // When switching policy type, populate editor fields from current record.
    if (selectedPolicy) {
      setTitle(selectedPolicy.title ?? '');
      setContent(selectedPolicy.content ?? '');
      return;
    }

    setTitle(POLICY_LABELS[selectedType]);
    setContent('');
  }, [selectedPolicy, selectedType]);

  const save = async (publish: boolean) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put(`/policies/${selectedType}`, {
        title,
        content,
        publish,
      });

      const updated = res.data?.data?.policy as PolicyDocument | undefined;
      if (!updated) throw new Error('Unexpected response');

      setPolicies((prev) => {
        const next = prev.filter((p) => p.type !== selectedType);
        next.push(updated);
        next.sort((a, b) => a.type.localeCompare(b.type));
        return next;
      });
    } catch (e: any) {
      const msg = typeof e?.response?.data?.error === 'string'
        ? e.response.data.error
        : e?.message || 'Failed to save policy';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-full mx-auto p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Policies</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage Privacy Policy, Terms of Service, Cookie Policy, and Security statements.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-2 py-2">
                  Policy Types
                </div>
                {(Object.keys(POLICY_LABELS) as PolicyType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition " +
                      (type === selectedType
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700')
                    }
                    onClick={() => setSelectedType(type)}
                    disabled={loading || saving}
                  >
                    {POLICY_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                {loading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedPolicy ? (
                            <>
                              Version <span className="font-semibold">{selectedPolicy.version}</span>
                              {selectedPolicy.isPublished && selectedPolicy.publishedAt ? (
                                <>
                                  {' '}
                                  • Published <span className="font-semibold">{formatDateTime(selectedPolicy.publishedAt)}</span>
                                </>
                              ) : (
                                <>
                                  {' '}
                                  • <span className="font-semibold">Not published</span>
                                </>
                              )}
                            </>
                          ) : (
                            <>Not created yet</>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 disabled:opacity-60"
                          onClick={() => save(false)}
                          disabled={saving || loading}
                        >
                          {saving ? 'Saving…' : 'Save Draft'}
                        </button>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
                          onClick={() => save(true)}
                          disabled={saving || loading}
                        >
                          {saving ? 'Publishing…' : 'Publish'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                          Title
                        </label>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder={POLICY_LABELS[selectedType]}
                          disabled={saving || loading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                          Content (Markdown)
                        </label>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="w-full min-h-[calc(100vh-380px)] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                          placeholder="Write the policy content here…"
                          disabled={saving || loading}
                        />
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Tip: Keep headings consistent and include an effective date.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

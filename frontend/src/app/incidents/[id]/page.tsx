'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { ensureRcaWorkspaceForIncident } from '@/lib/incidentWorkspace';

export default function LegacyIncidentDetailRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const incidentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!incidentId) return;

    let cancelled = false;

    const openWorkspace = async () => {
      try {
        const incidentResponse = await api.get(`/incidents/${incidentId}`);
        const incident = incidentResponse.data?.data;

        if (cancelled) return;

        if (incident?.status === 'DRAFT') {
          router.replace(`/incidents/new?edit=${incidentId}`);
          return;
        }

        const rcaAnalysis = await ensureRcaWorkspaceForIncident(
          incidentId,
          incident?.RCAAnalysis || []
        );

        if (!cancelled) {
          router.replace(`/rca/${rcaAnalysis.id}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to open the incident workspace');
        }
      }
    };

    openWorkspace();

    return () => {
      cancelled = true;
    };
  }, [incidentId, router]);

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="mx-auto mt-16 max-w-md rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">
            Opening Incident Workspace
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {error || 'Loading the newer RCA workspace with all incident tabs...'}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => router.replace('/incidents?filter=my')}
              className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Back to My Incidents
            </button>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

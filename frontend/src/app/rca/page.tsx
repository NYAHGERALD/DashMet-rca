'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingState from '@/components/ui/LoadingState';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface RCAAnalysis {
  id: string;
  method: 'FIVE_WHYS' | 'FISHBONE';
  status: string;
  aiRecommendedMethod: string | null;
  aiRecommendationReason: string | null;
  rootCauseStatement: string | null;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  incident: {
    id: string;
    incidentNumber: string;
    description: string;
    type: string;
    status: string;
    severity: string | null;
    category: { name: string };
    facility: { name: string };
  };
  analyst: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

function RCAListContent() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<RCAAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'validated'>('all');

  useEffect(() => {
    fetchRCAAnalyses();
  }, []);

  const fetchRCAAnalyses = async () => {
    try {
      // Fetch all incidents with RCA analyses
      const response = await api.get('/incidents');
      const incidents = response.data.data?.incidents || response.data.data || [];
      
      // Extract RCA analyses from incidents
      const allAnalyses: RCAAnalysis[] = [];
      for (const incident of incidents) {
        if (incident.rcaAnalyses && incident.rcaAnalyses.length > 0) {
          incident.rcaAnalyses.forEach((rca: any) => {
            allAnalyses.push({
              ...rca,
              incident: {
                id: incident.id,
                incidentNumber: incident.incidentNumber,
                description: incident.description,
                type: incident.type,
                status: incident.status,
                severity: incident.severity,
                category: incident.category,
                facility: incident.facility,
              },
            });
          });
        }
      }
      
      setAnalyses(allAnalyses);
      setError(''); // Clear any previous errors
    } catch (err: any) {
      console.error('Failed to fetch RCA analyses:', err);
      // Don't show error for 401 - the API interceptor handles redirects
      if (err.response?.status !== 401) {
        setError(err.response?.data?.error || 'Failed to load RCA analyses');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAnalyses = analyses.filter((rca) => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return !rca.isValidated;
    if (filter === 'validated') return rca.isValidated;
    return true;
  });

  const getStatusColor = (status: string, isValidated: boolean) => {
    if (isValidated) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    switch (status) {
      case 'NOT_STARTED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'PENDING_REVIEW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getMethodIcon = (method: string) => {
    if (method === 'FIVE_WHYS') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    );
  };

  if (loading) {
    return <LoadingState message="Loading RCA workspace..." icon="search" color="blue" />;
  }

  return (
    <div className="min-h-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              RCA Workspace
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Root Cause Analysis dashboard
            </p>
          </div>
          <Link
            href="/incidents"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Incidents
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex space-x-4 mb-6">
          {['all', 'in_progress', 'validated'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {filterOption === 'all' && 'All'}
              {filterOption === 'in_progress' && 'In Progress'}
              {filterOption === 'validated' && 'Validated'}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {analyses.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total RCAs</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">
              {analyses.filter((r) => r.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">In Progress</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {analyses.filter((r) => r.status === 'PENDING_REVIEW').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending Review</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {analyses.filter((r) => r.isValidated).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Validated</div>
          </div>
        </div>

        {/* RCA List */}
        {filteredAnalyses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No RCA analyses found
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Start an RCA analysis from an incident to see it here.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Incident
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Analyst
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAnalyses.map((rca) => (
                  <tr key={rca.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {rca.incident.incidentNumber}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {rca.incident.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          {getMethodIcon(rca.method)}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {rca.method === 'FIVE_WHYS' ? '5 Whys' : 'Fishbone'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          rca.status,
                          rca.isValidated
                        )}`}
                      >
                        {rca.isValidated ? 'Validated' : rca.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {rca.analyst.firstName} {rca.analyst.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(rca.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/rca/${rca.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RCAListPage() {
  return (
    <ProtectedRoute>
      <RCAListContent />
    </ProtectedRoute>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoadingState from '@/components/ui/LoadingState';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

interface ReportFilter {
  startDate: string;
  endDate: string;
  facilityId: string;
  incidentType: string;
  period: string;
  regulatoryType: string;
}

interface ExecutiveDashboard {
  generatedAt: string;
  period: {
    days: number;
    start: string;
    end: string;
  };
  keyMetrics: {
    totalIncidents: number;
    trend: string;
    avgRCAScore: string;
    avgCAPAQuality: string;
    slaCompliance: string;
  };
  byType: Array<{ type: string; count: number; percentage: string }>;
  bySeverity: Array<{ severity: string; count: number; percentage: string }>;
  byStatus: Array<{ status: string; count: number; percentage: string }>;
  byFacility: Array<{ facilityId: string; facilityName: string; count: number; percentage: string }>;
  criticalItems: Array<{
    id: string;
    incidentNumber: string;
    type: string;
    severity: string;
    category: string;
    facility: string;
    assignedTo: string;
    occurredAt: string;
    slaBreached: boolean;
  }>;
  overdueActions: Array<{
    id: string;
    incidentNumber: string;
    facility: string;
    description: string;
    owner: string;
    dueDate: string;
    daysOverdue: number;
  }>;
}

interface Facility {
  id: string;
  name: string;
}

function ReportsContent() {
  const router = useRouter();
  const { user, loading: authLoading, getIdToken } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'executive' | 'audit' | 'regulatory' | 'rca' | 'incidents'>('executive');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: '',
    endDate: '',
    facilityId: '',
    incidentType: '',
    period: '30',
    regulatoryType: 'FSMA',
  });
  
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboard | null>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [regulatoryData, setRegulatoryData] = useState<any>(null);
  const [rcaId, setRcaId] = useState('');
  const [rcaReportData, setRcaReportData] = useState<any>(null);
  const [incidentReportData, setIncidentReportData] = useState<any[]>([]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load facilities
  useEffect(() => {
    const loadFacilities = async () => {
      if (!user) return;
      try {
        const token = await getIdToken();
        if (!token) {
          console.warn('No auth token available');
          setFacilities([]);
          return;
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/facilities`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Handle different response structures: data, data.data, data.Facility, data.facilities
          let facilitiesArray: Facility[] = [];
          if (Array.isArray(data)) {
            facilitiesArray = data;
          } else if (data.data && Array.isArray(data.data.Facility)) {
            facilitiesArray = data.data.Facility;
          } else if (data.data && Array.isArray(data.data.facilities)) {
            facilitiesArray = data.data.facilities;
          } else if (Array.isArray(data.data)) {
            facilitiesArray = data.data;
          } else if (Array.isArray(data.facilities)) {
            facilitiesArray = data.facilities;
          } else if (Array.isArray(data.Facility)) {
            facilitiesArray = data.Facility;
          }
          console.log('Loaded facilities:', facilitiesArray);
          setFacilities(facilitiesArray);
        } else {
          console.warn('Failed to load facilities:', response.status);
          setFacilities([]);
        }
      } catch (err) {
        console.error('Error loading facilities:', err);
        setFacilities([]);
      }
    };
    loadFacilities();
  }, [user, getIdToken]);

  // Load executive dashboard on initial render - wait for auth to complete
  useEffect(() => {
    if (user && !authLoading && activeTab === 'executive' && !loading && !executiveData) {
      fetchExecutiveDashboard();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, activeTab]);

  const fetchExecutiveDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        period: filters.period,
        ...(filters.facilityId && { facilityId: filters.facilityId }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/reports/executive?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch executive dashboard');
      }
      
      const data = await response.json();
      setExecutiveData(data.data || data);
    } catch (err) {
      console.error('Executive dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.facilityId && { facilityId: filters.facilityId }),
        ...(filters.incidentType && { incidentType: filters.incidentType }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/reports/audit?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch audit report');
      }
      
      const data = await response.json();
      setAuditData(data.data || data);
    } catch (err) {
      console.error('Audit report error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncidentReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.facilityId && { facilityId: filters.facilityId }),
        ...(filters.incidentType && { type: filters.incidentType }),
        limit: '100',
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/incidents?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch incident reports');
      }
      
      const data = await response.json();
      setIncidentReportData(data.data?.incidents || data.incidents || []);
    } catch (err) {
      console.error('Incident reports error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegulatoryReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.facilityId && { facilityId: filters.facilityId }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/reports/regulatory/${filters.regulatoryType}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch regulatory report');
      }
      
      const data = await response.json();
      setRegulatoryData(data.data || data);
    } catch (err) {
      console.error('Regulatory report error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRCAReport = async () => {
    if (!rcaId.trim()) {
      setError('Please enter an RCA ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/reports/rca/${rcaId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch RCA report');
      }
      
      const data = await response.json();
      setRcaReportData(data.data || data);
    } catch (err) {
      console.error('RCA report error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const exportToJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <LoadingState message="Loading reports..." icon="chart" color="blue" />;
  }

  return (
    <div className="min-h-full">

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'executive', label: 'Executive Dashboard', icon: '📊' },
              { id: 'audit', label: 'Audit Reports', icon: '📋' },
              { id: 'incidents', label: 'Incident Reports', icon: '📝' },
              { id: 'regulatory', label: 'Regulatory Archives', icon: '📁' },
              { id: 'rca', label: 'RCA Export', icon: '📄' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Executive Dashboard Tab */}
        {activeTab === 'executive' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
                  <select
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility</label>
                  <select
                    value={filters.facilityId}
                    onChange={(e) => setFilters({ ...filters, facilityId: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Facilities</option>
                    {Array.isArray(facilities) && facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchExecutiveDashboard}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
                {executiveData && (
                  <button
                    onClick={() => exportToJSON(executiveData, 'executive-dashboard')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Export JSON
                  </button>
                )}
              </div>
            </div>

            {executiveData && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Incidents</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{executiveData.keyMetrics.totalIncidents}</p>
                    <p className={`text-sm ${executiveData.keyMetrics.trend.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>
                      {executiveData.keyMetrics.trend} vs previous period
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg RCA Score</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{executiveData.keyMetrics.avgRCAScore}</p>
                    <p className="text-sm text-gray-400">Quality rating</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg CAPA Quality</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{executiveData.keyMetrics.avgCAPAQuality}</p>
                    <p className="text-sm text-gray-400">Action strength</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">SLA Compliance</p>
                    <p className="text-3xl font-bold text-green-600">{executiveData.keyMetrics.slaCompliance}</p>
                    <p className="text-sm text-gray-400">Response targets</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Actions</p>
                    <p className={`text-3xl font-bold ${executiveData.overdueActions.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {executiveData.overdueActions.length}
                    </p>
                    <p className="text-sm text-gray-400">Requiring attention</p>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* By Type */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Incidents by Type</h3>
                    <div className="space-y-2">
                      {executiveData.byType.map((item) => (
                        <div key={item.type} className="flex items-center gap-2">
                          <div className="w-24 text-sm text-gray-600 dark:text-gray-400">{item.type}</div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6">
                            <div
                              className="bg-blue-500 h-6 rounded-full flex items-center justify-end px-2"
                              style={{ width: item.percentage }}
                            >
                              <span className="text-xs text-white">{item.count}</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-12">{item.percentage}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Severity */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Incidents by Severity</h3>
                    <div className="space-y-2">
                      {executiveData.bySeverity.map((item) => (
                        <div key={item.severity} className="flex items-center gap-2">
                          <div className="w-24 text-sm text-gray-600 dark:text-gray-400">{item.severity}</div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6">
                            <div
                              className={`h-6 rounded-full flex items-center justify-end px-2 ${
                                item.severity === 'CRITICAL' ? 'bg-red-500' :
                                item.severity === 'HIGH' ? 'bg-orange-500' :
                                item.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: item.percentage }}
                            >
                              <span className="text-xs text-white">{item.count}</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-12">{item.percentage}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Facility */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Incidents by Facility</h3>
                    <div className="space-y-2">
                      {executiveData.byFacility.map((item) => (
                        <div key={item.facilityId} className="flex items-center gap-2">
                          <div className="w-32 text-sm text-gray-600 dark:text-gray-400 truncate">{item.facilityName}</div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6">
                            <div
                              className="bg-purple-500 h-6 rounded-full flex items-center justify-end px-2"
                              style={{ width: item.percentage }}
                            >
                              <span className="text-xs text-white">{item.count}</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-12">{item.percentage}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Status */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Incidents by Status</h3>
                    <div className="space-y-2">
                      {executiveData.byStatus.map((item) => (
                        <div key={item.status} className="flex items-center gap-2">
                          <div className="w-24 text-sm text-gray-600 dark:text-gray-400">{item.status}</div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6">
                            <div
                              className="bg-indigo-500 h-6 rounded-full flex items-center justify-end px-2"
                              style={{ width: item.percentage }}
                            >
                              <span className="text-xs text-white">{item.count}</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-12">{item.percentage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Critical Items */}
                {executiveData.criticalItems.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-red-600">⚠️ Critical Items Requiring Attention</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Incident</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Severity</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Facility</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Assigned To</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SLA</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {executiveData.criticalItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm">
                                <button
                                  onClick={() => router.push(`/incidents/${item.id}`)}
                                  className="text-blue-600 hover:underline"
                                >
                                  {item.incidentNumber}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{item.type}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  item.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                  item.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.severity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{item.facility}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{item.assignedTo}</td>
                              <td className="px-4 py-3 text-sm">
                                {item.slaBreached ? (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">BREACHED</span>
                                ) : (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">OK</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Overdue Actions */}
                {executiveData.overdueActions.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4 text-orange-600">⏰ Overdue CAPA Actions</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Incident</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Facility</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Owner</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Due Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Overdue</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {executiveData.overdueActions.map((action) => (
                            <tr key={action.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{action.incidentNumber}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{action.facility}</td>
                              <td className="px-4 py-3 text-sm max-w-xs truncate text-gray-900 dark:text-gray-200">{action.description}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{action.owner}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{formatDate(action.dueDate)}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                  {action.daysOverdue} days
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        )}

        {/* Audit Reports Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Generate Audit Report</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility</label>
                  <select
                    value={filters.facilityId}
                    onChange={(e) => setFilters({ ...filters, facilityId: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Facilities</option>
                    {Array.isArray(facilities) && facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Incident Type</label>
                  <select
                    value={filters.incidentType}
                    onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Types</option>
                    <option value="FOOD_SAFETY">Food Safety</option>
                    <option value="MACHINE_BREAKDOWN">Machine Breakdown</option>
                    <option value="QUALITY">Quality</option>
                    <option value="SAFETY">Safety</option>
                    <option value="ENVIRONMENTAL">Environmental</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <button
                  onClick={fetchAuditReport}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>

            {auditData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Audit Report</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Period: {auditData.reportPeriod.start} - {auditData.reportPeriod.end}
                    </p>
                  </div>
                  <button
                    onClick={() => exportToJSON(auditData, 'audit-report')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Export JSON
                  </button>
                </div>
                
                {/* Summary */}
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Incidents</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{auditData.summary.totalIncidents}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">With RCA</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{auditData.summary.withRCA}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Completed RCAs</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{auditData.summary.completedRCAs}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">By Type</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {Object.entries(auditData.summary.byType).map(([type, count]) => (
                          <span key={type} className="mr-2">{type}: {count as number}</span>
                        ))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Incident List */}
                <div className="p-4">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Incident Details ({auditData.incidents.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Incident #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Severity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reported</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">RCA Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {auditData.incidents.slice(0, 20).map((incident: any) => (
                          <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{incident.incidentNumber}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{incident.type}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{incident.severity || 'N/A'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{incident.status}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{formatDate(incident.reportedAt)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">{incident.rcaSummary?.status || 'No RCA'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">
                              {incident.rcaSummary ? `${incident.rcaSummary.completedActions}/${incident.rcaSummary.actionsCount}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        )}

        {/* Incident Reports Tab */}
        {activeTab === 'incidents' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Generate Incident Report</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility</label>
                  <select
                    value={filters.facilityId}
                    onChange={(e) => setFilters({ ...filters, facilityId: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Facilities</option>
                    {Array.isArray(facilities) && facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Incident Type</label>
                  <select
                    value={filters.incidentType}
                    onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Types</option>
                    <option value="FOOD_SAFETY">Food Safety</option>
                    <option value="MACHINE_EQUIPMENT">Machine/Equipment</option>
                    <option value="WORKPLACE_SAFETY">Workplace Safety</option>
                    <option value="OPERATIONS">Operations</option>
                  </select>
                </div>
                <button
                  onClick={fetchIncidentReports}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>

            {incidentReportData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Incident Report</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {incidentReportData.length} incidents found
                      {filters.startDate && filters.endDate && ` • Period: ${filters.startDate} - ${filters.endDate}`}
                    </p>
                  </div>
                  <button
                    onClick={() => exportToJSON(incidentReportData, 'incident-report')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Export JSON
                  </button>
                </div>
                
                {/* Summary Stats */}
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{incidentReportData.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Food Safety</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {incidentReportData.filter((i: any) => i.type === 'FOOD_SAFETY').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Machine/Equipment</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {incidentReportData.filter((i: any) => i.type === 'MACHINE_EQUIPMENT').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Workplace Safety</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {incidentReportData.filter((i: any) => i.type === 'WORKPLACE_SAFETY').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Critical/High</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {incidentReportData.filter((i: any) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Incident Table */}
                <div className="p-4">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Incident Details</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Incident #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Severity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Facility</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reported</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {incidentReportData.map((incident: any) => (
                          <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                              <button
                                onClick={() => router.push(`/incidents/${incident.id}`)}
                                className="hover:underline"
                              >
                                {incident.incidentNumber}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                incident.type === 'FOOD_SAFETY' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                                incident.type === 'MACHINE_EQUIPMENT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                              }`}>
                                {incident.type?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">
                              {incident.category?.name || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                incident.severity === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' :
                                incident.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                              }`}>
                                {incident.severity || 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                incident.status === 'CLOSED' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                incident.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                incident.status === 'DRAFT' ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                              }`}>
                                {incident.status?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">
                              {incident.facility?.name || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200">
                              {formatDate(incident.reportedAt)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {incident.description?.substring(0, 80)}{incident.description?.length > 80 ? '...' : ''}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <button
                                onClick={() => router.push(`/incidents/${incident.id}`)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        )}

        {/* Regulatory Archives Tab */}
        {activeTab === 'regulatory' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Generate Regulatory Evidence Package</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regulatory Framework</label>
                  <select
                    value={filters.regulatoryType}
                    onChange={(e) => setFilters({ ...filters, regulatoryType: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="FSMA">FSMA (Food Safety Modernization Act)</option>
                    <option value="HACCP">HACCP</option>
                    <option value="OSHA">OSHA</option>
                    <option value="GMP">GMP</option>
                    <option value="ISO22000">ISO 22000</option>
                    <option value="FDA">FDA</option>
                    <option value="SQF">SQF</option>
                    <option value="BRC">BRC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility</label>
                  <select
                    value={filters.facilityId}
                    onChange={(e) => setFilters({ ...filters, facilityId: e.target.value })}
                    className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Facilities</option>
                    {Array.isArray(facilities) && facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchRegulatoryReport}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Package'}
                </button>
              </div>
            </div>

            {regulatoryData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{regulatoryData.complianceGuidance.name} Evidence Package</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Period: {regulatoryData.reportPeriod.start} - {regulatoryData.reportPeriod.end}
                    </p>
                  </div>
                  <button
                    onClick={() => exportToJSON(regulatoryData, `regulatory-${filters.regulatoryType}`)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Export JSON
                  </button>
                </div>

                {/* Summary */}
                <div className="p-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Total Incidents</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{regulatoryData.summary.totalIncidents}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Total Actions</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{regulatoryData.summary.totalActions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Verified</p>
                      <p className="text-2xl font-bold text-green-600">{regulatoryData.summary.verifiedActions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Pending</p>
                      <p className="text-2xl font-bold text-orange-600">{regulatoryData.summary.pendingActions}</p>
                    </div>
                  </div>
                </div>

                {/* Compliance Guidance */}
                <div className="p-4 border-b dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-white">📋 {regulatoryData.complianceGuidance.name} Requirements</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {regulatoryData.complianceGuidance.keyRequirements.map((req: string, i: number) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                    ⏱️ Reporting Timeline: {regulatoryData.complianceGuidance.reportingTimeline}
                  </p>
                </div>

                {/* Records */}
                <div className="p-4">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Evidence Records ({regulatoryData.records.length})</h4>
                  <div className="space-y-4">
                    {regulatoryData.records.map((record: any) => (
                      <div key={record.incident.id} className="border dark:border-gray-700 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{record.incident.incidentNumber}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{record.incident.type} - {record.incident.facility}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                            record.incident.severity === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                          }`}>
                            {record.incident.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{record.incident.description}</p>
                        <p className="text-sm text-gray-900 dark:text-gray-200"><strong>Root Cause:</strong> {record.rcaAnalysis.rootCause || 'Under investigation'}</p>
                        
                        {/* Actions */}
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Corrective Actions ({record.actions.length})</p>
                          <div className="mt-1 space-y-1">
                            {record.actions.map((action: any) => (
                              <div key={action.id} className="text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded flex justify-between">
                                <span className="truncate flex-1 text-gray-900 dark:text-gray-200">{action.description}</span>
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                  action.status === 'VERIFIED' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                  action.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                                }`}>
                                  {action.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        )}

        {/* RCA Export Tab */}
        {activeTab === 'rca' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Export Full RCA Report</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Generate a comprehensive RCA report including incident details, 5 Whys analysis, 
                Fishbone diagram, root cause determination, and CAPA actions.
              </p>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RCA ID</label>
                  <input
                    type="text"
                    value={rcaId}
                    onChange={(e) => setRcaId(e.target.value)}
                    placeholder="Enter RCA Analysis ID"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={fetchRCAReport}
                  disabled={loading || !rcaId.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>

            {rcaReportData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{rcaReportData.reportTitle}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Generated: {formatDateTime(rcaReportData.generatedAt)}</p>
                  </div>
                  <button
                    onClick={() => exportToJSON(rcaReportData, `rca-report-${rcaReportData.executiveSummary.incidentNumber}`)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Export JSON
                  </button>
                </div>

                {/* Executive Summary */}
                <div className="p-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Executive Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Incident Number</p>
                      <p className="font-medium text-gray-900 dark:text-white">{rcaReportData.executiveSummary.incidentNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Type</p>
                      <p className="font-medium text-gray-900 dark:text-white">{rcaReportData.executiveSummary.incidentType}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Severity</p>
                      <p className="font-medium text-gray-900 dark:text-white">{rcaReportData.executiveSummary.severity || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Status</p>
                      <p className="font-medium text-gray-900 dark:text-white">{rcaReportData.executiveSummary.rcaStatus}</p>
                    </div>
                  </div>
                  {rcaReportData.executiveSummary.rootCause && (
                    <div className="mt-4">
                      <p className="text-gray-500 dark:text-gray-400">Root Cause</p>
                      <p className="font-medium text-red-600">{rcaReportData.executiveSummary.rootCause}</p>
                    </div>
                  )}
                </div>

                {/* Incident Details */}
                <div className="p-4 border-b dark:border-gray-700">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Incident Details</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{rcaReportData.incidentDetails.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Facility</p>
                      <p className="text-gray-900 dark:text-white">{rcaReportData.executiveSummary.facility}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Department</p>
                      <p className="text-gray-900 dark:text-white">{rcaReportData.incidentDetails.department}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Line</p>
                      <p className="text-gray-900 dark:text-white">{rcaReportData.incidentDetails.line}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Reported By</p>
                      <p className="text-gray-900 dark:text-white">{rcaReportData.incidentDetails.reportedBy}</p>
                    </div>
                  </div>
                </div>

                {/* 5 Whys */}
                {rcaReportData.fiveWhysAnalysis.questions.length > 0 && (
                  <div className="p-4 border-b dark:border-gray-700">
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-white">5 Whys Analysis</h4>
                    <div className="space-y-3">
                      {rcaReportData.fiveWhysAnalysis.questions.map((why: any) => (
                        <div key={why.whyNumber} className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                          <p className="font-medium text-blue-600 dark:text-blue-400">Why #{why.whyNumber}: {why.question}</p>
                          <p className="text-sm mt-1 text-gray-900 dark:text-gray-200">{why.answer}</p>
                          {why.evidence && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Evidence: {why.evidence}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fishbone */}
                {Object.values(rcaReportData.fishboneAnalysis.categories).some((arr: any) => arr.length > 0) && (
                  <div className="p-4 border-b dark:border-gray-700">
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Fishbone Analysis (Ishikawa)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(rcaReportData.fishboneAnalysis.categories).map(([category, causes]: [string, any]) => (
                        causes.length > 0 && (
                          <div key={category} className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                            <p className="font-medium text-sm text-purple-600 dark:text-purple-400">{category}</p>
                            <ul className="mt-2 text-sm space-y-1 text-gray-900 dark:text-gray-200">
                              {causes.map((cause: any) => (
                                <li key={cause.id} className={cause.isRootCause ? 'font-medium text-red-600' : ''}>
                                  • {cause.cause} {cause.isRootCause && '(Root Cause)'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* CAPA Actions */}
                <div className="p-4 border-b dark:border-gray-700">
                  <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Corrective Actions ({rcaReportData.correctiveActions.totalActions})</h4>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Object.entries(rcaReportData.correctiveActions.summary).map(([status, count]) => (
                      <div key={status} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{status}</p>
                        <p className="font-bold text-gray-900 dark:text-white">{count as number}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {rcaReportData.correctiveActions.actions.map((action: any) => (
                      <div key={action.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                        <div className="flex-1 text-gray-900 dark:text-gray-200">
                          <span className={`px-2 py-0.5 rounded text-xs mr-2 ${
                            action.type === 'CORRECTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                          }`}>{action.type}</span>
                          {action.description}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">{action.owner}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            action.status === 'VERIFIED' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                            action.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                          }`}>{action.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compliance Notes */}
                {rcaReportData.compliance.complianceNotes.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20">
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-white">⚠️ Compliance Notes</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                      {rcaReportData.compliance.complianceNotes.map((note: string, i: number) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                    {rcaReportData.compliance.regulatoryTags.length > 0 && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Regulatory Tags: </span>
                        {rcaReportData.compliance.regulatoryTags.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded text-xs mr-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}

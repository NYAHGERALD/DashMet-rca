'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Image from 'next/image';
import { formatDateTime, formatDate } from '@/lib/dateUtils';
import {
  LswKeyResultSet, LswKeyResult,
  createLswKeyResultSet, updateLswKeyResultSet, deleteLswKeyResultSet,
  createLswKeyResult, updateLswKeyResult, deleteLswKeyResult,
} from '@/lib/lswApi';

// Types
interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface SystemHealth {
  status: string;
  timestamp: string;
  uptime: number;
  responseTimeMs: number;
  services: {
    database: { status: string; latencyMs: number };
    api: { status: string; version: string };
  };
  metrics: {
    activeUsers: number;
    totalIncidents: number;
    totalRCAs: number;
    activeSessions: number;
  };
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
  };
}

interface RegulatoryCheck {
  regulationType: string;
  regulationName?: string;
  regulationDescription?: string;
  readinessScore: string | null;
  readinessLevel: string | null;
  trackingStatus?: 'active' | 'inactive' | 'not_started';
  message?: string;
  summary?: {
    openCriticalIncidents: number;
    pendingRegulatoryActions: number;
    rcaValidationRate: string;
    slaBreaches: number;
  };
  detailedMetrics?: {
    rca: {
      total: number;
      validated: number;
      completed: number;
      validationRate: string;
    };
    capa: {
      total: number;
      completed: number;
      pending: number;
      overdue: number;
      withEvidence: number;
      evidenceRate: string;
    };
    fmir: {
      total: number;
      closed: number;
      withEvidence: number;
      auditPassed: number;
    };
    evidence: {
      incidentsWithEvidence: number;
      totalIncidents: number;
      coverageRate: string;
    };
  };
  checklist?: Array<{ item: string; status: boolean; priority: string; details?: string }>;
  timeWindow?: {
    start: string;
    end: string;
  };
  scope?: {
    type: 'facility' | 'organization';
    facilityId: string | null;
    facilityName: string | null;
    totalFacilities: number;
  };
  tracking?: {
    id: string;
    status: 'active' | 'inactive' | 'not_started';
    startDate: string;
    windowDays: number;
    daysActive: number;
  } | null;
}

interface RegulatorySnapshot {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  readinessScore: number;
  readinessLevel: string;
  totalIncidents: number;
  criticalIncidents: number;
  rcasCompleted: number;
  capasCompleted: number;
}

interface Facility {
  id: string;
  name: string;
}

function EnterpriseAdminContent() {
  const { user, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'health' | 'audit' | 'regulatory' | 'keyresults'>('health');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // State for each section
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [regulatoryCheck, setRegulatoryCheck] = useState<RegulatoryCheck | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [trackingHistory, setTrackingHistory] = useState<RegulatorySnapshot[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [trackingAction, setTrackingAction] = useState<'idle' | 'starting' | 'resetting'>('idle');

  // Key Results state
  const [keyResultSets, setKeyResultSets] = useState<LswKeyResultSet[]>([]);
  const [krLoading, setKrLoading] = useState(false);
  const [krSaving, setKrSaving] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [showNewSetForm, setShowNewSetForm] = useState(false);
  const [newSetForm, setNewSetForm] = useState({ name: '', scope: 'PLANT' as 'PLANT' | 'CORPORATE' | 'DEPARTMENT' | 'CUSTOM', description: '', icon: '' });
  const [editSetForm, setEditSetForm] = useState({ name: '', scope: 'PLANT' as 'PLANT' | 'CORPORATE' | 'DEPARTMENT' | 'CUSTOM', description: '', icon: '' });
  const [showNewKrForm, setShowNewKrForm] = useState<string | null>(null); // setId for which to show form
  const [newKrForm, setNewKrForm] = useState({ metric: '', value: '', target: '', trend: '' as '' | 'UP' | 'DOWN' | 'STABLE' });
  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [editKrForm, setEditKrForm] = useState({ metric: '', value: '', target: '', trend: '' as '' | 'UP' | 'DOWN' | 'STABLE' });

  // Filters
  const [auditFilters, setAuditFilters] = useState({ entity: '', action: '' });
  const [regulationType, setRegulationType] = useState('FSMA');
  const [selectedFacility, setSelectedFacility] = useState<string>('all');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const token = await getIdToken();
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        switch (activeTab) {
          case 'health':
            const healthRes = await fetch(`${apiUrl}/admin/health`, { headers });
            if (!healthRes.ok) throw new Error('Failed to fetch system health');
            const healthData = await healthRes.json();
            setSystemHealth(healthData.data);
            break;

          case 'audit':
            const auditParams = new URLSearchParams({
              page: auditPagination.page.toString(),
              limit: '20',
              ...(auditFilters.entity && { entity: auditFilters.entity }),
              ...(auditFilters.action && { action: auditFilters.action }),
            });
            const auditRes = await fetch(`${apiUrl}/admin/audit-logs?${auditParams}`, { headers });
            if (!auditRes.ok) throw new Error('Failed to fetch audit logs');
            const auditData = await auditRes.json();
            setAuditLogs(auditData.data.logs);
            setAuditPagination(auditData.data.pagination);
            break;

          case 'regulatory':
            // Fetch facilities if not already loaded
            if (facilities.length === 0) {
              const facilitiesRes = await fetch(`${apiUrl}/facilities`, { headers });
              if (facilitiesRes.ok) {
                const facilitiesData = await facilitiesRes.json();
                setFacilities(facilitiesData.data?.Facility || []);
              }
            }
            const regParams = new URLSearchParams({
              regulationType,
              ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
            });
            const regRes = await fetch(`${apiUrl}/admin/regulatory-check?${regParams}`, { headers });
            if (!regRes.ok) throw new Error('Failed to fetch regulatory check');
            const regData = await regRes.json();
            setRegulatoryCheck(regData.data);
            break;

          case 'keyresults':
            if (user?.role === 'SYSTEM_ADMIN') break; // No org for system admin
            setKrLoading(true);
            const krRes = await fetch(`${apiUrl}/lsw/key-result-sets`, { headers });
            if (!krRes.ok) throw new Error('Failed to fetch key result sets');
            const krData = await krRes.json();
            setKeyResultSets(krData.data || []);
            setKrLoading(false);
            break;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        console.error('Error fetching admin data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab, auditPagination.page, auditFilters, regulationType, selectedFacility, getIdToken, apiUrl, facilities.length]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Start tracking function
  const handleStartTracking = async () => {
    setTrackingAction('starting');
    try {
      const token = await getIdToken();
      const res = await fetch(`${apiUrl}/admin/regulatory-tracking/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId: selectedFacility !== 'all' ? selectedFacility : null,
          regulationType,
          windowDays: 30,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to start tracking');
      
      // Refresh the regulatory check data
      const regParams = new URLSearchParams({
        regulationType,
        ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
      });
      const regRes = await fetch(`${apiUrl}/admin/regulatory-check?${regParams}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (regRes.ok) {
        const regData = await regRes.json();
        setRegulatoryCheck(regData.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start tracking');
    } finally {
      setTrackingAction('idle');
    }
  };

  // Reset tracking function
  const handleResetTracking = async () => {
    if (!regulatoryCheck?.tracking?.id) return;
    
    if (!confirm('Reset tracking? This will archive the current period and start fresh.')) return;
    
    setTrackingAction('resetting');
    try {
      const token = await getIdToken();
      const res = await fetch(`${apiUrl}/admin/regulatory-tracking/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackingId: regulatoryCheck.tracking.id,
          createSnapshot: true,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to reset tracking');
      
      // Refresh the regulatory check data
      const regParams = new URLSearchParams({
        regulationType,
        ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
      });
      const regRes = await fetch(`${apiUrl}/admin/regulatory-check?${regParams}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (regRes.ok) {
        const regData = await regRes.json();
        setRegulatoryCheck(regData.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset tracking');
    } finally {
      setTrackingAction('idle');
    }
  };

  // Fetch history
  const handleViewHistory = async () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      try {
        const token = await getIdToken();
        const historyParams = new URLSearchParams({
          regulationType,
          ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
        });
        const res = await fetch(`${apiUrl}/admin/regulatory-tracking/history?${historyParams}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTrackingHistory(data.data.snapshots || []);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">🛡️ Enterprise Administration</h1>
            </div>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
              {user?.role}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
          {[
            { id: 'health', label: '🖥️ System Health' },
            { id: 'audit', label: '📋 Audit Logs' },
            { id: 'regulatory', label: '📜 Regulatory Readiness' },
            { id: 'keyresults', label: '🎯 Key Results' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* System Health Tab */}
            {activeTab === 'health' && systemHealth && (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`p-6 rounded-lg ${
                  systemHealth.status === 'healthy' 
                    ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800' 
                    : 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">
                        {systemHealth.status === 'healthy' ? '✅' : '⚠️'}
                      </span>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          System Status: {systemHealth.status.toUpperCase()}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Last checked: {formatDate(systemHealth.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatUptime(systemHealth.uptime)}</p>
                    </div>
                  </div>
                </div>

                {/* Services Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">🗄️ Database</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status</span>
                        <span className={systemHealth.services.database.status === 'healthy' 
                          ? 'text-success-600 dark:text-success-400 font-medium' 
                          : 'text-danger-600 dark:text-danger-400 font-medium'
                        }>
                          {systemHealth.services.database.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Latency</span>
                        <span className="font-medium text-gray-900 dark:text-white">{systemHealth.services.database.latencyMs}ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">🌐 API</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status</span>
                        <span className="text-success-600 dark:text-success-400 font-medium">
                          {systemHealth.services.api.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Version</span>
                        <span className="font-medium text-gray-900 dark:text-white">{systemHealth.services.api.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Response Time</span>
                        <span className="font-medium text-gray-900 dark:text-white">{systemHealth.responseTimeMs}ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📊 System Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{systemHealth.metrics.activeUsers}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{systemHealth.metrics.totalIncidents}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{systemHealth.metrics.totalRCAs}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">RCA Analyses</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{systemHealth.metrics.activeSessions}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</p>
                    </div>
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">💾 Memory Usage</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{systemHealth.memory.heapUsed}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Heap Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{systemHealth.memory.heapTotal}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Heap Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{systemHealth.memory.rss}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">RSS</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex flex-wrap gap-4">
                    <select
                      value={auditFilters.entity}
                      onChange={(e) => {
                        setAuditFilters({ ...auditFilters, entity: e.target.value });
                        setAuditPagination({ ...auditPagination, page: 1 });
                      }}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Entities</option>
                      <option value="User">User</option>
                      <option value="Incident">Incident</option>
                      <option value="RCAAnalysis">RCA Analysis</option>
                      <option value="CAPAction">CAPA Action</option>
                      <option value="Organization">Organization</option>
                    </select>
                    <select
                      value={auditFilters.action}
                      onChange={(e) => {
                        setAuditFilters({ ...auditFilters, action: e.target.value });
                        setAuditPagination({ ...auditPagination, page: 1 });
                      }}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Actions</option>
                      <option value="CREATE">Create</option>
                      <option value="UPDATE">Update</option>
                      <option value="DELETE">Delete</option>
                      <option value="LOGIN">Login</option>
                      <option value="LOGOUT">Logout</option>
                      <option value="EXPORT">Export</option>
                      <option value="VIEW">View</option>
                    </select>
                  </div>
                </div>

                {/* Audit Logs Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.action === 'CREATE' ? 'bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-300' :
                              log.action === 'UPDATE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                              log.action === 'DELETE' ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-300' :
                              log.action === 'LOGIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {log.entity}
                            {log.entityId && (
                              <span className="text-gray-400 dark:text-gray-500 ml-1">#{log.entityId.slice(0, 8)}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId?.slice(0, 8) || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {log.changes ? JSON.stringify(log.changes).slice(0, 50) : '-'}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            No audit logs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {auditPagination.pages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing page {auditPagination.page} of {auditPagination.pages}
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setAuditPagination({ ...auditPagination, page: auditPagination.page - 1 })}
                          disabled={auditPagination.page === 1}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setAuditPagination({ ...auditPagination, page: auditPagination.page + 1 })}
                          disabled={auditPagination.page === auditPagination.pages}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Regulatory Readiness Tab */}
            {activeTab === 'regulatory' && (
              <div className="space-y-6">
                {/* Regulation Type & Facility Selector */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="font-medium text-gray-700 dark:text-gray-300">Regulation:</label>
                      <select
                        value={regulationType}
                        onChange={(e) => setRegulationType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="FSMA">FSMA (Food Safety Modernization Act)</option>
                        <option value="HACCP">HACCP</option>
                        <option value="FDA">FDA</option>
                        <option value="OSHA">OSHA</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="font-medium text-gray-700 dark:text-gray-300">Scope:</label>
                      <select
                        value={selectedFacility}
                        onChange={(e) => setSelectedFacility(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]"
                      >
                        <option value="all">🏢 All Facilities (Organization)</option>
                        {Array.isArray(facilities) && facilities.map((facility) => (
                          <option key={facility.id} value={facility.id}>
                            🏭 {facility.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {regulatoryCheck?.scope && (
                      <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                        {regulatoryCheck.scope.type === 'facility' 
                          ? `📍 Viewing: ${regulatoryCheck.scope.facilityName}`
                          : `📊 Aggregated across ${regulatoryCheck.scope.totalFacilities} facility(ies)`
                        }
                      </div>
                    )}
                  </div>
                </div>

                {regulatoryCheck && (
                  <>
                    {/* Tracking Not Started State */}
                    {regulatoryCheck.trackingStatus === 'not_started' && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <div className="max-w-md mx-auto">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-4xl">📊</span>
                          </div>
                          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {regulatoryCheck.regulationType} Compliance Tracking
                          </h2>
                          <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {regulatoryCheck.message || 'Start tracking to monitor your regulatory compliance readiness. Scores are calculated based on a 30-day rolling window.'}
                          </p>
                          <button
                            onClick={handleStartTracking}
                            disabled={trackingAction === 'starting'}
                            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            {trackingAction === 'starting' ? '⏳ Starting...' : '▶️ Start Tracking'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active Tracking - Show Score and Data */}
                    {regulatoryCheck.trackingStatus !== 'not_started' && regulatoryCheck.readinessScore !== null && (
                      <>
                        {/* Tracking Status Bar */}
                        {regulatoryCheck.tracking && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center space-x-3">
                                <span className={`w-3 h-3 rounded-full ${
                                  regulatoryCheck.tracking.status === 'active' ? 'bg-success-500 animate-pulse' : 'bg-gray-400'
                                }`}></span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {regulatoryCheck.tracking.status === 'active' ? 'Tracking Active' : 'Tracking Paused'}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  Started: {new Date(regulatoryCheck.tracking.startDate).toLocaleDateString()}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  • Day {regulatoryCheck.tracking.daysActive} of {regulatoryCheck.tracking.windowDays}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={handleViewHistory}
                                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                                >
                                  📜 {showHistory ? 'Hide' : 'View'} History
                                </button>
                                <button
                                  onClick={handleResetTracking}
                                  disabled={trackingAction === 'resetting'}
                                  className="px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {trackingAction === 'resetting' ? '⏳ Resetting...' : '🔄 Reset Tracking'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Historical Snapshots */}
                        {showHistory && trackingHistory.length > 0 && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📅 Historical Performance</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                              {trackingHistory.map((snapshot) => (
                                <div key={snapshot.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{snapshot.periodLabel}</p>
                                  <p className={`text-2xl font-bold ${
                                    snapshot.readinessLevel === 'EXCELLENT' ? 'text-success-600 dark:text-success-400' :
                                    snapshot.readinessLevel === 'GOOD' ? 'text-blue-600 dark:text-blue-400' :
                                    snapshot.readinessLevel === 'FAIR' ? 'text-warning-600 dark:text-warning-400' :
                                    'text-danger-600 dark:text-danger-400'
                                  }`}>{snapshot.readinessScore.toFixed(0)}%</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">{snapshot.totalIncidents} incidents</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {showHistory && trackingHistory.length === 0 && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                            <p className="text-gray-500 dark:text-gray-400">No historical snapshots yet. History is created when you reset tracking.</p>
                          </div>
                        )}

                        {/* Readiness Score */}
                        <div className={`p-6 rounded-lg border ${
                          regulatoryCheck.readinessLevel === 'EXCELLENT' ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800' :
                          regulatoryCheck.readinessLevel === 'GOOD' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                          regulatoryCheck.readinessLevel === 'FAIR' ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800' :
                          'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {regulatoryCheck.regulationType} Readiness Score: {regulatoryCheck.readinessScore}%
                              </h2>
                              <p className={`text-lg font-medium ${
                                regulatoryCheck.readinessLevel === 'EXCELLENT' ? 'text-success-600 dark:text-success-400' :
                                regulatoryCheck.readinessLevel === 'GOOD' ? 'text-blue-600 dark:text-blue-400' :
                                regulatoryCheck.readinessLevel === 'FAIR' ? 'text-warning-600 dark:text-warning-400' :
                                'text-danger-600 dark:text-danger-400'
                              }`}>
                                {regulatoryCheck.readinessLevel}
                              </p>
                              {regulatoryCheck.regulationName && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {regulatoryCheck.regulationName}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="w-24 h-24 rounded-full border-8 flex items-center justify-center" style={{
                                borderColor: regulatoryCheck.readinessLevel === 'EXCELLENT' ? '#22c55e' :
                                  regulatoryCheck.readinessLevel === 'GOOD' ? '#3b82f6' :
                                  regulatoryCheck.readinessLevel === 'FAIR' ? '#eab308' : '#ef4444'
                              }}>
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">{regulatoryCheck.readinessScore}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Summary Metrics */}
                        {regulatoryCheck.summary && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
                              <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">{regulatoryCheck.summary.openCriticalIncidents}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Critical Incidents Open</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
                              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{regulatoryCheck.summary.pendingRegulatoryActions}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Regulatory Actions</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{regulatoryCheck.summary.rcaValidationRate}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">RCA Validation Rate</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 text-center">
                              <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{regulatoryCheck.summary.slaBreaches}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">SLA Breaches</p>
                            </div>
                          </div>
                        )}

                        {/* Detailed Metrics (Expandable) */}
                        {regulatoryCheck.detailedMetrics && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📊 Detailed Compliance Metrics</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* RCA Metrics */}
                              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Root Cause Analysis</h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Completed</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.rca.completed}/{regulatoryCheck.detailedMetrics.rca.total}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Validated</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.rca.validated}/{regulatoryCheck.detailedMetrics.rca.total}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Validation Rate</span>
                                    <span className={`font-medium ${
                                      parseFloat(regulatoryCheck.detailedMetrics.rca.validationRate) >= 90 
                                    ? 'text-success-600 dark:text-success-400' 
                                    : 'text-warning-600 dark:text-warning-400'
                                }`}>{regulatoryCheck.detailedMetrics.rca.validationRate}%</span>
                              </div>
                            </div>
                          </div>

                          {/* CAPA Metrics */}
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CAPA Actions</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Completed</span>
                                <span className="font-medium text-success-600 dark:text-success-400">{regulatoryCheck.detailedMetrics.capa.completed}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Pending</span>
                                <span className="font-medium text-warning-600 dark:text-warning-400">{regulatoryCheck.detailedMetrics.capa.pending}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Overdue</span>
                                <span className={`font-medium ${
                                  regulatoryCheck.detailedMetrics.capa.overdue === 0 
                                    ? 'text-success-600 dark:text-success-400' 
                                    : 'text-danger-600 dark:text-danger-400'
                                }`}>{regulatoryCheck.detailedMetrics.capa.overdue}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Evidence Rate</span>
                                <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.capa.evidenceRate}%</span>
                              </div>
                            </div>
                          </div>

                          {/* FMIR Metrics (for food safety regulations) */}
                          {['FSMA', 'HACCP', 'FDA'].includes(regulatoryCheck.regulationType) && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">FMIR Reports</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.fmir.total}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Closed</span>
                                  <span className="font-medium text-success-600 dark:text-success-400">{regulatoryCheck.detailedMetrics.fmir.closed}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">With Evidence</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.fmir.withEvidence}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Audit Passed</span>
                                  <span className="font-medium text-success-600 dark:text-success-400">{regulatoryCheck.detailedMetrics.fmir.auditPassed}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Evidence Coverage */}
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Evidence Coverage</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">With Evidence</span>
                                <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.evidence.incidentsWithEvidence}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Total Incidents</span>
                                <span className="font-medium text-gray-900 dark:text-white">{regulatoryCheck.detailedMetrics.evidence.totalIncidents}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Coverage Rate</span>
                                <span className={`font-medium ${
                                  parseFloat(regulatoryCheck.detailedMetrics.evidence.coverageRate) >= 80 
                                    ? 'text-success-600 dark:text-success-400' 
                                    : 'text-warning-600 dark:text-warning-400'
                                }`}>{regulatoryCheck.detailedMetrics.evidence.coverageRate}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compliance Checklist */}
                    {regulatoryCheck.checklist && regulatoryCheck.checklist.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📋 Compliance Checklist</h3>
                        <div className="space-y-3">
                          {regulatoryCheck.checklist.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-xl">
                                  {item.status ? '✅' : '❌'}
                                </span>
                                <span className={`${item.status ? 'text-gray-700 dark:text-gray-300' : 'text-danger-700 dark:text-danger-300'}`}>
                                  {item.item}
                                </span>
                              </div>
                              {item.details && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 ml-9 mt-1">
                                  {item.details}
                                </p>
                              )}
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                                item.priority === 'HIGH' ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-800 dark:text-danger-300' :
                                item.priority === 'MEDIUM' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-300' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                              }`}>
                                {item.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Time Window Info */}
                    {regulatoryCheck.timeWindow && (
                      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Data from: {new Date(regulatoryCheck.timeWindow.start).toLocaleDateString()} - {new Date(regulatoryCheck.timeWindow.end).toLocaleDateString()}
                      </div>
                    )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Key Results Tab */}
            {activeTab === 'keyresults' && (
              <div className="space-y-6">
                {/* SYSTEM_ADMIN has no org - show message */}
                {user?.role === 'SYSTEM_ADMIN' ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
                      <span className="text-4xl">⚠️</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Organization Required</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Key Result Sets are organization-specific. Sign in as an organization admin to manage them.
                    </p>
                  </div>
                ) : (
                <>
                {/* Header + Add Button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Key Result Sets</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Configure key result metric groups that appear on every user&apos;s LSW board.
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowNewSetForm(true); setNewSetForm({ name: '', scope: 'PLANT', description: '', icon: '' }); }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>＋</span>
                    <span>New Set</span>
                  </button>
                </div>

                {/* New Set Form */}
                {showNewSetForm && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-purple-300 dark:border-purple-600 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create Key Result Set</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                        <input
                          type="text"
                          value={newSetForm.name}
                          onChange={(e) => setNewSetForm({ ...newSetForm, name: e.target.value })}
                          placeholder='e.g. "Plant Metrics", "Corporate Metrics"'
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
                        <select
                          value={newSetForm.scope}
                          onChange={(e) => setNewSetForm({ ...newSetForm, scope: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="PLANT">🏭 Plant</option>
                          <option value="CORPORATE">🏢 Corporate</option>
                          <option value="DEPARTMENT">🏬 Department</option>
                          <option value="CUSTOM">⚙️ Custom</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <input
                          type="text"
                          value={newSetForm.description}
                          onChange={(e) => setNewSetForm({ ...newSetForm, description: e.target.value })}
                          placeholder="Optional description"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
                        <input
                          type="text"
                          value={newSetForm.icon}
                          onChange={(e) => setNewSetForm({ ...newSetForm, icon: e.target.value })}
                          placeholder="e.g. 📊 or 🏭"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-4">
                      <button
                        onClick={() => setShowNewSetForm(false)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!newSetForm.name.trim()) return;
                          setKrSaving(true);
                          try {
                            const created = await createLswKeyResultSet({
                              name: newSetForm.name.trim(),
                              scope: newSetForm.scope,
                              description: newSetForm.description.trim() || undefined,
                              icon: newSetForm.icon.trim() || undefined,
                            });
                            setKeyResultSets([...keyResultSets, created]);
                            setShowNewSetForm(false);
                            setExpandedSetId(created.id);
                          } catch (err: any) {
                            setError(err.message || 'Failed to create key result set');
                          } finally {
                            setKrSaving(false);
                          }
                        }}
                        disabled={!newSetForm.name.trim() || krSaving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {krSaving ? 'Creating...' : 'Create Set'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Key Result Sets List */}
                {krLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : keyResultSets.length === 0 && !showNewSetForm ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <span className="text-4xl">🎯</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Key Result Sets</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Create key result sets to define the metrics that appear on your organization&apos;s LSW boards.
                    </p>
                    <button
                      onClick={() => { setShowNewSetForm(true); setNewSetForm({ name: '', scope: 'PLANT', description: '', icon: '' }); }}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                      ＋ Create First Set
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {keyResultSets.map((set) => (
                      <div key={set.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Set Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                          onClick={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-xl">{set.icon || '📊'}</span>
                            {editingSetId === set.id ? (
                              <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editSetForm.name}
                                  onChange={(e) => setEditSetForm({ ...editSetForm, name: e.target.value })}
                                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  autoFocus
                                />
                                <select
                                  value={editSetForm.scope}
                                  onChange={(e) => setEditSetForm({ ...editSetForm, scope: e.target.value as any })}
                                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                >
                                  <option value="PLANT">Plant</option>
                                  <option value="CORPORATE">Corporate</option>
                                  <option value="DEPARTMENT">Department</option>
                                  <option value="CUSTOM">Custom</option>
                                </select>
                                <input
                                  type="text"
                                  value={editSetForm.icon}
                                  onChange={(e) => setEditSetForm({ ...editSetForm, icon: e.target.value })}
                                  placeholder="Icon"
                                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-16"
                                />
                                <button
                                  onClick={async () => {
                                    setKrSaving(true);
                                    try {
                                      const updated = await updateLswKeyResultSet(set.id, {
                                        name: editSetForm.name.trim(),
                                        scope: editSetForm.scope,
                                        description: editSetForm.description.trim() || undefined,
                                        icon: editSetForm.icon.trim() || undefined,
                                      } as any);
                                      setKeyResultSets(keyResultSets.map(s => s.id === set.id ? updated : s));
                                      setEditingSetId(null);
                                    } catch (err: any) {
                                      setError(err.message || 'Failed to update set');
                                    } finally {
                                      setKrSaving(false);
                                    }
                                  }}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingSetId(null)}
                                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{set.name}</h3>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    set.scope === 'PLANT' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                    set.scope === 'CORPORATE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                                    set.scope === 'DEPARTMENT' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                                    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {set.scope}
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {set.keyResults.length} metric{set.keyResults.length !== 1 ? 's' : ''}
                                  </span>
                                  {set.description && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">• {set.description}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingSetId(set.id);
                                setEditSetForm({ name: set.name, scope: set.scope, description: set.description || '', icon: set.icon || '' });
                              }}
                              className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              title="Edit set"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete "${set.name}" and all its metrics?`)) return;
                                try {
                                  await deleteLswKeyResultSet(set.id);
                                  setKeyResultSets(keyResultSets.filter(s => s.id !== set.id));
                                } catch (err: any) {
                                  setError(err.message || 'Failed to delete set');
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Delete set"
                            >
                              🗑️
                            </button>
                            <span className={`text-gray-400 transition-transform ${expandedSetId === set.id ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* Expanded Content: Key Results */}
                        {expandedSetId === set.id && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                            {/* Key Results Table */}
                            {set.keyResults.length > 0 && (
                              <table className="min-w-full mb-4">
                                <thead>
                                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    <th className="pb-2 pr-4">Metric</th>
                                    <th className="pb-2 pr-4">Value</th>
                                    <th className="pb-2 pr-4">Target</th>
                                    <th className="pb-2 pr-4">Trend</th>
                                    <th className="pb-2 w-20">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                  {set.keyResults.map((kr) => (
                                    <tr key={kr.id}>
                                      {editingKrId === kr.id ? (
                                        <>
                                          <td className="py-2 pr-4">
                                            <input
                                              type="text"
                                              value={editKrForm.metric}
                                              onChange={(e) => setEditKrForm({ ...editKrForm, metric: e.target.value })}
                                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                            />
                                          </td>
                                          <td className="py-2 pr-4">
                                            <input
                                              type="text"
                                              value={editKrForm.value}
                                              onChange={(e) => setEditKrForm({ ...editKrForm, value: e.target.value })}
                                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                            />
                                          </td>
                                          <td className="py-2 pr-4">
                                            <input
                                              type="text"
                                              value={editKrForm.target}
                                              onChange={(e) => setEditKrForm({ ...editKrForm, target: e.target.value })}
                                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                            />
                                          </td>
                                          <td className="py-2 pr-4">
                                            <select
                                              value={editKrForm.trend}
                                              onChange={(e) => setEditKrForm({ ...editKrForm, trend: e.target.value as any })}
                                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                            >
                                              <option value="">None</option>
                                              <option value="UP">↑ Up</option>
                                              <option value="DOWN">↓ Down</option>
                                              <option value="STABLE">→ Stable</option>
                                            </select>
                                          </td>
                                          <td className="py-2">
                                            <div className="flex space-x-1">
                                              <button
                                                onClick={async () => {
                                                  setKrSaving(true);
                                                  try {
                                                    const updated = await updateLswKeyResult(kr.id, {
                                                      metric: editKrForm.metric.trim(),
                                                      value: editKrForm.value.trim(),
                                                      target: editKrForm.target.trim() || undefined,
                                                      trend: editKrForm.trend || undefined,
                                                    } as any);
                                                    setKeyResultSets(keyResultSets.map(s => s.id === set.id ? {
                                                      ...s,
                                                      keyResults: s.keyResults.map(k => k.id === kr.id ? updated : k),
                                                    } : s));
                                                    setEditingKrId(null);
                                                  } catch (err: any) {
                                                    setError(err.message || 'Failed to update metric');
                                                  } finally {
                                                    setKrSaving(false);
                                                  }
                                                }}
                                                className="px-2 py-1 bg-purple-600 text-white rounded text-xs"
                                              >
                                                ✓
                                              </button>
                                              <button
                                                onClick={() => setEditingKrId(null)}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="py-2 pr-4 text-sm text-gray-900 dark:text-white font-medium">{kr.metric}</td>
                                          <td className="py-2 pr-4 text-sm text-gray-700 dark:text-gray-300">{kr.value}</td>
                                          <td className="py-2 pr-4 text-sm text-gray-500 dark:text-gray-400">{kr.target || '—'}</td>
                                          <td className="py-2 pr-4">
                                            {kr.trend && (
                                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                kr.trend === 'UP' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                                kr.trend === 'DOWN' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                              }`}>
                                                {kr.trend === 'UP' ? '↑ Up' : kr.trend === 'DOWN' ? '↓ Down' : '→ Stable'}
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2">
                                            <div className="flex space-x-1">
                                              <button
                                                onClick={() => {
                                                  setEditingKrId(kr.id);
                                                  setEditKrForm({ metric: kr.metric, value: kr.value, target: kr.target || '', trend: (kr.trend || '') as any });
                                                }}
                                                className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 text-xs"
                                              >
                                                ✏️
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (!confirm(`Delete metric "${kr.metric}"?`)) return;
                                                  try {
                                                    await deleteLswKeyResult(kr.id);
                                                    setKeyResultSets(keyResultSets.map(s => s.id === set.id ? {
                                                      ...s,
                                                      keyResults: s.keyResults.filter(k => k.id !== kr.id),
                                                    } : s));
                                                  } catch (err: any) {
                                                    setError(err.message || 'Failed to delete metric');
                                                  }
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-xs"
                                              >
                                                🗑️
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {set.keyResults.length === 0 && !showNewKrForm && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-4">No metrics added yet.</p>
                            )}

                            {/* Add Key Result Form */}
                            {showNewKrForm === set.id ? (
                              <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <div className="flex-1 min-w-[140px]">
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Metric *</label>
                                  <input
                                    type="text"
                                    value={newKrForm.metric}
                                    onChange={(e) => setNewKrForm({ ...newKrForm, metric: e.target.value })}
                                    placeholder='e.g. "TCIR", "Net Sales"'
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    autoFocus
                                  />
                                </div>
                                <div className="w-28">
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value *</label>
                                  <input
                                    type="text"
                                    value={newKrForm.value}
                                    onChange={(e) => setNewKrForm({ ...newKrForm, value: e.target.value })}
                                    placeholder='e.g. "0.45"'
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  />
                                </div>
                                <div className="w-28">
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target</label>
                                  <input
                                    type="text"
                                    value={newKrForm.target}
                                    onChange={(e) => setNewKrForm({ ...newKrForm, target: e.target.value })}
                                    placeholder='e.g. "< 1.0"'
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  />
                                </div>
                                <div className="w-28">
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trend</label>
                                  <select
                                    value={newKrForm.trend}
                                    onChange={(e) => setNewKrForm({ ...newKrForm, trend: e.target.value as any })}
                                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  >
                                    <option value="">None</option>
                                    <option value="UP">↑ Up</option>
                                    <option value="DOWN">↓ Down</option>
                                    <option value="STABLE">→ Stable</option>
                                  </select>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={async () => {
                                      if (!newKrForm.metric.trim() || !newKrForm.value.trim()) return;
                                      setKrSaving(true);
                                      try {
                                        const created = await createLswKeyResult({
                                          keyResultSetId: set.id,
                                          metric: newKrForm.metric.trim(),
                                          value: newKrForm.value.trim(),
                                          target: newKrForm.target.trim() || undefined,
                                          trend: newKrForm.trend || undefined,
                                        });
                                        setKeyResultSets(keyResultSets.map(s => s.id === set.id ? {
                                          ...s,
                                          keyResults: [...s.keyResults, created],
                                        } : s));
                                        setNewKrForm({ metric: '', value: '', target: '', trend: '' });
                                      } catch (err: any) {
                                        setError(err.message || 'Failed to add metric');
                                      } finally {
                                        setKrSaving(false);
                                      }
                                    }}
                                    disabled={!newKrForm.metric.trim() || !newKrForm.value.trim() || krSaving}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                                  >
                                    {krSaving ? '...' : 'Add'}
                                  </button>
                                  <button
                                    onClick={() => { setShowNewKrForm(null); setNewKrForm({ metric: '', value: '', target: '', trend: '' }); }}
                                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setShowNewKrForm(set.id); setNewKrForm({ metric: '', value: '', target: '', trend: '' }); }}
                                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                              >
                                ＋ Add Metric
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function EnterpriseAdminPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <EnterpriseAdminContent />
    </ProtectedRoute>
  );
}

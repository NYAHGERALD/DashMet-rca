'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Image from 'next/image';
import { formatDateTime, formatDate } from '@/lib/dateUtils';

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
  readinessScore: string;
  readinessLevel: string;
  summary: {
    openCriticalIncidents: number;
    pendingRegulatoryActions: number;
    rcaValidationRate: string;
    slaBreaches: number;
  };
  checklist: Array<{ item: string; status: boolean; priority: string }>;
}

function EnterpriseAdminContent() {
  const { user, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'health' | 'audit' | 'regulatory'>('health');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // State for each section
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [regulatoryCheck, setRegulatoryCheck] = useState<RegulatoryCheck | null>(null);

  // Filters
  const [auditFilters, setAuditFilters] = useState({ entity: '', action: '' });
  const [regulationType, setRegulationType] = useState('FSMA');

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
            const regRes = await fetch(`${apiUrl}/admin/regulatory-check?regulationType=${regulationType}`, { headers });
            if (!regRes.ok) throw new Error('Failed to fetch regulatory check');
            const regData = await regRes.json();
            setRegulatoryCheck(regData.data);
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
  }, [activeTab, auditPagination.page, auditFilters, regulationType, getIdToken, apiUrl]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
              <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                ← Back
              </Link>
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
                {/* Regulation Type Selector */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center space-x-4">
                    <label className="font-medium text-gray-700 dark:text-gray-300">Regulation Type:</label>
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
                </div>

                {regulatoryCheck && (
                  <>
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

                    {/* Compliance Checklist */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">📋 Compliance Checklist</h3>
                      <div className="space-y-3">
                        {regulatoryCheck.checklist.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">
                                {item.status ? '✅' : '❌'}
                              </span>
                              <span className={`${item.status ? 'text-gray-700 dark:text-gray-300' : 'text-danger-700 dark:text-danger-300'}`}>
                                {item.item}
                              </span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
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

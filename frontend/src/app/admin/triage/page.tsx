'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';

interface AssignmentRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  incidentType?: string;
  categoryId?: string;
  facilityId?: string;
  areaId?: string;
  severity?: string;
  assignToUserId?: string;
  assignToRole?: string;
  slaResponseHours?: number;
  slaResolutionHours?: number;
}

interface SLAConfig {
  id: string;
  severity: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  escalationEnabled: boolean;
  escalationAfterHours?: number;
  escalationToRole?: string;
}

interface SLADashboard {
  breachedResponse: number;
  breachedResolution: number;
  atRiskResponse: number;
  atRiskResolution: number;
  onTrack: number;
  total: number;
}

export default function TriageManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rules' | 'sla' | 'dashboard'>('dashboard');
  
  // Assignment Rules state
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  
  // SLA Config state
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [loadingSLA, setLoadingSLA] = useState(true);
  
  // Dashboard state
  const [dashboard, setDashboard] = useState<SLADashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRules();
    } else if (activeTab === 'sla') {
      loadSLAConfig();
    } else if (activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [activeTab]);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const response = await api.get('/triage/assignment-rules');
      setRules(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assignment rules');
    } finally {
      setLoadingRules(false);
    }
  };

  const loadSLAConfig = async () => {
    setLoadingSLA(true);
    try {
      const response = await api.get('/triage/sla-config');
      setSlaConfigs(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load SLA configuration');
    } finally {
      setLoadingSLA(false);
    }
  };

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const response = await api.get('/triage/sla-dashboard');
      setDashboard(response.data.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load SLA dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  };

  const seedDefaultSLA = async () => {
    try {
      await api.post('/triage/sla-config/seed');
      setSuccess('Default SLA configuration seeded successfully');
      loadSLAConfig();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to seed SLA configuration');
    }
  };

  const toggleRuleActive = async (rule: AssignmentRule) => {
    try {
      await api.patch(`/triage/assignment-rules/${rule.id}`, {
        isActive: !rule.isActive,
      });
      setRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      );
      setSuccess(`Rule "${rule.name}" ${rule.isActive ? 'disabled' : 'enabled'}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update rule');
    }
  };

  const deleteRule = async (rule: AssignmentRule) => {
    if (!confirm(`Are you sure you want to delete rule "${rule.name}"?`)) return;
    
    try {
      await api.delete(`/triage/assignment-rules/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      setSuccess(`Rule "${rule.name}" deleted`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete rule');
    }
  };

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  return (
    <ProtectedRoute allowedRoles={['CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Triage & Auto-Assignment Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure assignment rules, SLA settings, and monitor triage status
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button onClick={() => setError('')} className="text-sm underline mt-1">Dismiss</button>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200">{success}</p>
              <button onClick={() => setSuccess('')} className="text-sm underline mt-1">Dismiss</button>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
            <div className="border-b border-gray-200 dark:border-slate-700">
              <nav className="flex -mb-px">
                {[
                  { id: 'dashboard', label: 'SLA Dashboard', icon: '📊' },
                  { id: 'rules', label: 'Assignment Rules', icon: '⚙️' },
                  { id: 'sla', label: 'SLA Configuration', icon: '⏰' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div>
                  {loadingDashboard ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : dashboard ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                          {dashboard.breachedResponse + dashboard.breachedResolution}
                        </div>
                        <div className="text-sm text-red-700 dark:text-red-300">SLA Breached</div>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                          {dashboard.atRiskResponse + dashboard.atRiskResolution}
                        </div>
                        <div className="text-sm text-orange-700 dark:text-orange-300">At Risk</div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {dashboard.onTrack}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">On Track</div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                          {dashboard.total}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">Total Active</div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {dashboard.total > 0 ? Math.round((dashboard.onTrack / dashboard.total) * 100) : 100}%
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">Compliance Rate</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No data available</div>
                  )}

                  <div className="mt-8">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                    <div className="flex gap-4">
                      <Link
                        href="/admin/triage/needing-triage"
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        View Incidents Needing Triage
                      </Link>
                      <button
                        onClick={() => api.post('/triage/check-sla-breaches').then(() => {
                          setSuccess('SLA breach check completed');
                          loadDashboard();
                        })}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Check SLA Breaches
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Rules Tab */}
              {activeTab === 'rules' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Assignment Rules</h3>
                    <Link
                      href="/admin/triage/rules/new"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      + Create Rule
                    </Link>
                  </div>

                  {loadingRules ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : rules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No assignment rules configured yet.</p>
                      <p className="text-sm mt-2">Create rules to automatically assign incidents based on type, category, or severity.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rules.map(rule => (
                        <div
                          key={rule.id}
                          className={`p-4 rounded-lg border ${
                            rule.isActive
                              ? 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                              : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">{rule.name}</h4>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300">
                                  Priority: {rule.priority}
                                </span>
                              </div>
                              {rule.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rule.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {rule.incidentType && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    Type: {rule.incidentType}
                                  </span>
                                )}
                                {rule.severity && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                    Severity: {rule.severity}
                                  </span>
                                )}
                                {rule.assignToRole && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                    Assign to: {rule.assignToRole}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleRuleActive(rule)}
                                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                  rule.isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-600 dark:text-gray-400'
                                }`}
                              >
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </button>
                              <Link
                                href={`/admin/triage/rules/${rule.id}`}
                                className="px-3 py-1 text-sm bg-gray-100 dark:bg-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => deleteRule(rule)}
                                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SLA Configuration Tab */}
              {activeTab === 'sla' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">SLA Configuration by Severity</h3>
                    <button
                      onClick={seedDefaultSLA}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Seed Default SLA
                    </button>
                  </div>

                  {loadingSLA ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : slaConfigs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No SLA configuration found.</p>
                      <p className="text-sm mt-2">Click "Seed Default SLA" to create default configurations.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(severity => {
                        const config = slaConfigs.find(c => c.severity === severity);
                        const bgColors: Record<string, string> = {
                          CRITICAL: 'border-red-500 bg-red-50 dark:bg-red-900/20',
                          HIGH: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
                          MEDIUM: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
                          LOW: 'border-green-500 bg-green-50 dark:bg-green-900/20',
                        };
                        
                        return (
                          <div key={severity} className={`p-4 rounded-lg border-l-4 ${bgColors[severity]}`}>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{severity}</h4>
                            {config ? (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Response:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {formatHours(config.responseTimeHours)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Resolution:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {formatHours(config.resolutionTimeHours)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Escalation:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {config.escalationEnabled ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Not configured</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

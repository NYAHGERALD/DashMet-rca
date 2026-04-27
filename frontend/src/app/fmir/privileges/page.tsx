'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import { 
  Users, 
  Lock, 
  Unlock, 
  ChevronDown, 
  ChevronRight,
  Search,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Settings,
  Eye,
  Edit,
  Trash2,
  Play,
  Download,
  UserCheck,
  Filter,
  LayoutGrid,
  List,
  History,
  Clock,
  Undo2,
  RefreshCw,
  Bell,
  Calendar,
} from 'lucide-react';

// Types
interface PrivilegeDefinition {
  key: string;
  module: string;
  action: string;
  displayName: string;
  description: string;
  category: string;
  sortOrder: number;
  defaultRoles: string[];
}

interface PrivilegeMatrix {
  [role: string]: {
    [key: string]: boolean;
  };
}

interface AuditLog {
  id: string;
  role: string;
  module: string;
  featureKey: string;
  action: string;
  displayName: string;
  previousValue: boolean;
  newValue: boolean;
  changeType: string;
  changedById: string;
  changedByName: string;
  changedByRole: string;
  changedAt: string;
  isReverted: boolean;
  revertedAt: string | null;
  revertedByName: string | null;
  description: string;
}

// Role display configuration
const ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  OPERATOR: { 
    label: 'Operator', 
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    description: 'Basic operational user with limited access'
  },
  SUPERVISOR: { 
    label: 'Supervisor', 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Team lead with supervision capabilities'
  },
  QA_FOOD_SAFETY: { 
    label: 'QA / Food Safety', 
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Quality assurance and food safety specialist'
  },
  QUALITY_CONTROL_MANAGER: { 
    label: 'Quality Control Manager', 
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Quality control oversight with FMIR management'
  },
  MAINTENANCE_ENGINEERING: { 
    label: 'Maintenance / Engineering', 
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Maintenance and engineering specialist'
  },
  SAFETY_SECURITY_MANAGER: { 
    label: 'Safety & Security Manager', 
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    description: 'Safety and security oversight'
  },
  CI_MANAGER: { 
    label: 'CI Manager', 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Continuous improvement manager'
  },
  ADMIN: { 
    label: 'Admin', 
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Organization administrator'
  },
};

// Action icons
const ACTION_ICONS: Record<string, React.ReactNode> = {
  VIEW: <Eye className="w-3 h-3" />,
  CREATE: <Edit className="w-3 h-3" />,
  EDIT: <Settings className="w-3 h-3" />,
  DELETE: <Trash2 className="w-3 h-3" />,
  MANAGE: <Users className="w-3 h-3" />,
  APPROVE: <UserCheck className="w-3 h-3" />,
  EXECUTE: <Play className="w-3 h-3" />,
  EXPORT: <Download className="w-3 h-3" />,
};

// FMIR category icons
const CATEGORY_ICONS: Record<string, string> = {
  'Foreign Material': '⚠️',
};

function FMIRPrivilegesContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Data state
  const [definitions, setDefinitions] = useState<PrivilegeDefinition[]>([]);
  const [matrix, setMatrix] = useState<PrivilegeMatrix>({});
  const [groupedDefinitions, setGroupedDefinitions] = useState<Record<string, PrivilegeDefinition[]>>({});
  
  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  
  // Audit log filter state
  const [logFilterRevert, setLogFilterRevert] = useState<'all' | 'reverted' | 'active'>('all');
  const [logFilterType, setLogFilterType] = useState<'all' | 'enable' | 'disable' | 'revert'>('all');
  const [logFilterDateFrom, setLogFilterDateFrom] = useState<string>('');
  const [logFilterDateTo, setLogFilterDateTo] = useState<string>('');
  
  // UI state
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'role' | 'matrix' | 'logs'>('role');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Real-time notification state
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Available roles (excluding SYSTEM_ADMIN)
  const editableRoles = Object.keys(ROLE_CONFIG);

  // Setup WebSocket connection for real-time sync
  useEffect(() => {
    if (!user?.organizationId) return;

    let cancelled = false;

    const setupSocket = async () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5002';

      if (cancelled) return;
      
      socketRef.current = io(wsUrl, {
        withCredentials: true,
        auth: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      });

      socketRef.current.on('privilege:changed', (data: {
        role: string;
        featureKey: string;
        isEnabled: boolean;
        changedBy: string;
        changedAt: string;
        isRevert?: boolean;
      }) => {
        // Update the matrix in real-time
        setMatrix(prev => ({
          ...prev,
          [data.role]: {
            ...prev[data.role],
            [data.featureKey]: data.isEnabled,
          },
        }));

        // Show notification
        const action = data.isRevert ? 'reverted' : (data.isEnabled ? 'enabled' : 'disabled');
        setRealtimeNotification(`${data.changedBy} ${action} ${data.featureKey} for ${ROLE_CONFIG[data.role]?.label || data.role}`);
        
        // Refresh audit logs if viewing them
        if (viewMode === 'logs') {
          fetchAuditLogs();
        }

        // Clear notification after 5 seconds
        setTimeout(() => setRealtimeNotification(null), 5000);
      });
    };

    setupSocket();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [user?.id, user?.organizationId, viewMode]);

  // Fetch privilege data
  useEffect(() => {
    fetchPrivileges();
  }, []);

  const fetchPrivileges = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/privileges/fmir');
      if (response.data.success) {
        setMatrix(response.data.data.matrix);
        setDefinitions(response.data.data.definitions);
        
        // Group definitions by category
        const grouped = response.data.data.definitions.reduce((acc: Record<string, PrivilegeDefinition[]>, def: PrivilegeDefinition) => {
          if (!acc[def.category]) {
            acc[def.category] = [];
          }
          acc[def.category].push(def);
          return acc;
        }, {});
        setGroupedDefinitions(grouped);
        
        // Expand all categories
        setExpandedCategories(new Set(Object.keys(grouped)));
        
        // Select first editable role by default
        if (!selectedRole && editableRoles.length > 0) {
          setSelectedRole(editableRoles[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching FMIR privileges:', err);
      setError(err.response?.data?.error || 'Failed to load privilege settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await api.get('/privileges/audit-logs', {
        params: { limit: 100, module: 'FMIR' },
      });
      if (response.data.success) {
        setAuditLogs(response.data.data.logs);
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'logs') {
      fetchAuditLogs();
    }
  }, [viewMode, fetchAuditLogs]);

  // Filter definitions for matrix view
  const filteredDefinitions = useMemo(() => {
    return definitions.filter(def => {
      const matchesSearch = searchQuery === '' || 
        def.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.key.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAction = filterAction === '' || def.action === filterAction;
      
      // For status filter, check if any role has this privilege enabled/disabled
      let matchesStatus = true;
      if (filterStatus === 'enabled') {
        matchesStatus = editableRoles.some(role => matrix[role]?.[def.key] === true);
      } else if (filterStatus === 'disabled') {
        matchesStatus = editableRoles.every(role => !matrix[role]?.[def.key]);
      }
      
      return matchesSearch && matchesAction && matchesStatus;
    });
  }, [definitions, searchQuery, filterAction, filterStatus, matrix, editableRoles]);

  // Filter grouped definitions for role view
  const filteredGrouped = useMemo(() => {
    const result: Record<string, PrivilegeDefinition[]> = {};
    for (const [category, defs] of Object.entries(groupedDefinitions)) {
      const filtered = defs.filter(def => {
        const matchesSearch = searchQuery === '' || 
          def.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          def.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          def.key.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesAction = filterAction === '' || def.action === filterAction;
        
        // For status filter in role view, check against selected role
        let matchesStatus = true;
        if (selectedRole && filterStatus !== 'all') {
          const isEnabled = matrix[selectedRole]?.[def.key] === true;
          matchesStatus = filterStatus === 'enabled' ? isEnabled : !isEnabled;
        }
        
        return matchesSearch && matchesAction && matchesStatus;
      });
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }
    return result;
  }, [groupedDefinitions, searchQuery, filterAction, filterStatus, selectedRole, matrix]);

  // Clear all role/matrix filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterAction('');
    setFilterStatus('all');
  };

  // Check if any filter is active
  const hasActiveFilters = searchQuery !== '' || filterAction !== '' || filterStatus !== 'all';

  // Toggle a single privilege
  const togglePrivilege = async (role: string, featureKey: string, currentValue: boolean) => {
    const savingKey = `${role}:${featureKey}`;
    setSaving(savingKey);
    setError(null);
    
    try {
      const response = await api.put('/privileges/organization', {
        role,
        featureKey,
        isEnabled: !currentValue,
      });
      
      if (response.data.success) {
        // Update local state (WebSocket will also update, but this is faster)
        setMatrix(prev => ({
          ...prev,
          [role]: {
            ...prev[role],
            [featureKey]: !currentValue,
          },
        }));
        
        setSuccessMessage(`Updated ${featureKey} for ${ROLE_CONFIG[role]?.label || role}`);
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err: any) {
      console.error('Error updating privilege:', err);
      setError(err.response?.data?.error || 'Failed to update privilege');
    } finally {
      setSaving(null);
    }
  };

  // Revert a change from audit log
  const revertChange = async (logId: string) => {
    setReverting(logId);
    setError(null);
    
    try {
      const response = await api.post(`/privileges/audit-logs/${logId}/revert`);
      
      if (response.data.success) {
        setSuccessMessage(response.data.message);
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Refresh audit logs
        fetchAuditLogs();
      }
    } catch (err: any) {
      console.error('Error reverting change:', err);
      setError(err.response?.data?.error || 'Failed to revert change');
    } finally {
      setReverting(null);
    }
  };

  // Reset privileges for a role
  const handleResetRole = async () => {
    if (!selectedRole) return;
    
    setSaving('reset');
    setError(null);
    
    try {
      const response = await api.post('/privileges/organization/reset', {
        role: selectedRole,
      });
      
      if (response.data.success) {
        await fetchPrivileges();
        setSuccessMessage(`Privileges reset to defaults for ${ROLE_CONFIG[selectedRole]?.label || selectedRole}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('Error resetting privileges:', err);
      setError(err.response?.data?.error || 'Failed to reset privileges');
    } finally {
      setSaving(null);
      setShowResetConfirm(false);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Count enabled/total privileges for a role
  const getRoleStats = (role: string) => {
    const rolePrivs = matrix[role] || {};
    const enabled = Object.values(rolePrivs).filter(v => v).length;
    const total = definitions.length;
    return { enabled, total, percentage: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter audit logs based on selected filters
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Filter by revert status
      if (logFilterRevert === 'reverted' && !log.isReverted) return false;
      if (logFilterRevert === 'active' && log.isReverted) return false;
      
      // Filter by change type
      if (logFilterType !== 'all' && log.changeType !== logFilterType) return false;
      
      // Filter by date range
      if (logFilterDateFrom) {
        const logDate = new Date(log.changedAt);
        const fromDate = new Date(logFilterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (logDate < fromDate) return false;
      }
      if (logFilterDateTo) {
        const logDate = new Date(log.changedAt);
        const toDate = new Date(logFilterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) return false;
      }
      
      return true;
    });
  }, [auditLogs, logFilterRevert, logFilterType, logFilterDateFrom, logFilterDateTo]);

  // Clear all audit log filters
  const clearLogFilters = () => {
    setLogFilterRevert('all');
    setLogFilterType('all');
    setLogFilterDateFrom('');
    setLogFilterDateTo('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading FMIR privilege settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Real-time Notification */}
      {realtimeNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-primary-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Bell className="w-5 h-5" />
            <span className="text-sm">{realtimeNotification}</span>
            <button onClick={() => setRealtimeNotification(null)} className="ml-2 hover:bg-primary-700 rounded p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Foreign Material Privileges
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage FMIR access permissions for each role
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {viewMode === 'role' && selectedRole && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  disabled={saving === 'reset'}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                  title={`Reset ${ROLE_CONFIG[selectedRole]?.label || selectedRole} privileges to defaults`}
                >
                  {saving === 'reset' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Reset to Defaults
                </button>
              )}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('role')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'role'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                  By Role
                </button>
                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'matrix'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Matrix
                </button>
                <button
                  onClick={() => setViewMode('logs')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'logs'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Audit Log
                </button>
              </div>
              <button
                onClick={fetchPrivileges}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-green-700 dark:text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'logs' ? (
          /* ===================== AUDIT LOG VIEW ===================== */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Privilege Change History</h2>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-600 dark:text-gray-400">
                    {filteredAuditLogs.length} of {auditLogs.length} entries
                  </span>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Filters:</span>
                </div>
                
                {/* Revert Status Filter */}
                <select
                  value={logFilterRevert}
                  onChange={(e) => setLogFilterRevert(e.target.value as 'all' | 'reverted' | 'active')}
                  className="text-sm px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="reverted">Reverted Only</option>
                </select>
                
                {/* Change Type Filter */}
                <select
                  value={logFilterType}
                  onChange={(e) => setLogFilterType(e.target.value as 'all' | 'enable' | 'disable' | 'revert')}
                  className="text-sm px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Types</option>
                  <option value="enable">Enabled</option>
                  <option value="disable">Disabled</option>
                  <option value="revert">Reverted</option>
                </select>
                
                {/* Date From */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={logFilterDateFrom}
                    onChange={(e) => setLogFilterDateFrom(e.target.value)}
                    className="text-sm px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="From"
                  />
                </div>
                
                {/* Date To */}
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={logFilterDateTo}
                    onChange={(e) => setLogFilterDateTo(e.target.value)}
                    className="text-sm px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="To"
                  />
                </div>
                
                {/* Clear Filters */}
                {(logFilterRevert !== 'all' || logFilterType !== 'all' || logFilterDateFrom || logFilterDateTo) && (
                  <button
                    onClick={clearLogFilters}
                    className="text-sm px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {loadingLogs ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Loading audit logs...</p>
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="p-8 text-center">
                <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {auditLogs.length === 0 ? 'No privilege changes recorded yet' : 'No logs match your filters'}
                </p>
                {auditLogs.length > 0 && (
                  <button
                    onClick={clearLogFilters}
                    className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredAuditLogs.map(log => (
                  <div key={log.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${log.isReverted ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${
                            log.changeType === 'enable' ? 'text-green-600 dark:text-green-400' :
                            log.changeType === 'disable' ? 'text-red-600 dark:text-red-400' :
                            log.changeType === 'revert' ? 'text-blue-600 dark:text-blue-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {log.changeType === 'enable' ? '✓ Enabled' :
                             log.changeType === 'disable' ? '✗ Disabled' :
                             log.changeType === 'revert' ? '↩ Reverted' :
                             log.changeType}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {log.displayName || log.featureKey}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">for</span>
                          <span className={`text-sm font-medium ${ROLE_CONFIG[log.role]?.color || 'text-gray-700 dark:text-gray-300'}`}>
                            {ROLE_CONFIG[log.role]?.label || log.role}
                          </span>
                          {log.isReverted && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                              Reverted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.changedAt)}
                          </span>
                          <span>by {log.changedByName}</span>
                        </div>
                        {log.isReverted && log.revertedByName && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Reverted by {log.revertedByName} on {log.revertedAt ? formatDate(log.revertedAt) : 'unknown'}
                          </p>
                        )}
                      </div>
                      {!log.isReverted && log.changeType !== 'revert' && (
                        <button
                          onClick={() => revertChange(log.id)}
                          disabled={reverting === log.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {reverting === log.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Undo2 className="w-4 h-4" />
                          )}
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'role' ? (
          /* ===================== ROLE VIEW ===================== */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Role Selector Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-24">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Select Role
                  </h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {editableRoles.map(role => {
                    const config = ROLE_CONFIG[role];
                    const stats = getRoleStats(role);
                    return (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`w-full p-3 text-left transition-colors ${
                          selectedRole === role
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium text-sm ${config.color}`}>
                              {config.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {stats.enabled} / {stats.total} privileges
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-medium ${
                              stats.percentage >= 80 ? 'text-green-600 dark:text-green-400' :
                              stats.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {stats.percentage}%
                            </div>
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  stats.percentage >= 80 ? 'bg-green-500' :
                                  stats.percentage >= 50 ? 'bg-amber-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${stats.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Privilege Editor */}
            <div className="lg:col-span-3">
              {selectedRole && (
                <div className="space-y-4">
                  {/* Search & Filter */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Search */}
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search FMIR privileges..."
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Action Filter */}
                      <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Actions</option>
                        <option value="VIEW">View</option>
                        <option value="CREATE">Create</option>
                        <option value="EDIT">Edit</option>
                        <option value="DELETE">Delete</option>
                        <option value="MANAGE">Manage</option>
                        <option value="APPROVE">Approve</option>
                        <option value="EXECUTE">Execute</option>
                        <option value="EXPORT">Export</option>
                      </select>
                      
                      {/* Status Filter */}
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'all' | 'enabled' | 'disabled')}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">All Status</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                      
                      {/* Clear Filters */}
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          Clear
                        </button>
                      )}
                    </div>
                    
                    {/* Filter Results Summary */}
                    {hasActiveFilters && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Showing {Object.values(filteredGrouped).flat().length} of {definitions.length} privileges
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Privilege Categories */}
                  <div className="space-y-3">
                    {Object.entries(filteredGrouped).map(([category, privs]) => (
                      <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_ICONS[category] || '📁'}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{category}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                              {privs.length}
                            </span>
                          </div>
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Privileges List */}
                        {expandedCategories.has(category) && (
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {privs.map(priv => {
                              const isEnabled = matrix[selectedRole]?.[priv.key] ?? false;
                              const isDefault = priv.defaultRoles.includes(selectedRole);
                              const isSaving = saving === `${selectedRole}:${priv.key}`;
                              
                              return (
                                <div
                                  key={priv.key}
                                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`p-1.5 rounded-md ${
                                      isEnabled 
                                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                                    }`}>
                                      {ACTION_ICONS[priv.action] || <Settings className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                                          {priv.displayName}
                                        </p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                          priv.action === 'VIEW' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                          priv.action === 'CREATE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                          priv.action === 'EDIT' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                          priv.action === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                          priv.action === 'MANAGE' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                          priv.action === 'APPROVE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                          priv.action === 'EXECUTE' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}>
                                          {priv.action}
                                        </span>
                                        {!isDefault && isEnabled && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                            Custom
                                          </span>
                                        )}
                                        {isDefault && !isEnabled && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                            Restricted
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                        {priv.description}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Toggle Switch */}
                                  <button
                                    onClick={() => togglePrivilege(selectedRole, priv.key, isEnabled)}
                                    disabled={isSaving}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    >
                                      {isSaving && (
                                        <Loader2 className="w-3 h-3 animate-spin absolute top-1 left-1 text-gray-400" />
                                      )}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {Object.keys(filteredGrouped).length === 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                      <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No privileges match your search criteria
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ===================== MATRIX VIEW ===================== */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search privileges..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                {/* Action Filter */}
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Actions</option>
                  <option value="VIEW">View</option>
                  <option value="CREATE">Create</option>
                  <option value="EDIT">Edit</option>
                  <option value="DELETE">Delete</option>
                  <option value="MANAGE">Manage</option>
                  <option value="APPROVE">Approve</option>
                  <option value="EXECUTE">Execute</option>
                  <option value="EXPORT">Export</option>
                </select>
                
                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'enabled' | 'disabled')}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="enabled">Has Enabled</option>
                  <option value="disabled">All Disabled</option>
                </select>
                
                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>
              
              {/* Filter Results Summary */}
              {hasActiveFilters && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing {filteredDefinitions.length} of {definitions.length} privileges
                  </p>
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[250px]">
                      Privilege
                    </th>
                    {editableRoles.map(role => (
                      <th key={role} className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                        <div className={`${ROLE_CONFIG[role]?.color}`}>
                          {ROLE_CONFIG[role]?.label.split(' ')[0]}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDefinitions.map(priv => (
                    <tr key={priv.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">⚠️</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {priv.displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {priv.action}
                            </p>
                          </div>
                        </div>
                      </td>
                      {editableRoles.map(role => {
                        const isEnabled = matrix[role]?.[priv.key] ?? false;
                        const isSaving = saving === `${role}:${priv.key}`;
                        
                        return (
                          <td key={role} className="px-3 py-3 text-center">
                            <button
                              onClick={() => togglePrivilege(role, priv.key, isEnabled)}
                              disabled={isSaving}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                isEnabled
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isEnabled ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        {viewMode !== 'logs' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-400" />
              Action Types Legend
            </h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(ACTION_ICONS).map(([action, icon]) => (
                <div key={action} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className={`p-1 rounded ${
                    action === 'VIEW' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                    action === 'CREATE' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                    action === 'EDIT' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                    action === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    action === 'MANAGE' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                    action === 'APPROVE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                    action === 'EXECUTE' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {icon}
                  </div>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowResetConfirm(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reset Privileges?
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This will reset all FMIR privilege settings for <strong className={ROLE_CONFIG[selectedRole]?.color}>{ROLE_CONFIG[selectedRole]?.label}</strong> to their default values. Any custom configurations will be lost.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetRole}
                  disabled={saving === 'reset'}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving === 'reset' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FMIRPrivilegesPage() {
  return (
    <ProtectedRoute allowedRoles={['QUALITY_CONTROL_MANAGER', 'ADMIN', 'SYSTEM_ADMIN']}>
      <FMIRPrivilegesContent />
    </ProtectedRoute>
  );
}

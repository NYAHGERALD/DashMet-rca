'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import LoadingState from '@/components/ui/LoadingState';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import { 
  Shield, 
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
  Navigation,
  UserCog,
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

interface UserOverrideUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  PrivilegeOverrides: { featureKey: string; isEnabled: boolean }[];
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
    description: 'Team lead with supervision and management capabilities'
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
    description: 'Continuous improvement manager with advanced analytics'
  },
  ADMIN: { 
    label: 'Admin', 
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Organization administrator with full management access'
  },
  SYSTEM_ADMIN: { 
    label: 'System Admin', 
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    description: 'Platform super administrator (all privileges)'
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

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Incidents': '📋',
  'Root Cause Analysis': '🔍',
  'CAPA': '✅',
  'Foreign Material': '⚠️',
  'Reports': '📝',
  'Reports & Compliance': '📊',
  'Knowledge Base': '📚',
  'Analytics': '📈',
  'User Management': '👥',
  'Organization Structure': '🏢',
  'Access Control': '🔐',
  'Compliance': '📜',
  'System Administration': '⚙️',
  'Collaboration': '💬',
  'Safety Assessment': '🦺',
  'Quick Navigation': '🧭',
  'Organization Management': '🏗️',
};

function PrivilegesContent() {
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
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  
  // Audit log filter state
  const [logFilterRevert, setLogFilterRevert] = useState<'all' | 'reverted' | 'active'>('all');
  const [logFilterType, setLogFilterType] = useState<'all' | 'ENABLE' | 'DISABLE' | 'REVERT'>('all');
  const [logFilterDateFrom, setLogFilterDateFrom] = useState<string>('');
  const [logFilterDateTo, setLogFilterDateTo] = useState<string>('');
  
  // Real-time notification state
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // UI state
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'role' | 'matrix' | 'logs' | 'navigation'>('role');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Navigation view state
  const [navSelectedRole, setNavSelectedRole] = useState<string>('OPERATOR');
  const [navUsers, setNavUsers] = useState<UserOverrideUser[]>([]);
  const [navUserLoading, setNavUserLoading] = useState(false);
  const [navSaving, setNavSaving] = useState<string | null>(null);
  const [navSubTab, setNavSubTab] = useState<'quick' | 'admin'>('quick');

  // Available roles (excluding SYSTEM_ADMIN which always has full access)
  const editableRoles = Object.keys(ROLE_CONFIG).filter(r => r !== 'SYSTEM_ADMIN');

  // Setup WebSocket connection for real-time sync
  useEffect(() => {
    if (!user?.organizationId) return;

    let cancelled = false;

    const setupSocket = async () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5002';

      const firebaseUser = (await import('@/lib/firebase')).auth.currentUser;
      const firebaseToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      if (cancelled) return;
      
      socketRef.current = io(wsUrl, {
        auth: {
          token: firebaseToken,
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

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await api.get('/privileges/audit-logs', {
        params: { limit: 100 },
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
      if (logFilterType !== 'all' && log.changeType.toUpperCase() !== logFilterType) return false;
      
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

  const fetchPrivileges = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/privileges/organization');
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
        
        // Expand all categories by default
        setExpandedCategories(new Set(Object.keys(grouped)));
        
        // Select first editable role by default
        if (!selectedRole && editableRoles.length > 0) {
          setSelectedRole(editableRoles[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching privileges:', err);
      setError(err.response?.data?.error || 'Failed to load privilege settings');
    } finally {
      setLoading(false);
    }
  };

  // Get unique modules from definitions
  const availableModules = useMemo(() => {
    const modules = new Set(definitions.map(def => def.module));
    return Array.from(modules).sort();
  }, [definitions]);

  // Filter definitions based on search, action, module, and status filters
  const filteredDefinitions = useMemo(() => {
    return definitions.filter(def => {
      const matchesSearch = searchQuery === '' || 
        def.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.key.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAction = filterAction === '' || def.action === filterAction;
      const matchesModule = filterModule === '' || def.module === filterModule;
      
      // For status filter, check if any role has this privilege enabled/disabled
      let matchesStatus = true;
      if (filterStatus === 'enabled') {
        // At least one role has this enabled
        matchesStatus = editableRoles.some(role => matrix[role]?.[def.key] === true);
      } else if (filterStatus === 'disabled') {
        // All roles have this disabled
        matchesStatus = editableRoles.every(role => !matrix[role]?.[def.key]);
      }
      
      return matchesSearch && matchesAction && matchesModule && matchesStatus;
    });
  }, [definitions, searchQuery, filterAction, filterModule, filterStatus, matrix, editableRoles]);

  // Filter grouped definitions
  const filteredGrouped = useMemo(() => {
    const result: Record<string, PrivilegeDefinition[]> = {};
    for (const [category, defs] of Object.entries(groupedDefinitions)) {
      const filtered = defs.filter(def => {
        const matchesSearch = searchQuery === '' || 
          def.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          def.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          def.key.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesAction = filterAction === '' || def.action === filterAction;
        const matchesModule = filterModule === '' || def.module === filterModule;
        
        // For status filter in role view, check against selected role
        let matchesStatus = true;
        if (selectedRole && filterStatus !== 'all') {
          const isEnabled = matrix[selectedRole]?.[def.key] === true;
          matchesStatus = filterStatus === 'enabled' ? isEnabled : !isEnabled;
        }
        
        return matchesSearch && matchesAction && matchesModule && matchesStatus;
      });
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }
    return result;
  }, [groupedDefinitions, searchQuery, filterAction, filterModule, filterStatus, selectedRole, matrix]);

  // Clear all role/matrix filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterAction('');
    setFilterModule('');
    setFilterStatus('all');
  };

  // Check if any filter is active
  const hasActiveFilters = searchQuery !== '' || filterAction !== '' || filterModule !== '' || filterStatus !== 'all';

  // Navigation definitions
  const navDefinitions = useMemo(() => {
    return definitions.filter(d => d.module === 'NAVIGATION');
  }, [definitions]);

  const navQuickLinks = useMemo(() => {
    return navDefinitions.filter(d => d.category === 'Quick Navigation');
  }, [navDefinitions]);

  const navAdminLinks = useMemo(() => {
    return navDefinitions.filter(d => d.category === 'Organization Management');
  }, [navDefinitions]);

  // Fetch users for the selected role (for user overrides)
  const fetchNavUsers = useCallback(async (role: string) => {
    setNavUserLoading(true);
    try {
      const response = await api.get('/privileges/users-by-role', { params: { role } });
      if (response.data.success) {
        setNavUsers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setNavUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'navigation' && navSelectedRole) {
      fetchNavUsers(navSelectedRole);
    }
  }, [viewMode, navSelectedRole, fetchNavUsers]);

  // Toggle a navigation privilege for a role
  const toggleNavPrivilege = async (role: string, featureKey: string, currentValue: boolean) => {
    const savingKey = `nav:${role}:${featureKey}`;
    setNavSaving(savingKey);
    try {
      await api.put('/privileges/organization', {
        role,
        featureKey,
        isEnabled: !currentValue,
      });
      setMatrix(prev => ({
        ...prev,
        [role]: { ...prev[role], [featureKey]: !currentValue },
      }));
      setSuccessMessage(`Updated ${featureKey} for ${ROLE_CONFIG[role]?.label || role}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update navigation privilege');
    } finally {
      setNavSaving(null);
    }
  };

  // Toggle a user-specific override
  const toggleUserOverride = async (userId: string, featureKey: string, isEnabled: boolean) => {
    const savingKey = `user:${userId}:${featureKey}`;
    setNavSaving(savingKey);
    try {
      await api.put(`/privileges/user-overrides/${userId}`, {
        featureKey,
        isEnabled,
      });
      // Update local user state
      setNavUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const existing = u.PrivilegeOverrides.find(o => o.featureKey === featureKey);
        if (existing) {
          return {
            ...u,
            PrivilegeOverrides: u.PrivilegeOverrides.map(o =>
              o.featureKey === featureKey ? { ...o, isEnabled } : o
            ),
          };
        }
        return {
          ...u,
          PrivilegeOverrides: [...u.PrivilegeOverrides, { featureKey, isEnabled }],
        };
      }));
      setSuccessMessage(`User override updated for ${featureKey}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user override');
    } finally {
      setNavSaving(null);
    }
  };

  // Remove a user-specific override (revert to role default)
  const removeUserOverride = async (userId: string, featureKey: string) => {
    const savingKey = `user:${userId}:${featureKey}`;
    setNavSaving(savingKey);
    try {
      await api.delete(`/privileges/user-overrides/${userId}/${featureKey}`);
      setNavUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          PrivilegeOverrides: u.PrivilegeOverrides.filter(o => o.featureKey !== featureKey),
        };
      }));
      setSuccessMessage(`Override removed — user will follow role defaults`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove override');
    } finally {
      setNavSaving(null);
    }
  };

  // Reset all overrides for a user
  const resetUserOverrides = async (userId: string) => {
    setNavSaving(`reset:${userId}`);
    try {
      await api.post(`/privileges/user-overrides/${userId}/reset`);
      setNavUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, PrivilegeOverrides: [] } : u
      ));
      setSuccessMessage('All user overrides have been reset to role defaults');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset overrides');
    } finally {
      setNavSaving(null);
    }
  };

  // Get effective privilege value for a user (user override > role default)
  const getUserEffectiveNav = (userId: string, featureKey: string): { value: boolean; isOverridden: boolean } => {
    const user = navUsers.find(u => u.id === userId);
    if (!user) return { value: false, isOverridden: false };
    
    const override = user.PrivilegeOverrides.find(o => o.featureKey === featureKey);
    if (override) {
      return { value: override.isEnabled, isOverridden: true };
    }
    
    // Fall back to role privilege
    const roleValue = matrix[user.role]?.[featureKey] ?? false;
    return { value: roleValue, isOverridden: false };
  };

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
        // Update local state
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
    return { enabled, total, percentage: Math.round((enabled / total) * 100) };
  };

  if (loading) {
    return <LoadingState message="Loading privilege settings..." icon="lock" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Role Privileges
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure feature access for each role in your organization
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAuditLogs()}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
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
                  onClick={() => {
                    setViewMode('logs');
                    fetchAuditLogs();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'logs'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Audit Log
                </button>
                <button
                  onClick={() => setViewMode('navigation')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'navigation'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  Navigation
                </button>
              </div>
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

      {/* Real-time Notification */}
      {realtimeNotification && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3 animate-pulse">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-blue-700 dark:text-blue-300 flex-1">{realtimeNotification}</p>
            <button
              onClick={() => setRealtimeNotification(null)}
              className="ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'role' && (
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
                
                {/* SYSTEM_ADMIN Note */}
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                        System Admin
                      </p>
                      <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                        Always has full access. Cannot be modified.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Privilege Editor */}
            <div className="lg:col-span-3">
              {selectedRole && (
                <div className="space-y-4">
                  {/* Role Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${ROLE_CONFIG[selectedRole]?.bgColor}`}>
                          <Shield className={`w-5 h-5 ${ROLE_CONFIG[selectedRole]?.color}`} />
                        </div>
                        <div>
                          <h2 className={`text-lg font-semibold ${ROLE_CONFIG[selectedRole]?.color}`}>
                            {ROLE_CONFIG[selectedRole]?.label}
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {ROLE_CONFIG[selectedRole]?.description}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        disabled={saving === 'reset'}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving === 'reset' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        Reset to Defaults
                      </button>
                    </div>
                  </div>

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
                      
                      {/* Module Filter */}
                      <select
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">All Modules</option>
                        {availableModules.map(mod => (
                          <option key={mod} value={mod}>{mod}</option>
                        ))}
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
        )}

        {viewMode === 'matrix' && (
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
                
                {/* Module Filter */}
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Modules</option>
                  {availableModules.map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
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
                          <span className="text-sm">{CATEGORY_ICONS[priv.category] || '📁'}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {priv.displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {priv.category}
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
            
            {filteredDefinitions.length === 0 && (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No privileges match your search criteria
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===================== AUDIT LOG VIEW ===================== */}
        {viewMode === 'logs' && (
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
                  onClick={() => fetchAuditLogs()}
                  disabled={loadingLogs}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                  onChange={(e) => setLogFilterType(e.target.value as 'all' | 'ENABLE' | 'DISABLE' | 'REVERT')}
                  className="text-sm px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Types</option>
                  <option value="ENABLE">Enabled</option>
                  <option value="DISABLE">Disabled</option>
                  <option value="REVERT">Reverted</option>
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
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
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
                {filteredAuditLogs.map((log) => (
                  <div key={log.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${log.isReverted ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.changeType === 'ENABLE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                            log.changeType === 'DISABLE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                            log.changeType === 'BULK_UPDATE' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {log.changeType}
                          </span>
                          {log.isReverted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              <Undo2 className="w-3 h-3 mr-1" />
                              Reverted
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          <span className="font-medium">{log.displayName}</span>
                          {' for '}
                          <span className={`font-medium ${ROLE_CONFIG[log.role as keyof typeof ROLE_CONFIG]?.color || ''}`}>
                            {ROLE_CONFIG[log.role as keyof typeof ROLE_CONFIG]?.label || log.role}
                          </span>
                          {' in '}
                          <span className="font-medium">{log.module}</span>
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.changedAt)}
                          </span>
                          <span>by {log.changedByName}</span>
                        </div>
                      </div>
                      {!log.isReverted && (
                        <button
                          onClick={() => revertChange(log.id)}
                          disabled={reverting === log.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-50"
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
        )}

        {/* Legend */}
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
      </div>

      {/* ===================== NAVIGATION VIEW ===================== */}
      {viewMode === 'navigation' && (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Role Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-24">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Role
                  </h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {editableRoles.map(role => (
                    <button
                      key={role}
                      onClick={() => setNavSelectedRole(role)}
                      className={`w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between ${
                        navSelectedRole === role
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-l-3 border-primary-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className={`text-sm font-medium ${ROLE_CONFIG[role]?.color}`}>
                        {ROLE_CONFIG[role]?.label || role}
                      </span>
                      {navSelectedRole === role && (
                        <ChevronRight className="w-4 h-4 text-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Access Matrix */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header with sub-tabs */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      Navigation Access — <span className={ROLE_CONFIG[navSelectedRole]?.color}>{ROLE_CONFIG[navSelectedRole]?.label}</span>
                      {!navUserLoading && navUsers.length > 0 && (
                        <span className="text-xs font-normal text-gray-500 ml-2">({navUsers.length} user{navUsers.length !== 1 ? 's' : ''})</span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Set role defaults and per-user overrides. Amber = user override active.
                    </p>
                  </div>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 text-sm">
                    <button
                      onClick={() => setNavSubTab('quick')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                        navSubTab === 'quick'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      Quick Nav ({navQuickLinks.length})
                    </button>
                    <button
                      onClick={() => setNavSubTab('admin')}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                        navSubTab === 'admin'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      Admin ({navAdminLinks.length})
                    </button>
                  </div>
                </div>

                {/* Matrix Table */}
                {navUserLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                          <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/30 px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
                            Link
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap border-l border-r border-gray-200 dark:border-gray-700 min-w-[90px]">
                            All {ROLE_CONFIG[navSelectedRole]?.label?.split(' ')[0] || navSelectedRole}
                          </th>
                          {navUsers.map(u => (
                            <th key={u.id} className="px-2 py-2 text-center min-w-[60px]">
                              <div className="flex flex-col items-center gap-0.5" title={`${u.name || u.email}\n${u.email}`}>
                                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-bold flex items-center justify-center">
                                  {(u.name || u.email).charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-[64px]">
                                  {(u.name || '').split(' ')[0] || u.email.split('@')[0]}
                                </span>
                                {u.PrivilegeOverrides.length > 0 && (
                                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                                    {u.PrivilegeOverrides.length} ovr
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {(navSubTab === 'quick' ? navQuickLinks : navAdminLinks).map(def => {
                          const roleEnabled = matrix[navSelectedRole]?.[def.key] ?? false;
                          const isRoleSaving = navSaving === `nav:${navSelectedRole}:${def.key}`;

                          return (
                            <tr key={def.key} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                              {/* Link name */}
                              <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-2.5 border-r border-gray-100 dark:border-gray-700/50">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{def.displayName}</span>
                              </td>

                              {/* Role default toggle */}
                              <td className="px-3 py-2.5 text-center border-r border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => toggleNavPrivilege(navSelectedRole, def.key, roleEnabled)}
                                    disabled={isRoleSaving}
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      roleEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                                    } ${isRoleSaving ? 'opacity-50' : ''}`}
                                    title={roleEnabled ? 'Enabled for all' : 'Disabled for all'}
                                  >
                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                      roleEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`}>
                                      {isRoleSaving && <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-400 m-[3px]" />}
                                    </span>
                                  </button>
                                </div>
                              </td>

                              {/* Per-user cells */}
                              {navUsers.map(u => {
                                const { value, isOverridden } = getUserEffectiveNav(u.id, def.key);
                                const isSaving = navSaving === `user:${u.id}:${def.key}`;

                                return (
                                  <td key={u.id} className={`px-2 py-2.5 text-center ${isOverridden ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                                    <div className="flex items-center justify-center group relative">
                                      <button
                                        onClick={() => toggleUserOverride(u.id, def.key, !value)}
                                        disabled={isSaving}
                                        className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                                          value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                        } ${isSaving ? 'opacity-50' : ''} ${
                                          isOverridden ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-1 dark:ring-offset-gray-800' : 'opacity-50'
                                        }`}
                                        title={isOverridden
                                          ? `Override: ${value ? 'Granted' : 'Denied'} — click to toggle, hover X to remove`
                                          : `Following role default: ${value ? 'Visible' : 'Hidden'} — click to create override`
                                        }
                                      >
                                        <span className={`pointer-events-none inline-block h-3 w-3 mt-[1px] ml-[1px] transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                          value ? 'translate-x-3' : 'translate-x-0'
                                        }`}>
                                          {isSaving && <Loader2 className="w-2 h-2 animate-spin text-gray-400" />}
                                        </span>
                                      </button>
                                      {isOverridden && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeUserOverride(u.id, def.key); }}
                                          disabled={isSaving}
                                          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-300 transition-all p-0.5"
                                          title="Remove override (revert to role default)"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Legend + Stats */}
                <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <div className="relative inline-flex h-3 w-5 rounded-full bg-green-500 ring-1.5 ring-amber-400 ring-offset-1">
                        <span className="inline-block h-2 w-2 translate-x-2.5 translate-y-0.5 rounded-full bg-white" />
                      </div>
                      <span>User override</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative inline-flex h-3 w-5 rounded-full bg-green-500 opacity-50">
                        <span className="inline-block h-2 w-2 translate-x-2.5 translate-y-0.5 rounded-full bg-white" />
                      </div>
                      <span>Following role default</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                        <X className="w-2.5 h-2.5 text-gray-400" />
                      </div>
                      <span>Remove override (hover)</span>
                    </div>
                  </div>
                  {navUsers.some(u => u.PrivilegeOverrides.length > 0) && (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {navUsers.reduce((sum, u) => sum + u.PrivilegeOverrides.length, 0)} total override{navUsers.reduce((sum, u) => sum + u.PrivilegeOverrides.length, 0) !== 1 ? 's' : ''} active
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                This will reset all privilege settings for <strong className={ROLE_CONFIG[selectedRole]?.color}>{ROLE_CONFIG[selectedRole]?.label}</strong> to their default values. Any custom configurations will be lost.
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

export default function PrivilegesPage() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <PrivilegesContent />
    </ProtectedRoute>
  );
}

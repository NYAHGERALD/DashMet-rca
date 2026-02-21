'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import {
  Scale,
  Plus,
  Search,
  Filter,
  FolderOpen,
  FileText,
  BarChart3,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Users,
  TrendingUp,
  ChevronRight,
  X,
  Calendar,
  Building2,
  MapPin,
  Shield,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  ArrowLeft,
  Upload,
  BookOpen,
} from 'lucide-react';
import {
  ConflictCase,
  WorkplacePolicy,
  CaseAnalytics,
  CaseStatus,
  CaseType,
  fetchCases,
  createCase,
  deleteCase,
  fetchPolicies,
  createPolicy,
  deletePolicy,
  fetchAnalytics,
  generateCaseNumber,
  getStatusColor,
  getStatusLabel,
  getCaseTypeLabel,
  getCaseTypeColor,
  formatDate,
  formatDateTime,
} from '@/lib/hrApi';

// ────────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ────────────────────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: any; label: string; value: number | string; color: string; subtext?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtext}</p>}
        </div>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${color}`} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// CREATE CASE MODAL
// ────────────────────────────────────────────────────────────────────────────────
function CreateCaseModal({ isOpen, onClose, onCreated, organizationId, userId }: {
  isOpen: boolean; onClose: () => void; onCreated: (c: ConflictCase) => void;
  organizationId: string; userId: string;
}) {
  const [caseType, setCaseType] = useState<string>('conflict');
  const [incidentDate, setIncidentDate] = useState('');
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [shift, setShift] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const caseTypes = [
    { value: 'conflict', label: 'Workplace Conflict', icon: Users, color: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' },
    { value: 'conduct', label: 'Conduct Issue', icon: AlertTriangle, color: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
    { value: 'safety', label: 'Safety Concern', icon: Shield, color: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { value: 'other', label: 'Other', icon: FileText, color: 'border-gray-500 bg-gray-50 dark:bg-gray-900/20' },
  ];

  const handleSubmit = async () => {
    if (!incidentDate) return;
    setLoading(true);
    try {
      const newCase = await createCase({
        caseNumber: generateCaseNumber(),
        creatorId: userId,
        organizationId,
        caseType,
        incidentDate: new Date(incidentDate).toISOString(),
        location: location || undefined,
        department: department || undefined,
        shift: shift || undefined,
        description: description || undefined,
      });
      onCreated(newCase);
      onClose();
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Case</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create a new HR conflict resolution case</p>
          </div>
          <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Case Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Case Type</label>
            <div className="grid grid-cols-2 gap-3">
              {caseTypes.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setCaseType(ct.value)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    caseType === ct.value
                      ? ct.color + ' border-opacity-100 shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                  }`}
                >
                  <ct.icon className={`w-5 h-5 ${caseType === ct.value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${caseType === ct.value ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {ct.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Incident Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Incident Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)}
              title="Incident Date"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Location + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Building A, Floor 2"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Department</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Production, QA"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Shift */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Shift</label>
            <input
              type="text"
              value={shift}
              onChange={e => setShift(e.target.value)}
              placeholder="e.g. Day, Night, Swing"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Initial Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief summary of the incident..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!incidentDate || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Case
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// CREATE POLICY MODAL
// ────────────────────────────────────────────────────────────────────────────────
function CreatePolicyModal({ isOpen, onClose, onCreated, organizationId, userId }: {
  isOpen: boolean; onClose: () => void; onCreated: (p: WorkplacePolicy) => void;
  organizationId: string; userId: string;
}) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [policyText, setPolicyText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const policy = await createPolicy({
        name: name.trim(),
        version,
        createdBy: userId,
        organizationId,
        description: description || undefined,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
        originalText: policyText || undefined,
        status: 'ACTIVE',
      });
      onCreated(policy);
      onClose();
      setName(''); setVersion('1.0'); setDescription(''); setEffectiveDate(''); setPolicyText('');
    } catch (err) {
      console.error('Failed to create policy:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Policy</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Upload or create a workplace policy document</p>
          </div>
          <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Policy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Employee Code of Conduct"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Version</label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                title="Policy version"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this policy..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Effective Date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={e => setEffectiveDate(e.target.value)}
              title="Effective Date"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Policy Text</label>
            <textarea
              value={policyText}
              onChange={e => setPolicyText(e.target.value)}
              rows={8}
              placeholder="Paste the full policy text here, or upload a file later..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Policy
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// CASES TAB
// ────────────────────────────────────────────────────────────────────────────────
function CasesTab({ cases, loading, onRefresh, onCreateCase, organizationId }: {
  cases: ConflictCase[]; loading: boolean; onRefresh: () => void; onCreateCase: () => void; organizationId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const filtered = useMemo(() => {
    return cases.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (typeFilter && c.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          c.caseNumber.toLowerCase().includes(s) ||
          (c.location || '').toLowerCase().includes(s) ||
          (c.department || '').toLowerCase().includes(s) ||
          (c.involvedEmployees || []).some(e => e.name.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [cases, search, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [cases]);

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard icon={FolderOpen} label="Total Cases" value={cases.length} color="bg-blue-600" />
        <StatCard icon={Clock} label="In Progress" value={statusCounts['IN_PROGRESS'] || 0} color="bg-indigo-600" />
        <StatCard icon={Eye} label="Pending Review" value={statusCounts['PENDING_REVIEW'] || 0} color="bg-yellow-600" />
        <StatCard icon={AlertTriangle} label="Awaiting Action" value={statusCounts['AWAITING_ACTION'] || 0} color="bg-orange-600" />
        <StatCard icon={CheckCircle2} label="Closed" value={statusCounts['CLOSED'] || 0} color="bg-green-600" />
        <StatCard icon={ArrowUpRight} label="Escalated" value={statusCounts['ESCALATED'] || 0} color="bg-red-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cases, employees, locations..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          title="Filter by status"
          className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="AWAITING_ACTION">Awaiting Action</option>
          <option value="CLOSED">Closed</option>
          <option value="ESCALATED">Escalated</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          title="Filter by type"
          className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <option value="">All Types</option>
          <option value="CONFLICT">Workplace Conflict</option>
          <option value="CONDUCT">Conduct Issue</option>
          <option value="SAFETY">Safety Concern</option>
          <option value="OTHER">Other</option>
        </select>
        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onCreateCase}
          className="ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
        >
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      {/* Case List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No cases found</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {cases.length === 0 ? 'Create your first case to get started' : 'Try adjusting your filters'}
          </p>
          {cases.length === 0 && (
            <button onClick={onCreateCase} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4 inline mr-1" /> Create Case
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/hr/case/${c.id}`)}
              className="w-full text-left rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-bold text-gray-900 dark:text-white">{c.caseNumber}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(c.status)}`}>
                      {getStatusLabel(c.status)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getCaseTypeColor(c.type)}`}>
                      {getCaseTypeLabel(c.type)}
                    </span>
                    {c.isLocked && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                        Locked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {c.incidentDate && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {formatDate(c.incidentDate)}
                      </span>
                    )}
                    {c.department && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> {c.department}
                      </span>
                    )}
                    {c.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {c.location}
                      </span>
                    )}
                    {c.involvedEmployees && c.involvedEmployees.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {c.involvedEmployees.length} {c.involvedEmployees.length === 1 ? 'party' : 'parties'}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// POLICIES TAB
// ────────────────────────────────────────────────────────────────────────────────
function PoliciesTab({ policies, loading, onRefresh, onCreatePolicy }: {
  policies: WorkplacePolicy[]; loading: boolean; onRefresh: () => void; onCreatePolicy: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workplace Policies</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage policies used for AI-powered case analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} title="Refresh" className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onCreatePolicy}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" /> Add Policy
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No policies yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add workplace policies to enable AI-powered policy matching</p>
          <button onClick={onCreatePolicy} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 inline mr-1" /> Add Policy
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map(p => (
            <div key={p.id} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{p.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">v{p.version}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  p.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {p.status}
                </span>
              </div>
              {p.description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{p.description}</p>}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                {p.effectiveDate && <span>Effective: {formatDate(p.effectiveDate)}</span>}
                <span>Created: {formatDate(p.createdAt)}</span>
              </div>
              {p.originalText && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 max-h-24 overflow-hidden">
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 font-mono">{p.originalText}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ANALYTICS TAB
// ────────────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, loading, onRefresh }: {
  analytics: CaseAnalytics | null; loading: boolean; onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No analytics available</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create cases to see analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Analytics Dashboard</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Overview of conflict resolution metrics</p>
        </div>
        <button onClick={onRefresh} title="Refresh" className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={FolderOpen} label="Total Cases" value={analytics.summary.totalCases} color="bg-blue-600" />
        <StatCard icon={Clock} label="Active" value={analytics.summary.activeCases} color="bg-indigo-600" />
        <StatCard icon={CheckCircle2} label="Closed" value={analytics.summary.closedCases} color="bg-green-600" />
        <StatCard icon={ArrowUpRight} label="Escalated" value={analytics.summary.escalatedCases} color="bg-red-600" />
        <StatCard icon={TrendingUp} label="Resolution Rate" value={`${Math.round(analytics.summary.resolutionRate)}%`} color="bg-emerald-600" />
      </div>

      {/* Resolution Metrics */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Resolution Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Resolution</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.resolutionMetrics.averageDays}<span className="text-sm font-normal text-gray-400 ml-1">days</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fastest</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.resolutionMetrics.minDays}<span className="text-sm font-normal text-gray-400 ml-1">days</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Slowest</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.resolutionMetrics.maxDays}<span className="text-sm font-normal text-gray-400 ml-1">days</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Resolved</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.resolutionMetrics.totalResolved}</p>
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Status</h4>
          <div className="space-y-3">
            {analytics.statusBreakdown.map(s => {
              const pct = analytics.summary.totalCases > 0 ? (s.count / analytics.summary.totalCases) * 100 : 0;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{getStatusLabel(s.status as CaseStatus)}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Type</h4>
          <div className="space-y-3">
            {analytics.typeBreakdown.map(t => {
              const pct = analytics.summary.totalCases > 0 ? (t.count / analytics.summary.totalCases) * 100 : 0;
              return (
                <div key={t.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{getCaseTypeLabel(t.type as CaseType)}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      {analytics.monthlyTrends.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly Trends</h4>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-fit h-48">
              {analytics.monthlyTrends.map(m => {
                const maxVal = Math.max(...analytics.monthlyTrends.flatMap(t => [t.created, t.closed]), 1);
                const cHeight = (m.created / maxVal) * 100;
                const rHeight = (m.closed / maxVal) * 100;
                return (
                  <div key={m.month} className="flex flex-col items-center gap-1 min-w-[48px]">
                    <div className="flex items-end gap-1 h-36">
                      <div className="w-4 rounded-t bg-blue-500" style={{ height: `${cHeight}%` }} title={`Created: ${m.created}`} />
                      <div className="w-4 rounded-t bg-green-500" style={{ height: `${rHeight}%` }} title={`Closed: ${m.closed}`} />
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{m.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Created</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" /> Closed</span>
            </div>
          </div>
        </div>
      )}

      {/* Department Breakdown */}
      {analytics.departmentBreakdown.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Department</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Department</th>
                  <th className="pb-2 font-medium text-center">Total</th>
                  <th className="pb-2 font-medium text-center">Active</th>
                  <th className="pb-2 font-medium text-center">Closed</th>
                </tr>
              </thead>
              <tbody>
                {analytics.departmentBreakdown.map(d => (
                  <tr key={d.department} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-3 text-gray-900 dark:text-white font-medium">{d.department || 'Unknown'}</td>
                    <td className="py-3 text-center text-gray-600 dark:text-gray-400">{d.total}</td>
                    <td className="py-3 text-center text-blue-600 dark:text-blue-400 font-semibold">{d.active}</td>
                    <td className="py-3 text-center text-green-600 dark:text-green-400 font-semibold">{d.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN PAGE CONTENT
// ────────────────────────────────────────────────────────────────────────────────
function HRPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'cases' | 'policies' | 'analytics'>('cases');

  // Data
  const [cases, setCases] = useState<ConflictCase[]>([]);
  const [policies, setPolicies] = useState<WorkplacePolicy[]>([]);
  const [analytics, setAnalytics] = useState<CaseAnalytics | null>(null);

  // Loading
  const [casesLoading, setCasesLoading] = useState(true);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Modals
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  const orgId = user?.organizationId || '';

  const loadCases = useCallback(async () => {
    if (!orgId) return;
    setCasesLoading(true);
    try {
      const res = await fetchCases({ organizationId: orgId, limit: 200 });
      setCases(res.data);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setCasesLoading(false);
    }
  }, [orgId]);

  const loadPolicies = useCallback(async () => {
    if (!orgId) return;
    setPoliciesLoading(true);
    try {
      const data = await fetchPolicies({ organizationId: orgId });
      setPolicies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load policies:', err);
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, [orgId]);

  const loadAnalytics = useCallback(async () => {
    if (!orgId) return;
    setAnalyticsLoading(true);
    try {
      const data = await fetchAnalytics({ organizationId: orgId });
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (activeTab === 'policies' && policies.length === 0 && !policiesLoading) loadPolicies();
    if (activeTab === 'analytics' && !analytics && !analyticsLoading) loadAnalytics();
  }, [activeTab, policies.length, policiesLoading, analytics, analyticsLoading, loadPolicies, loadAnalytics]);

  const tabs = [
    { id: 'cases' as const, label: 'Cases', icon: FolderOpen, count: cases.length },
    { id: 'policies' as const, label: 'Policies', icon: Shield, count: policies.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} title="Back to dashboard" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30">
                    <Scale className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR Conflict Resolution</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage workplace cases, policies, and AI-powered analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-6 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-6 lg:px-8 py-8">
        {activeTab === 'cases' && (
          <CasesTab
            cases={cases}
            loading={casesLoading}
            onRefresh={loadCases}
            onCreateCase={() => setShowCreateCase(true)}
            organizationId={orgId}
          />
        )}
        {activeTab === 'policies' && (
          <PoliciesTab
            policies={policies}
            loading={policiesLoading}
            onRefresh={loadPolicies}
            onCreatePolicy={() => setShowCreatePolicy(true)}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            analytics={analytics}
            loading={analyticsLoading}
            onRefresh={loadAnalytics}
          />
        )}
      </div>

      {/* Modals */}
      <CreateCaseModal
        isOpen={showCreateCase}
        onClose={() => setShowCreateCase(false)}
        onCreated={(c) => {
          setCases(prev => [c, ...prev]);
          router.push(`/hr/case/${c.id}`);
        }}
        organizationId={orgId}
        userId={user?.id || ''}
      />
      <CreatePolicyModal
        isOpen={showCreatePolicy}
        onClose={() => setShowCreatePolicy(false)}
        onCreated={(p) => {
          setPolicies(prev => [p, ...prev]);
        }}
        organizationId={orgId}
        userId={user?.id || ''}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ────────────────────────────────────────────────────────────────────────────────
export default function HRPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN']}>
      <HRPageContent />
    </ProtectedRoute>
  );
}

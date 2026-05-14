'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
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
  Upload,
  BookOpen,
  UserPlus,
  UserMinus,
  Briefcase,
  Hash,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileUp,
  Gavel,
  Target,
  MessageSquare,
  HelpCircle,
  GripHorizontal,
  Sparkles,
  Lock,
  FileBarChart,
  XCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  ConflictCase,
  WorkplacePolicy,
  PolicySection,
  CaseAnalytics,
  CaseStatus,
  CaseType,
  DepartmentOption,
  ShiftOption,
  OCRResult,
  GuidedActionPlan,
  GuidedIntakePlan,
  GuidedIntakeQuestion,
  GuidedIntakeStep,
  GuidedReviewAnswers,
  GuidedRiskKey,
  fetchCases,
  createCase,
  deleteCase,
  fetchPolicies,
  createPolicy,
  deletePolicy,
  updatePolicy,
  fetchAnalytics,
  fetchDepartments,
  fetchShifts,
  processDocumentOCR,
  processDocumentFile,
  uploadDocumentSource,
  runGuidedActionPlan,
  runGuidedIntakeQuestions,
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
  const [validationError, setValidationError] = useState('');

  // Department + Shift dropdowns (fetched from backend, same as iOS)
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  // Involved Employees (iOS requires ≥2 complainants)
  interface EmployeeEntry {
    name: string;
    employeeId: string;
    role: string;
    department: string;
    isComplainant: boolean;
  }
  const [employees, setEmployees] = useState<EmployeeEntry[]>([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newEmpIsComplainant, setNewEmpIsComplainant] = useState(true);

  const caseTypes = [
    { value: 'conflict', label: 'Workplace Conflict', icon: Users, color: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' },
    { value: 'conduct', label: 'Conduct Issue', icon: AlertTriangle, color: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
    { value: 'safety', label: 'Safety Concern', icon: Shield, color: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { value: 'other', label: 'Other', icon: FileText, color: 'border-gray-500 bg-gray-50 dark:bg-gray-900/20' },
  ];

  // Fetch departments on open
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setDropdownsLoading(true);
      try {
        const depts = await fetchDepartments();
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        setDropdownsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  // When department changes, fetch shifts for that department
  const selectedDept = departments.find(d => d.name === department);
  useEffect(() => {
    if (!selectedDept) {
      setShifts([]);
      setShift('');
      return;
    }
    const loadShifts = async () => {
      setShiftsLoading(true);
      setShift('');
      try {
        const shiftList = await fetchShifts({ departmentId: selectedDept.id });
        setShifts(shiftList);
      } catch (err) {
        console.error('Failed to load shifts:', err);
      } finally {
        setShiftsLoading(false);
      }
    };
    loadShifts();
  }, [selectedDept?.id]);

  const isEmployeeFormValid =
    newEmpName.trim() !== '' &&
    newEmpId.trim() !== '' &&
    newEmpRole.trim() !== '' &&
    newEmpDept.trim() !== '';

  const addEmployee = () => {
    if (!isEmployeeFormValid) return;
    setEmployees(prev => [...prev, {
      name: newEmpName.trim(),
      employeeId: newEmpId.trim(),
      role: newEmpRole.trim(),
      department: newEmpDept.trim(),
      isComplainant: newEmpIsComplainant,
    }]);
    setNewEmpName('');
    setNewEmpId('');
    setNewEmpRole('');
    setNewEmpDept('');
    setNewEmpIsComplainant(true);
    setShowAddEmployee(false);
  };

  const removeEmployee = (index: number) => {
    setEmployees(prev => prev.filter((_, i) => i !== index));
  };

  const complainantCount = employees.filter(e => e.isComplainant).length;
  const isFormValid =
    incidentDate.trim() !== '' &&
    location.trim() !== '' &&
    department.trim() !== '' &&
    employees.length >= 2 &&
    complainantCount >= 2;

  const handleSubmit = async () => {
    setValidationError('');
    if (!incidentDate) { setValidationError('Incident date is required.'); return; }
    if (!location.trim()) { setValidationError('Location is required.'); return; }
    if (!department.trim()) { setValidationError('Department is required.'); return; }
    if (employees.length < 2) { setValidationError('At least 2 involved employees are required.'); return; }
    if (complainantCount < 2) { setValidationError('At least 2 employees must be marked as complainants.'); return; }

    setLoading(true);
    try {
      const newCase = await createCase({
        caseNumber: generateCaseNumber(),
        creatorId: userId,
        organizationId,
        caseType,
        incidentDate: new Date(incidentDate).toISOString(),
        location,
        department,
        shift: shift || undefined,
        description: description || undefined,
        employeesJson: employees.map(e => ({
          name: e.name,
          role: e.role,
          department: e.department,
          employeeId: e.employeeId,
          isComplainant: e.isComplainant,
        })),
      });
      onCreated(newCase);
      onClose();
      // Reset form
      setCaseType('conflict');
      setIncidentDate('');
      setLocation('');
      setDepartment('');
      setShift('');
      setDescription('');
      setEmployees([]);
      setValidationError('');
    } catch (err) {
      console.error('Failed to create case:', err);
      setValidationError('Failed to create case. Please try again.');
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create a new conflict resolution case with system-assisted analysis</p>
          </div>
          <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {validationError}
            </div>
          )}

          {/* Case Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Case Type</label>
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

          {/* Incident Details Section */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Incident Details</label>

            {/* Date + Time */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Date of Incident <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={incidentDate}
                onChange={e => setIncidentDate(e.target.value)}
                title="Date of Incident"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Location */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Building A, Floor 2"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Department + Shift (dropdowns) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  title="Department"
                  disabled={dropdownsLoading}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                >
                  <option value="">{dropdownsLoading ? 'Loading...' : 'Select Department'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Shift <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  title="Shift"
                  disabled={shiftsLoading || !department}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                >
                  <option value="">{shiftsLoading ? 'Loading...' : !department ? 'Select Department first' : 'Select Shift'}</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Involved Employees */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Involved Employees <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal normal-case text-gray-400">(min. 2 complainants)</span>
              </label>
              <button
                onClick={() => setShowAddEmployee(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Employee
              </button>
            </div>

            {/* Employee List */}
            {employees.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 p-6 text-center">
                <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No employees added yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add at least 2 involved employees to create a case</p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((emp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        emp.isComplainant
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {emp.role} · {emp.department} · {emp.employeeId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.isComplainant
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {emp.isComplainant ? 'Complainant' : 'Witness'}
                      </span>
                      <button
                        onClick={() => removeEmployee(idx)}
                        title="Remove employee"
                        className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Employee Form (inline) */}
            {showAddEmployee && (
              <div className="mt-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Add Employee</h4>
                  <button onClick={() => setShowAddEmployee(false)} title="Cancel" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Role Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewEmpIsComplainant(true)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      newEmpIsComplainant
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Complainant
                  </button>
                  <button
                    onClick={() => setNewEmpIsComplainant(false)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      !newEmpIsComplainant
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Witness
                  </button>
                </div>

                {/* Name + Employee ID */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEmpName}
                      onChange={e => setNewEmpName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Employee ID / File No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEmpId}
                      onChange={e => setNewEmpId(e.target.value)}
                      placeholder="e.g. EMP-12345"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Role + Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Role / Position <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEmpRole}
                      onChange={e => setNewEmpRole(e.target.value)}
                      placeholder="e.g. Manager"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newEmpDept}
                      onChange={e => setNewEmpDept(e.target.value)}
                      title="Employee Department"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={addEmployee}
                  disabled={!isEmployeeFormValid}
                  className="w-full py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add to Case
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-8 py-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} · {complainantCount} complainant{complainantCount !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Case
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// GUIDED RESOLUTION WIZARD
// ────────────────────────────────────────────────────────────────────────────────

type WizardIssueType = 'conduct' | 'safety' | 'conflict' | 'complaint' | 'performance' | 'attendance' | 'unsure';
type WizardPersonRole = 'employee' | 'complainant' | 'witness' | 'supervisor' | 'hr';
type WizardDocumentType = 'complaint' | 'witness_statement' | 'policy_note' | 'prior_record' | 'other';

interface WizardPerson {
  name: string;
  role: string;
  department: string;
  employeeId: string;
  involvement: WizardPersonRole;
}

interface WizardDocumentNote {
  title: string;
  type: WizardDocumentType;
  content: string;
  originalText?: string;
  translatedText?: string | null;
  cleanedText?: string;
  detectedLanguage?: string;
  isHandwritten?: boolean;
  pageCount?: number;
  confidence?: number;
  sourceFileName?: string;
  sourceFileType?: string;
  sourceFileUrl?: string;
  processedImageUrls?: string[];
  createdFrom?: 'manual' | 'upload';
  summary?: string;
}

interface GuidedWizardDraft {
  issueType: WizardIssueType | '';
  incidentDate: string;
  location: string;
  department: string;
  shift: string;
  behaviorSummary: string;
  desiredOutcome: string;
  policyTrainingStatus: GuidedReviewAnswers['policyTrainingStatus'];
  repeatedBehaviorStatus: GuidedReviewAnswers['repeatedBehaviorStatus'];
  safetyImpactStatus: GuidedReviewAnswers['safetyImpactStatus'];
  employeeResponseStatus: GuidedReviewAnswers['employeeResponseStatus'];
  riskFlags: GuidedRiskKey[];
  people: WizardPerson[];
  documents: WizardDocumentNote[];
  supervisorNotes: string;
}

const WIZARD_INITIAL_DRAFT: GuidedWizardDraft = {
  issueType: '',
  incidentDate: '',
  location: '',
  department: '',
  shift: '',
  behaviorSummary: '',
  desiredOutcome: '',
  policyTrainingStatus: 'unknown',
  repeatedBehaviorStatus: 'unknown',
  safetyImpactStatus: 'unknown',
  employeeResponseStatus: 'needed',
  riskFlags: [],
  people: [],
  documents: [],
  supervisorNotes: '',
};

const WIZARD_ISSUES: Array<{ key: WizardIssueType; title: string; description: string; caseType: string; icon: any }> = [
  { key: 'conduct', title: 'Employee conduct', description: 'Behavior, policy alignment, professionalism, or workplace expectations.', caseType: 'conduct', icon: Gavel },
  { key: 'safety', title: 'Safety policy concern', description: 'Safety rule, equipment, PPE, hazard, or refusal to follow safe practice.', caseType: 'safety', icon: Shield },
  { key: 'conflict', title: 'Workplace conflict', description: 'Disagreement, communication issue, or team friction needing resolution.', caseType: 'conflict', icon: Users },
  { key: 'complaint', title: 'Complaint review', description: 'A submitted concern needs fact gathering and next-step guidance.', caseType: 'conduct', icon: FileText },
  { key: 'performance', title: 'Performance concern', description: 'Quality, productivity, standards, reliability, or work completion.', caseType: 'conduct', icon: TrendingUp },
  { key: 'attendance', title: 'Attendance or schedule', description: 'Absence, tardiness, schedule compliance, or timekeeping concern.', caseType: 'conduct', icon: Clock },
  { key: 'unsure', title: 'I am not sure', description: 'Let the wizard guide the supervisor through a neutral intake.', caseType: 'other', icon: HelpCircle },
];

const resolveWizardDocumentType = (doc: WizardDocumentNote, complaintIndex: number) => {
  if (doc.type === 'complaint') {
    return complaintIndex === 0 ? 'complaint_a' : complaintIndex === 1 ? 'complaint_b' : 'other';
  }
  if (doc.type === 'policy_note') return 'other';
  return doc.type;
};

const WIZARD_DOCUMENT_TYPE_LABELS: Record<WizardDocumentType, string> = {
  complaint: 'Complaint',
  witness_statement: 'Witness statement',
  policy_note: 'Policy note',
  prior_record: 'Prior record',
  other: 'Other',
};

type AiProgressStatus = 'pending' | 'active' | 'complete';

interface AiProgressItem {
  label: string;
  description: string;
  status: AiProgressStatus;
}

const readinessTone = (score: number) => {
  if (score >= 85) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score >= 65) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
};

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
  reader.readAsDataURL(file);
});

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || dataUrl;

const autoWizardDocumentTitle = (result: OCRResult, fallbackFileName?: string, type: WizardDocumentType = 'complaint') => {
  if (result.generatedTitle?.trim()) return result.generatedTitle.trim();
  if (result.summary?.trim()) return result.summary.trim().split(/[.!?]/)[0].slice(0, 80);
  if (fallbackFileName) return fallbackFileName.replace(/\.[^.]+$/, '').slice(0, 80);
  return `${WIZARD_DOCUMENT_TYPE_LABELS[type]} note`;
};

async function convertWizardUploadToOcrImages(file: File): Promise<string[]> {
  if (file.type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file);
    return [dataUrlToBase64(dataUrl)];
  }

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    const maxPages = Math.min(pdf.numPages, 6);

    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(dataUrlToBase64(canvas.toDataURL('image/jpeg', 0.88)));
    }

    return images;
  }

  return [];
}

function GuidedResolutionWizard({ isOpen, onClose, onCaseCreated, organizationId, userId, policies = [] }: {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (c: ConflictCase) => void;
  organizationId: string;
  userId: string;
  policies?: WorkplacePolicy[];
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<GuidedWizardDraft>(WIZARD_INITIAL_DRAFT);
  const [plan, setPlan] = useState<GuidedActionPlan | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState<WizardPerson>({ name: '', role: '', department: '', employeeId: '', involvement: 'employee' });
  const [newDoc, setNewDoc] = useState<WizardDocumentNote>({ title: '', type: 'complaint', content: '' });
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [docMode, setDocMode] = useState<'manual' | 'upload'>('manual');
  const [docProcessing, setDocProcessing] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');
  const [docSourceLanguage, setDocSourceLanguage] = useState('English');
  const [wizardPolicies, setWizardPolicies] = useState<WorkplacePolicy[]>([]);
  const [intakePlan, setIntakePlan] = useState<GuidedIntakePlan | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [intakeQuestionTextById, setIntakeQuestionTextById] = useState<Record<string, string>>({});
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [aiProgressOpen, setAiProgressOpen] = useState(false);
  const [aiProgressItems, setAiProgressItems] = useState<AiProgressItem[]>([]);
  const [aiProgressTitle, setAiProgressTitle] = useState('Reviewing your answers');
  const [wizardMaximized, setWizardMaximized] = useState(false);
  const [wizardOffset, setWizardOffset] = useState({ x: 0, y: 0 });
  const [wizardSize, setWizardSize] = useState<{ width: number; height: number } | null>(null);
  const [wizardMainRect, setWizardMainRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startY: number; baseWidth: number; baseHeight: number } | null>(null);

	  const draftKey = useMemo(() => `dashmet-guided-resolution:${organizationId}:${userId}`, [organizationId, userId]);
	  const issue = WIZARD_ISSUES.find(item => item.key === draft.issueType);
  const hasWizardContent = Boolean(
    draft.behaviorSummary.trim() ||
    draft.desiredOutcome.trim() ||
    draft.people.length ||
    draft.documents.length ||
    Object.values(intakeAnswers).some(answer => answer.trim())
  );
	  const canGenerate = Boolean(draft.issueType && hasWizardContent);
  const currentIntakeStep: GuidedIntakeStep = 'all';
  const selectedWizardDepartment = departments.find(dept => dept.name === draft.department);
  const policiesForGuidance = wizardPolicies.length ? wizardPolicies : policies;
  const activePolicySections = useMemo(() => {
    return policiesForGuidance
      .filter(policy => policy.status === 'ACTIVE')
      .flatMap(policy => (policy.sections || []).map(section => ({
        policyName: policy.name,
        policyVersion: policy.version,
        sectionNumber: section.sectionNumber,
        title: section.title,
        content: section.content,
        type: section.type,
      })))
      .filter(section => section.content?.trim());
  }, [policiesForGuidance]);
  const currentStepQuestions = useMemo(() => {
    return intakePlan?.questions || [];
  }, [intakePlan]);
  const answeredDynamicCount = useMemo(() => Object.values(intakeAnswers).filter(answer => answer.trim()).length, [intakeAnswers]);
  const requiredCurrentQuestions = currentStepQuestions;
  const missingRequiredCurrentQuestions = useMemo(
    () => requiredCurrentQuestions.filter(question => !intakeAnswers[question.id]?.trim()),
    [requiredCurrentQuestions, intakeAnswers]
  );
  const inputClass = "w-full min-h-[48px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const textareaClass = `${inputClass} min-h-[180px] resize-y leading-relaxed`;

  useEffect(() => {
    if (!isOpen || !draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
	      if (saved) {
	        const parsed = JSON.parse(saved);
	        const savedDraft = { ...WIZARD_INITIAL_DRAFT, ...parsed.draft };
	        setDraft(savedDraft);
	        setPlan(parsed.plan || null);
	        setIntakePlan(parsed.intakePlan || null);
	        setIntakeAnswers(parsed.intakeAnswers || {});
          setIntakeQuestionTextById(parsed.intakeQuestionTextById || {});
	        setStep(savedDraft.issueType ? parsed.step || 0 : 0);
	        setSavedAt(parsed.savedAt || null);
	      }
    } catch {}
  }, [isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    const loadDepartments = async () => {
      setDropdownsLoading(true);
      try {
        const list = await fetchDepartments();
        setDepartments(list);
      } catch (err) {
        console.error('Failed to load wizard departments:', err);
      } finally {
        setDropdownsLoading(false);
      }
    };
    loadDepartments();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    if (policies.length > 0) {
      setWizardPolicies(policies);
      return;
    }
    const loadWizardPolicies = async () => {
      try {
        const list = await fetchPolicies({ organizationId });
        setWizardPolicies(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load wizard policies:', err);
        setWizardPolicies([]);
      }
    };
    loadWizardPolicies();
  }, [isOpen, organizationId, policies]);

  useEffect(() => {
    if (!selectedWizardDepartment?.id) {
      setShifts([]);
      return;
    }
    const loadShifts = async () => {
      setShiftsLoading(true);
      try {
        const list = await fetchShifts({ departmentId: selectedWizardDepartment.id });
        setShifts(list);
      } catch (err) {
        console.error('Failed to load wizard shifts:', err);
      } finally {
        setShiftsLoading(false);
      }
    };
    loadShifts();
  }, [selectedWizardDepartment?.id]);

  useEffect(() => {
    if (!isOpen || !draftKey) return;
    const id = window.setTimeout(() => {
      const nextSavedAt = new Date().toISOString();
      localStorage.setItem(draftKey, JSON.stringify({ draft, plan, intakePlan, intakeAnswers, intakeQuestionTextById, step, savedAt: nextSavedAt }));
      setSavedAt(nextSavedAt);
    }, 450);
    return () => window.clearTimeout(id);
  }, [draft, plan, intakePlan, intakeAnswers, intakeQuestionTextById, step, isOpen, draftKey]);

  useEffect(() => {
    if (!isOpen) return;
    setWizardOffset({ x: 0, y: 0 });
    setWizardMaximized(false);
    setWizardSize(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const main = document.querySelector('main');
    if (!main) return;

    const compute = () => {
      const rect = main.getBoundingClientRect();
      setWizardMainRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    compute();
    const resizeObserver = new ResizeObserver(compute);
    resizeObserver.observe(main);
    const bodyObserver = new ResizeObserver(compute);
    bodyObserver.observe(document.body);
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);

    return () => {
      resizeObserver.disconnect();
      bodyObserver.disconnect();
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (resizeStateRef.current) {
        const maxWidth = Math.max(320, window.innerWidth - 32);
        const maxHeight = Math.max(520, window.innerHeight - 32);
        const minWidth = Math.min(760, maxWidth);
        const minHeight = Math.min(520, maxHeight);
        setWizardSize({
          width: Math.max(minWidth, Math.min(maxWidth, resizeStateRef.current.baseWidth + event.clientX - resizeStateRef.current.startX)),
          height: Math.max(minHeight, Math.min(maxHeight, resizeStateRef.current.baseHeight + event.clientY - resizeStateRef.current.startY)),
        });
        return;
      }
      if (!dragStateRef.current) return;
      const nextX = dragStateRef.current.baseX + event.clientX - dragStateRef.current.startX;
      const nextY = dragStateRef.current.baseY + event.clientY - dragStateRef.current.startY;
      setWizardOffset({
        x: Math.max(-420, Math.min(420, nextX)),
        y: Math.max(-260, Math.min(260, nextY)),
      });
    };

    const handleUp = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startWizardDrag = (event: ReactMouseEvent) => {
    const target = event.target as HTMLElement;
    if (wizardMaximized || target.closest('button, input, select, textarea, label')) return;
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: wizardOffset.x,
      baseY: wizardOffset.y,
    };
    document.body.style.userSelect = 'none';
  };

  const startWizardResize = (event: ReactMouseEvent) => {
    if (wizardMaximized) return;
    event.preventDefault();
    event.stopPropagation();
    const currentWidth = wizardSize?.width ?? Math.min(1360, Math.max(320, window.innerWidth - 32));
    const currentHeight = wizardSize?.height ?? Math.min(880, Math.max(560, Math.round(window.innerHeight * 0.88)));
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: currentWidth,
      baseHeight: currentHeight,
    };
    document.body.style.userSelect = 'none';
  };

  const toggleWizardMaximized = () => {
    setWizardMaximized(prev => {
      if (!prev) setWizardOffset({ x: 0, y: 0 });
      return !prev;
    });
  };

	  const updateDraft = <K extends keyof GuidedWizardDraft>(field: K, value: GuidedWizardDraft[K]) => {
	    setDraft(prev => ({ ...prev, [field]: value }));
	    setError('');
	  };

    const selectIssueType = (issueType: WizardIssueType) => {
      setDraft(prev => ({ ...prev, issueType }));
      setPlan(null);
      setIntakePlan(null);
      setIntakeAnswers({});
      setIntakeQuestionTextById({});
      setError('');
      setIntakeError('');
      setFieldErrors({});
    };

    const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

    const buildAiProgressItems = (result?: GuidedIntakePlan | null): AiProgressItem[] => {
      const fromResult = result?.progressSteps?.filter(Boolean).slice(0, 6).map(stepText => ({
        label: stepText,
        description: 'Completed before opening the next prompt.',
        status: 'pending' as AiProgressStatus,
      }));
      if (fromResult?.length) return fromResult;

      const items = [
        {
          label: draft.issueType ? `Reviewing ${issue?.title || 'selected workplace concern'}` : 'Interpreting the supervisor request',
          description: draft.issueType ? 'The wizard is matching the selected concern to the right employee-relations intake path.' : 'The wizard is preparing the first question.',
          status: 'pending' as AiProgressStatus,
        },
        {
          label: activePolicySections.length ? `Checking ${activePolicySections.length} active policy sections` : 'Checking policy coverage',
          description: activePolicySections.length ? 'The wizard is looking for policy language that may apply without inventing policy requirements.' : 'The wizard is checking whether policy support is available.',
          status: 'pending' as AiProgressStatus,
        },
        {
          label: draft.people.length ? `Reviewing ${draft.people.length} identified participant${draft.people.length === 1 ? '' : 's'}` : 'Deciding whether people details are needed',
          description: draft.people.length ? 'The wizard is checking role, witness, employee-response, and fairness gaps.' : 'The wizard will only request people fields if they are needed for this case.',
          status: 'pending' as AiProgressStatus,
        },
        {
          label: draft.documents.length ? `Reviewing ${draft.documents.length} uploaded or typed record${draft.documents.length === 1 ? '' : 's'}` : 'Deciding whether statements or evidence are needed',
          description: draft.documents.length ? 'The wizard is using the saved notes, statements, and transcriptions already collected.' : 'The wizard will request upload/transcription only when it helps HR review.',
          status: 'pending' as AiProgressStatus,
        },
        {
          label: 'Building the next question',
          description: 'The next prompt is based on the answers already provided and the most important missing information.',
          status: 'pending' as AiProgressStatus,
        },
      ];

      return items;
    };

    const animateAiProgress = async (items: AiProgressItem[]) => {
      const prepared = items.map(item => ({ ...item, status: 'pending' as AiProgressStatus }));
      setAiProgressItems(prepared);
      for (let index = 0; index < prepared.length; index += 1) {
        setAiProgressItems(current => current.map((item, itemIndex) => ({
          ...item,
          status: itemIndex < index ? 'complete' : itemIndex === index ? 'active' : 'pending',
        })));
        await sleep(420);
        setAiProgressItems(current => current.map((item, itemIndex) => ({
          ...item,
          status: itemIndex <= index ? 'complete' : item.status,
        })));
      }
    };

	  const continueWizard = async () => {
	    if (!draft.issueType) {
	      setStep(0);
	      setError('Choose what you need help with first.');
	      return;
	    }
	    if (step > 0 && intakePlan && missingRequiredCurrentQuestions.length > 0) {
        setFieldErrors(Object.fromEntries(missingRequiredCurrentQuestions.map(question => [
          question.id,
          `This is required because ${question.whyNeeded || 'HR needs this before the review can move forward.'}`,
        ])));
	      setError(`The wizard needs ${missingRequiredCurrentQuestions.length} required answer${missingRequiredCurrentQuestions.length === 1 ? '' : 's'} before continuing. Please answer accurately to the best of your knowledge, or state that the information is unknown and needs HR review.`);
	      return;
	    }
      setFieldErrors({});
	    setError('');
      setAiProgressTitle('Reviewing your answers');
      setAiProgressOpen(true);
      const firstAnimation = animateAiProgress(buildAiProgressItems());
      const result = await runIntakeCoach('all');
      await firstAnimation;
      if (!result) {
        setAiProgressOpen(false);
        return;
      }
      if (result.progressSteps?.length) {
        setAiProgressTitle(result.currentStepTitle || 'Next question prepared');
        await animateAiProgress(buildAiProgressItems(result));
      }
      await sleep(220);
      setAiProgressOpen(false);
	    setStep(prev => prev + 1);
	  };

  const handleWizardDocumentFile = async (file: File | null) => {
    if (!file) return;
    setDocProcessing(true);
    setDocUploadError('');
    try {
      const isImageOrPdf = file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let result: OCRResult;

      if (isImageOrPdf) {
        const [source, images] = await Promise.all([
          uploadDocumentSource(file, { organizationId, userId }),
          convertWizardUploadToOcrImages(file),
        ]);
        if (!images.length) {
          throw new Error('DashMet could not read this file. Try a clearer photo, image, or typed document.');
        }
        result = {
          ...(await processDocumentOCR({
            images,
            documentType: newDoc.type,
            sourceLanguage: docSourceLanguage,
          })),
          sourceFileUrl: source.sourceFileUrl,
          sourceFileName: source.sourceFileName,
          sourceFileType: source.sourceFileType,
          sourceFileSize: source.sourceFileSize,
        };
      } else {
        result = await processDocumentFile(file, {
          documentType: newDoc.type,
          sourceLanguage: docSourceLanguage,
          organizationId,
          userId,
        });
      }

      const title = autoWizardDocumentTitle(result, file.name, newDoc.type);
      setNewDoc(prev => ({
        ...prev,
        title,
        content: result.cleanedText || result.translatedText || result.originalText || '',
        originalText: result.originalText,
        translatedText: result.translatedText,
        cleanedText: result.cleanedText,
        detectedLanguage: result.detectedLanguage,
        isHandwritten: result.isHandwritten,
        pageCount: result.pageCount,
        confidence: result.confidence,
        sourceFileName: result.sourceFileName || file.name,
        sourceFileType: result.sourceFileType || file.type,
        sourceFileUrl: result.sourceFileUrl,
        createdFrom: 'upload',
        summary: result.summary,
      }));
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unable to process this document.';
      setDocUploadError(message);
    } finally {
      setDocProcessing(false);
    }
  };

  const buildDynamicAnswerPayload = () => {
    const questionLookup = new Map([
      ...Object.entries(intakeQuestionTextById),
      ...(intakePlan?.questions || []).map(question => [question.id, question.question] as [string, string]),
    ]);
    return Object.entries(intakeAnswers).reduce<Record<string, string>>((acc, [questionId, answer]) => {
      if (answer.trim()) acc[questionLookup.get(questionId) || questionId] = answer.trim();
      return acc;
    }, {});
  };

  const buildGuidedReview = (): GuidedReviewAnswers => ({
    behaviorSummary: draft.behaviorSummary.trim() || Object.entries(buildDynamicAnswerPayload()).map(([question, answer]) => `${question}: ${answer}`).join('\n'),
    policyTrainingStatus: draft.policyTrainingStatus,
    repeatedBehaviorStatus: draft.repeatedBehaviorStatus,
    safetyImpactStatus: draft.safetyImpactStatus,
    employeeResponseStatus: draft.employeeResponseStatus,
    riskFlags: draft.riskFlags,
    supervisorDecisionNotes: [
      draft.desiredOutcome ? `Desired outcome: ${draft.desiredOutcome}` : '',
      draft.supervisorNotes,
      draft.people.length ? `People identified: ${draft.people.map(p => `${p.name} (${p.involvement})`).join(', ')}` : '',
      draft.documents.length ? `Documents or notes collected: ${draft.documents.map(d => d.title).join(', ')}` : '',
      Object.keys(buildDynamicAnswerPayload()).length ? `Dynamic intake answers:\n${Object.entries(buildDynamicAnswerPayload()).map(([question, answer]) => `- ${question}: ${answer}`).join('\n')}` : '',
    ].filter(Boolean).join('\n'),
    updatedAt: new Date().toISOString(),
  });

  const runIntakeCoach = async (stepOverride: GuidedIntakeStep = currentIntakeStep): Promise<GuidedIntakePlan | null> => {
    if (!draft.issueType) {
      setStep(0);
      setError('Choose what you need help with first so the wizard can ask relevant follow-up questions.');
      return null;
    }
    setIntakeLoading(true);
    setIntakeError('');
    setError('');
    try {
      const result = await runGuidedIntakeQuestions({
        caseDetails: {
          caseNumber: 'Wizard intake',
          caseType: issue?.caseType || 'other',
          incidentDate: draft.incidentDate || '',
          location: draft.location || '',
          department: draft.department || '',
          shift: draft.shift || '',
        },
        issueType: draft.issueType,
        currentStep: stepOverride,
        behaviorSummary: draft.behaviorSummary,
        desiredOutcome: draft.desiredOutcome,
        people: draft.people,
        documents: draft.documents.map(doc => ({
          title: doc.title,
          type: doc.type,
          content: doc.content,
          summary: doc.summary,
          createdFrom: doc.createdFrom,
        })),
        guidedReview: buildGuidedReview(),
        dynamicAnswers: buildDynamicAnswerPayload(),
        policySections: activePolicySections,
      });
      setIntakePlan(result);
      setIntakeQuestionTextById(prev => ({
        ...prev,
        ...Object.fromEntries((result.questions || []).map(question => [question.id, question.question])),
      }));
      return result;
    } catch (err: any) {
      setIntakeError(err?.response?.data?.error || err?.message || 'Unable to prepare dynamic intake questions.');
      setError(err?.response?.data?.error || err?.message || 'Unable to prepare dynamic intake questions.');
      return null;
    } finally {
      setIntakeLoading(false);
    }
  };

  const generateGuidance = async () => {
    if (!canGenerate) {
      setError('Select what kind of issue this is and describe the concern before generating guidance.');
      return;
    }
    if (intakePlan && missingRequiredCurrentQuestions.length > 0) {
      setError('Answer the required guidance questions first, or document that the information is unknown and needs HR review.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const guidedReview = buildGuidedReview();
      const complaintDocs = draft.documents.filter(doc => doc.type === 'complaint');
      const result = await runGuidedActionPlan({
        caseDetails: {
          caseNumber: 'Wizard intake',
          caseType: issue?.caseType || 'other',
          incidentDate: draft.incidentDate || '',
          location: draft.location || '',
          department: draft.department || '',
          shift: draft.shift || '',
        },
        complaintA: complaintDocs[0] ? {
          employeeName: draft.people[0]?.name || 'Reporting party',
          text: complaintDocs[0].content,
        } : {
          employeeName: 'Supervisor intake',
          text: guidedReview.behaviorSummary,
        },
        complaintB: complaintDocs[1] ? {
          employeeName: draft.people[1]?.name || 'Other party',
          text: complaintDocs[1].content,
        } : undefined,
        analysisResult: {
          neutralSummary: guidedReview.behaviorSummary,
          missingDetails: intakePlan?.missingInformation || [],
          contradictions: [],
          agreementPoints: [],
          emotionalLanguage: [],
        },
        policySections: activePolicySections,
        dynamicAnswers: buildDynamicAnswerPayload(),
        guidedReview,
      });
      setPlan(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to generate guidance. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

	  const createCaseFromWizard = async () => {
	    if (!canGenerate) {
	      setError('Complete the issue type and fact summary before creating a case.');
	      return;
	    }
    setCreatingCase(true);
	    setError('');
	    try {
	      const review = buildGuidedReview();
	      let complaintIndex = 0;
	      const created = await createCase({
	        caseNumber: generateCaseNumber(),
	        creatorId: userId,
	        organizationId,
	        caseType: issue?.caseType || 'other',
	        status: 'DRAFT',
	        incidentDate: draft.incidentDate ? new Date(draft.incidentDate).toISOString() : new Date().toISOString(),
	        location: draft.location || 'Not specified',
	        department: draft.department || 'Not specified',
	        shift: draft.shift || undefined,
	        description: review.behaviorSummary,
	        employeesJson: draft.people.map(person => ({
	          name: person.name,
	          role: person.role || person.involvement,
	          department: person.department || draft.department || 'Not specified',
	          employeeId: person.employeeId,
	          isComplainant: person.involvement === 'complainant',
	        })),
	        documentsJson: draft.documents.map(doc => {
	          const type = resolveWizardDocumentType(doc, doc.type === 'complaint' ? complaintIndex++ : -1);
	          return {
	            type,
	            content: `${doc.title}\n\n${doc.content}`,
	            originalText: doc.originalText || `${doc.title}\n\n${doc.content}`,
	            cleanedText: doc.cleanedText || doc.content,
	            translatedText: doc.translatedText || undefined,
	            detectedLanguage: doc.detectedLanguage || undefined,
	            isHandwritten: doc.isHandwritten,
	            pageCount: doc.pageCount,
	            sourceFileUrl: doc.sourceFileUrl,
	            originalImageUrls: doc.sourceFileUrl ? [doc.sourceFileUrl] : undefined,
	            processedImageUrls: doc.processedImageUrls,
	            submittedBy: userId,
	          };
	        }),
	        guidedReviewJson: review,
	        guidedActionPlanJson: plan || undefined,
	      });
	      localStorage.removeItem(draftKey);
      setDraft(WIZARD_INITIAL_DRAFT);
      setPlan(null);
      setIntakePlan(null);
      setIntakeAnswers({});
      setIntakeQuestionTextById({});
      setStep(0);
      onCaseCreated(created);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Unable to create case from wizard.');
    } finally {
      setCreatingCase(false);
    }
  };

  const resetWizard = () => {
    localStorage.removeItem(draftKey);
    setDraft(WIZARD_INITIAL_DRAFT);
    setPlan(null);
    setIntakePlan(null);
    setIntakeAnswers({});
    setIntakeQuestionTextById({});
    setStep(0);
    setError('');
    setNewDoc({ title: '', type: 'complaint', content: '' });
    setNewPerson({ name: '', role: '', department: '', employeeId: '', involvement: 'employee' });
    setDocMode('manual');
    setDocUploadError('');
  };

  const renderDynamicAnswerInput = (question: GuidedIntakeQuestion) => {
    const value = intakeAnswers[question.id] || '';
    const questionText = `${question.id} ${question.category} ${question.question}`.toLowerCase();
    const isDepartmentQuestion = questionText.includes('department');
    const isShiftQuestion = questionText.includes('shift');
    const isLocationQuestion = questionText.includes('location') || questionText.includes('where');
    const isCoreFactQuestion = questionText.includes('what happened') || questionText.includes('behavior') || questionText.includes('incident') || question.category.toLowerCase().includes('fact');
    const updateAnswer = (next: string) => {
      setIntakeAnswers(prev => ({ ...prev, [question.id]: next }));
      setFieldErrors(prev => {
        if (!prev[question.id]) return prev;
        const { [question.id]: _removed, ...rest } = prev;
        return rest;
      });
      if (isDepartmentQuestion) {
        updateDraft('department', next as GuidedWizardDraft['department']);
        updateDraft('shift', '');
      } else if (isShiftQuestion) {
        updateDraft('shift', next as GuidedWizardDraft['shift']);
      } else if (isLocationQuestion) {
        updateDraft('location', next as GuidedWizardDraft['location']);
      } else if (isCoreFactQuestion && next.trim().length > draft.behaviorSummary.trim().length) {
        updateDraft('behaviorSummary', next as GuidedWizardDraft['behaviorSummary']);
      }
    };

    const wrapInput = (node: ReactNode) => (
      <div className="space-y-2">
        {node}
        {fieldErrors[question.id] && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 leading-relaxed">
            {fieldErrors[question.id]}
          </div>
        )}
      </div>
    );

    const normalizedQuestion = question.question.trim().toLowerCase();
    const asksForNarrative = /^(can|could|would|will|should)\s+(you|the supervisor|the manager|the user)\s+(describe|explain|summarize|provide|list|upload|attach|enter|type|paste|identify|name)\b/.test(normalizedQuestion);
    const isYesNoPromptQuestion = !asksForNarrative && /^(have|has|had|did|do|does|is|are|was|were|can|could|will|would|should)\b/.test(normalizedQuestion);
    const shouldUseYesNoDropdown = question.answerType === 'yes_no' || (question.answerType !== 'person' && isYesNoPromptQuestion);
    if (shouldUseYesNoDropdown) {
      const yesNoOptions = ['Yes', 'No', 'Unknown / needs review'];
      const selected = yesNoOptions.includes(value) ? value : '';
      return wrapInput(
        <div className="max-w-xl space-y-2">
          <select
            value={selected}
            onChange={e => updateAnswer(e.target.value)}
            className={inputClass}
            title={question.question}
          >
            <option value="">Select answer</option>
            {yesNoOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {question.answerType === 'document' && selected === 'Yes' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Continue after selecting Yes. The wizard will ask for the statement or document only if it is needed for the record.
            </p>
          )}
        </div>
      );
    }

    if (question.answerType === 'person') {
      const addPersonForQuestion = () => {
        if (!newPerson.name.trim()) return;
        const nextPeople = [...draft.people, {
          ...newPerson,
          name: newPerson.name.trim(),
          role: newPerson.role.trim(),
          department: newPerson.department.trim(),
          employeeId: newPerson.employeeId.trim(),
        }];
        setDraft(prev => ({ ...prev, people: nextPeople }));
        setIntakeAnswers(prev => ({
          ...prev,
          [question.id]: nextPeople.map(person => `${person.name} (${person.involvement}${person.role ? `, ${person.role}` : ''}${person.department ? `, ${person.department}` : ''})`).join('; '),
        }));
        setFieldErrors(prev => {
          const { [question.id]: _removed, ...rest } = prev;
          return rest;
        });
        setNewPerson({ name: '', role: '', department: '', employeeId: '', involvement: 'employee' });
      };

      const markNoAdditionalPeople = () => {
        const answer = draft.people.length
          ? `No additional employees, witnesses, supervisors, or HR partners identified beyond: ${draft.people.map(person => `${person.name} (${person.involvement})`).join('; ')}.`
          : 'No employees, witnesses, supervisors, or HR partners have been identified at this time.';
        updateAnswer(answer);
      };

      const personSelection = value.toLowerCase().includes('no additional') || value.toLowerCase().startsWith('no employees')
        ? 'no'
        : value.trim()
          ? 'yes'
          : '';
      const handlePersonSelection = (next: string) => {
        if (next === 'no') {
          markNoAdditionalPeople();
          return;
        }
        if (next === 'yes') {
          const answer = draft.people.length
            ? draft.people.map(person => `${person.name} (${person.involvement}${person.role ? `, ${person.role}` : ''}${person.department ? `, ${person.department}` : ''})`).join('; ')
            : 'Yes. Additional person details will be added below.';
          updateAnswer(answer);
          return;
        }
        updateAnswer('');
      };
      const showPersonEntry = personSelection === 'yes';

      return wrapInput(
        <div className="space-y-4">
          <div className="max-w-xl">
            <select
              value={personSelection}
              onChange={e => handlePersonSelection(e.target.value)}
              className={inputClass}
              title="Additional people or witnesses"
            >
              <option value="">Select answer</option>
              <option value="yes">Yes, add another person</option>
              <option value="no">No additional people</option>
            </select>
          </div>
          {showPersonEntry && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3">
              <input value={newPerson.name} onChange={e => setNewPerson(prev => ({ ...prev, name: e.target.value }))} className={inputClass} placeholder="Name" />
              <input value={newPerson.role} onChange={e => setNewPerson(prev => ({ ...prev, role: e.target.value }))} className={inputClass} placeholder="Role" />
              <select value={newPerson.department} onChange={e => setNewPerson(prev => ({ ...prev, department: e.target.value }))} className={inputClass} title="Person department" disabled={dropdownsLoading}>
                <option value="">{dropdownsLoading ? 'Loading...' : 'Department'}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
              <select value={newPerson.involvement} onChange={e => setNewPerson(prev => ({ ...prev, involvement: e.target.value as WizardPersonRole }))} className={inputClass} title="Involvement">
                <option value="employee">Employee involved</option>
                <option value="complainant">Complainant</option>
                <option value="witness">Witness</option>
                <option value="supervisor">Supervisor</option>
                <option value="hr">HR partner</option>
              </select>
              <button type="button" onClick={addPersonForQuestion} disabled={!newPerson.name.trim()} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 px-4">
                <UserPlus className="w-4 h-4" /> Add
              </button>
            </div>
          )}
          {personSelection === 'no' && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              No additional people will be requested for this question unless the guided review asks for more details later.
            </div>
          )}
          {draft.people.length > 0 && (
            <div className="space-y-2">
              {draft.people.map((person, index) => (
                <div key={`${person.name}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{person.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{person.involvement} - {person.role || 'Role not set'} - {person.department || 'Department not set'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPeople = draft.people.filter((_, i) => i !== index);
                      updateDraft('people', nextPeople);
                      setIntakeAnswers(prev => ({ ...prev, [question.id]: nextPeople.map(item => `${item.name} (${item.involvement})`).join('; ') }));
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (question.answerType === 'document') {
      const addDocumentForQuestion = () => {
        if (!newDoc.content.trim()) return;
        const nextDoc = {
          title: newDoc.title.trim() || 'Wizard note',
          type: newDoc.type,
          content: newDoc.content.trim(),
          originalText: newDoc.originalText,
          translatedText: newDoc.translatedText,
          cleanedText: newDoc.cleanedText || newDoc.content.trim(),
          detectedLanguage: newDoc.detectedLanguage,
          isHandwritten: newDoc.isHandwritten,
          pageCount: newDoc.pageCount,
          confidence: newDoc.confidence,
          sourceFileName: newDoc.sourceFileName,
          sourceFileType: newDoc.sourceFileType,
          sourceFileUrl: newDoc.sourceFileUrl,
          processedImageUrls: newDoc.processedImageUrls,
          createdFrom: newDoc.createdFrom || 'manual',
          summary: newDoc.summary,
        };
        const nextDocuments = [...draft.documents, nextDoc];
        setDraft(prev => ({ ...prev, documents: nextDocuments }));
        setIntakeAnswers(prev => ({
          ...prev,
          [question.id]: nextDocuments.map(doc => `${doc.title} (${doc.type}${doc.createdFrom === 'upload' ? ', uploaded and transcribed' : ''})`).join('; '),
        }));
        setFieldErrors(prev => {
          const { [question.id]: _removed, ...rest } = prev;
          return rest;
        });
        setNewDoc({ title: '', type: 'complaint', content: '' });
        setDocMode('manual');
        setDocUploadError('');
      };

      return wrapInput(
        <div className="space-y-3">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-1">
            {(['manual', 'upload'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setDocMode(mode);
                  setDocUploadError('');
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${docMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'}`}
              >
                {mode === 'manual' ? 'Type note' : 'Upload & transcribe'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <input value={newDoc.title} onChange={e => setNewDoc(prev => ({ ...prev, title: e.target.value }))} className={inputClass} placeholder="Title" />
            <select value={newDoc.type} onChange={e => setNewDoc(prev => ({ ...prev, type: e.target.value as WizardDocumentType }))} className={inputClass} title="Document type">
              <option value="complaint">Complaint</option>
              <option value="witness_statement">Witness statement</option>
              <option value="policy_note">Policy note</option>
              <option value="prior_record">Prior record</option>
              <option value="other">Other</option>
            </select>
          </div>
          {docMode === 'upload' && (
            <div className="rounded-2xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                <label className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  {docProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {docProcessing ? 'Transcribing...' : 'Choose file'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,image/*"
                    disabled={docProcessing}
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      handleWizardDocumentFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                <select value={docSourceLanguage} onChange={e => setDocSourceLanguage(e.target.value)} className={inputClass} title="Source language" disabled={docProcessing}>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {docUploadError && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {docUploadError}
                </div>
              )}
              {newDoc.sourceFileName && (
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-800 dark:text-green-300">
                  Transcribed: {newDoc.sourceFileName}
                  {typeof newDoc.confidence === 'number' ? ` - confidence ${Math.round(newDoc.confidence * 100)}%` : ''}
                  {newDoc.isHandwritten ? ' - handwriting detected' : ''}
                </div>
              )}
            </div>
          )}
          <textarea
            value={newDoc.content}
            onChange={e => setNewDoc(prev => ({ ...prev, content: e.target.value, cleanedText: e.target.value }))}
            rows={6}
            className={textareaClass}
            placeholder={docMode === 'upload' ? 'The transcription will appear here. Correct it before adding.' : 'Type or paste the information requested by the wizard.'}
          />
          <button type="button" onClick={addDocumentForQuestion} disabled={!newDoc.content.trim()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
            <FileUp className="w-4 h-4" /> Add to Wizard
          </button>
          {draft.documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {draft.documents.map((doc, index) => (
                <div key={`${doc.title}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{doc.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{doc.type.replace(/_/g, ' ')}{doc.createdFrom === 'upload' ? ' - uploaded evidence saved' : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDocuments = draft.documents.filter((_, i) => i !== index);
                        updateDraft('documents', nextDocuments);
                        setIntakeAnswers(prev => ({ ...prev, [question.id]: nextDocuments.map(item => `${item.title} (${item.type})`).join('; ') }));
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (question.answerType === 'select' || question.answerType === 'yes_no') {
      const options = question.answerType === 'yes_no'
        ? ['Yes', 'No', 'Unknown / needs review']
        : isDepartmentQuestion
          ? departments.map(dept => dept.name)
          : isShiftQuestion
            ? shifts.map(shiftOption => shiftOption.name)
            : question.options?.length ? question.options : ['Confirmed', 'Not confirmed', 'Unknown'];
      return wrapInput(
        <select value={value} onChange={e => updateAnswer(e.target.value)} className={inputClass} title={question.question}>
          <option value="">{isDepartmentQuestion && dropdownsLoading ? 'Loading departments...' : isShiftQuestion && shiftsLoading ? 'Loading shifts...' : 'Select answer'}</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }

    if (question.answerType === 'date') {
      return wrapInput(<input type={questionText.includes('time') ? 'datetime-local' : 'date'} value={value} onChange={e => updateAnswer(e.target.value)} className={inputClass} title={question.question} />);
    }

    if (question.answerType === 'text') {
      return wrapInput(
        <input
          value={value}
          onChange={e => updateAnswer(e.target.value)}
          className={inputClass}
          placeholder="Answer"
        />
      );
    }

    return wrapInput(
      <textarea
        value={value}
        onChange={e => updateAnswer(e.target.value)}
        rows={6}
        className={textareaClass}
        placeholder="Answer this follow-up question"
      />
    );
  };

  const renderInlineDynamicQuestions = (title: string) => (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-indigo-950/25 dark:via-gray-900 dark:to-sky-950/20 p-5 space-y-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            {title}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            This step is opened after reviewing your prior answers, active policies, missing facts, and HR escalation risk.
          </p>
        </div>
        {intakePlan && (
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${readinessTone(intakePlan.readinessScore)}`}>
            {intakePlan.readinessScore}% · {intakePlan.readinessLabel}
          </span>
        )}
      </div>

      {intakePlan && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Readiness</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{intakePlan.readinessScore}%</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{intakePlan.readinessLabel}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Questions</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{currentStepQuestions.length}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{missingRequiredCurrentQuestions.length} required left</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Answers Saved</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{answeredDynamicCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">preserved in draft</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Policy Sections</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{activePolicySections.length}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">available</p>
            </div>
          </div>

          {intakePlan.summaryAssessment && (
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/20 p-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {intakePlan.summaryAssessment}
            </div>
          )}
        </>
      )}

      {intakeLoading ? (
        <div className="rounded-xl bg-white/80 dark:bg-gray-900/70 border border-indigo-100 dark:border-indigo-900/60 p-5 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          Reviewing your answers, policies, risk signals, and missing documentation before opening the next step.
        </div>
      ) : currentStepQuestions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {currentStepQuestions.map(question => (
            <div key={question.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">{question.category}</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[11px] font-semibold">Required</span>
                  {question.riskArea && <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">{question.riskArea}</span>}
                </div>
                <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{question.question}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{question.whyNeeded}</p>
                {question.policyReference && <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Policy: {question.policyReference}</p>}
              </div>
              {renderDynamicAnswerInput(question)}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-white/70 dark:bg-gray-900/60 p-5 text-sm text-gray-600 dark:text-gray-300">
          Click <span className="font-semibold">Continue</span>. The wizard will analyze your current answers before showing the required follow-up questions for the next step.
        </div>
      )}

      {intakePlan && (intakePlan.missingInformation.length > 0 || intakePlan.recommendedDocuments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {intakePlan.missingInformation.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-3">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Important unknowns
              </p>
              <div className="space-y-1.5">
                {intakePlan.missingInformation.slice(0, 4).map((item, index) => (
                  <p key={index} className="text-xs text-amber-900 dark:text-amber-100">{item}</p>
                ))}
              </div>
            </div>
          )}
          {intakePlan.recommendedDocuments.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/20 p-3">
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Evidence or documents to collect
              </p>
              <div className="space-y-1.5">
                {intakePlan.recommendedDocuments.slice(0, 4).map((doc, index) => (
                  <p key={index} className="text-xs text-blue-900 dark:text-blue-100">
                    <span className="font-semibold">{doc.required ? 'Required' : 'Helpful'}:</span> {doc.title} - {doc.whyNeeded}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const defaultWizardWidth = Math.min(1360, Math.max(320, viewportWidth - 32));
  const defaultWizardHeight = Math.min(880, Math.max(560, Math.round(viewportHeight * 0.88)));
  const wizardShellStyle: CSSProperties = wizardMaximized && wizardMainRect
    ? {
        position: 'fixed',
        top: Math.max(12, wizardMainRect.top + 10),
        left: Math.max(12, wizardMainRect.left + 10),
        width: Math.max(320, wizardMainRect.width - 20),
        height: Math.max(520, wizardMainRect.height - 20),
      }
    : {
        position: 'fixed',
        top: `calc(50% + ${wizardOffset.y}px)`,
        left: `calc(50% + ${wizardOffset.x}px)`,
        transform: 'translate(-50%, -50%)',
        width: wizardSize?.width ?? defaultWizardWidth,
        height: wizardSize?.height ?? defaultWizardHeight,
      };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className={`pointer-events-auto overflow-hidden bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 border border-gray-200 dark:border-gray-700 flex flex-col transition-[top,left,width,height,border-radius] duration-200 ease-out ${
          wizardMaximized ? 'rounded-none' : 'rounded-2xl'
        }`}
        style={wizardShellStyle}
      >
        <div
          onMouseDown={startWizardDrag}
          className={`px-7 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-start justify-between gap-4 select-none ${
            wizardMaximized ? 'cursor-default' : 'cursor-move'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {!wizardMaximized && <GripHorizontal className="w-4 h-4 text-gray-400" />}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Guided Resolution</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                How can I help guide you today in gathering facts to resolve an issue?
              </p>
              {savedAt && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Draft saved {formatDateTime(savedAt)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
            <button onClick={toggleWizardMaximized} title={wizardMaximized ? 'Restore wizard size' : 'Maximize to content area'} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {wizardMaximized ? <Minimize2 className="w-5 h-5 text-gray-500" /> : <Maximize2 className="w-5 h-5 text-gray-500" />}
            </button>
            <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {aiProgressOpen && (
          <div className="absolute inset-x-0 top-[77px] bottom-[73px] z-30 flex items-center justify-center bg-white/95 dark:bg-gray-950/95">
            <div className="relative w-full max-w-xl mx-6 overflow-hidden rounded-3xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950 shadow-2xl">
              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
                    <Sparkles className="w-6 h-6 text-white" />
                    <span className="absolute inset-0 rounded-2xl border border-white/50 animate-ping" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">{aiProgressTitle}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      DashMet is preparing the next prompt inside this wizard.
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {aiProgressItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className={`rounded-2xl border px-4 py-3 transition-all ${
                      item.status === 'complete'
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                        : item.status === 'active'
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30 shadow-sm'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ${
                          item.status === 'complete'
                            ? 'bg-green-600 text-white'
                            : item.status === 'active'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {item.status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : item.status === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-xs">{index + 1}</span>}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[260px_1fr] min-h-0 flex-1">
          <div className="border-r border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-5">
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-300 font-bold">Current focus</p>
              <h3 className="mt-2 text-base font-bold text-gray-900 dark:text-white">
                {step === 0 ? 'Start guided intake' : intakePlan?.currentStepTitle || 'Follow-up'}
              </h3>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {step === 0
                  ? 'Choose what you need help with. The wizard will decide what information is needed next.'
                  : intakePlan?.currentStepPurpose || 'Answer the current questions before moving forward.'}
              </p>
              {intakePlan && (
                <div className="mt-4 space-y-2">
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${readinessTone(intakePlan.readinessScore)}`}>
                    {intakePlan.readinessScore}% · {intakePlan.readinessLabel}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{answeredDynamicCount} answer{answeredDynamicCount === 1 ? '' : 's'} saved</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activePolicySections.length} active policy section{activePolicySections.length === 1 ? '' : 's'} available</p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-y-auto p-7">
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {intakeError && (
              <div className="mb-5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {intakeError}
              </div>
            )}

            {step === 0 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">How can I help guide you today?</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Pick the closest starting point. After that, the wizard only shows what the guided workflow asks for.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {WIZARD_ISSUES.map(option => {
                    const Icon = option.icon;
                    const selected = draft.issueType === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => selectIssueType(option.key)}
                        className={`text-left rounded-2xl border p-4 transition-all ${
                          selected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-600/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-3 ${selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{option.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {renderInlineDynamicQuestions(intakePlan?.currentStepTitle || 'Follow-up questions')}

                {currentStepQuestions.length === 0 && intakePlan && (
                  <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">No additional questions right now</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Generate guidance when you are ready, or continue if you want the wizard to check for another gap.
                    </p>
                  </div>
                )}

                {plan && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Guidance</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${plan.hrReviewRequired ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                          {plan.hrReviewRequired ? 'HR Review Required' : 'Supervisor Review Ready'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{plan.executiveSummary}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{plan.hrReviewReason}</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <WizardList title="Missing information" items={plan.missingInformation} icon={AlertTriangle} />
                      <WizardList title="Supervisor checklist" items={plan.supervisorChecklist} icon={CheckCircle2} />
                      <WizardList title="Conversation questions" items={plan.employeeConversationQuestions} icon={MessageSquare} />
                      <WizardList title="Audit notes" items={plan.auditNotes} icon={FileText} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between gap-3">
          <button onClick={resetWizard} className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">Reset wizard</button>
          <div className="flex items-center gap-3">
            {step > 0 && !plan && (
              <button onClick={generateGuidance} disabled={!canGenerate || generating || intakeLoading} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 flex items-center gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate guidance
              </button>
            )}
	            {!plan ? (
	              <button onClick={continueWizard} disabled={intakeLoading} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait flex items-center gap-2">
                {intakeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button onClick={createCaseFromWizard} disabled={creatingCase || !canGenerate} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {creatingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Case From Wizard
              </button>
            )}
          </div>
        </div>
        {!wizardMaximized && (
          <button
            type="button"
            aria-label="Resize Guided Resolution wizard"
            onMouseDown={startWizardResize}
            className="absolute bottom-2 right-2 h-6 w-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 shadow-sm cursor-nwse-resize flex items-center justify-center hover:border-blue-300 dark:hover:border-blue-700"
          >
            <GripHorizontal className="w-4 h-4 rotate-[-45deg] text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

function WizardList({ title, items, icon: Icon }: { title: string; items: string[]; icon: any }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
              <Icon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No items identified yet.</p>
      )}
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
            <div className="mb-2">
              <div className="relative inline-block">
                <input
                  type="file"
                  accept=".txt,.doc,.docx,.pdf,.md"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const text = ev.target?.result as string;
                      setPolicyText(text);
                      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''));
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                  title="Upload policy file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Upload from file</span>
                </div>
              </div>
            </div>
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
function CasesTab({ cases, loading, onRefresh, onCreateCase, onOpenGuidedWizard, onDeleteCase }: {
  cases: ConflictCase[];
  loading: boolean;
  onRefresh: () => void;
  onCreateCase: () => void;
  onOpenGuidedWizard: () => void;
  onDeleteCase: (id: string, caseNumber: string) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseItem: ConflictCase } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, c: ConflictCase) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, caseItem: c });
  };

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
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 via-white to-indigo-50 dark:from-blue-950/40 dark:via-gray-900 dark:to-indigo-950/40 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Guided Resolution</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-3xl">
                Start a structured wizard to gather facts, identify missing information, flag HR-sensitive risk, and prepare a supervisor-reviewable action plan.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenGuidedWizard}
            className="self-start lg:self-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Sparkles className="w-4 h-4" /> Start Wizard
          </button>
        </div>
      </div>

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
        <button
          onClick={onOpenGuidedWizard}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <Sparkles className="w-4 h-4" /> Guided Wizard
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
            <div className="mt-4 flex items-center gap-3">
              <button onClick={onOpenGuidedWizard} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Start Guided Wizard
              </button>
              <button onClick={onCreateCase} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Case
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_140px_1fr_150px_140px_44px] gap-0 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>Case Number</span>
              <span>Date</span>
              <span>Department</span>
              <span>Location</span>
              <span>Status</span>
              <span>Type</span>
              <span></span>
            </div>
            {/* Scrollable body */}
            <div className="h-[calc(100vh-515px)] overflow-y-auto">
              {filtered.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/hr/case/${c.id}`)}
                  onContextMenu={(e) => handleContextMenu(e, c)}
                  className={`w-full text-left grid grid-cols-[1fr_120px_140px_1fr_150px_140px_44px] gap-0 items-center px-5 py-3.5 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group border-b border-gray-200 dark:border-gray-600`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.caseNumber}</span>
                    {c.isLocked && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {c.incidentDate ? formatDate(c.incidentDate) : '—'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {c.department || '—'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {c.location || '—'}
                  </span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(c.status)}`}>
                      {getStatusLabel(c.status)}
                    </span>
                  </span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getCaseTypeColor(c.type)}`}>
                      {getCaseTypeLabel(c.type)}
                    </span>
                  </span>
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[180px] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl py-1.5"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            onClick={() => { router.push(`/hr/case/${contextMenu.caseItem.id}`); setContextMenu(null); }}
          >
            <Eye className="w-4 h-4 text-blue-500" /> View Case
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            onClick={() => { router.push(`/hr/case/${contextMenu.caseItem.id}?action=report`); setContextMenu(null); }}
          >
            <FileBarChart className="w-4 h-4 text-purple-500" /> Generate Report
          </button>
          <div className="my-1.5 border-t border-gray-100 dark:border-gray-700" />
          <button
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${contextMenu.caseItem.status === 'CLOSED' ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
            onClick={() => { if (contextMenu.caseItem.status !== 'CLOSED') { router.push(`/hr/case/${contextMenu.caseItem.id}?action=close`); setContextMenu(null); } }}
          >
            <XCircle className={`w-4 h-4 ${contextMenu.caseItem.status === 'CLOSED' ? 'text-gray-300 dark:text-gray-600' : 'text-orange-500'}`} /> Close Case
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            onClick={() => { onDeleteCase(contextMenu.caseItem.id, contextMenu.caseItem.caseNumber); setContextMenu(null); }}
          >
            <Trash2 className="w-4 h-4" /> Delete Case
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// POLICIES TAB
// ────────────────────────────────────────────────────────────────────────────────

const sectionTypeIcons: Record<string, any> = {
  OVERVIEW: Eye,
  DEFINITIONS: BookOpen,
  GUIDELINES: FileText,
  PROCEDURES: Target,
  VIOLATIONS: AlertTriangle,
  CONSEQUENCES: Gavel,
  REPORTING: FileUp,
  APPEALS: MessageSquare,
  OTHER: HelpCircle,
};

const sectionTypeLabels: Record<string, string> = {
  OVERVIEW: 'Overview',
  DEFINITIONS: 'Definitions',
  GUIDELINES: 'Guidelines',
  PROCEDURES: 'Procedures',
  VIOLATIONS: 'Violations',
  CONSEQUENCES: 'Consequences',
  REPORTING: 'Reporting',
  APPEALS: 'Appeals',
  OTHER: 'Other',
};

const progressionColors = [
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
];

const progressionLabels = ['1st Offense', '2nd Offense', '3rd Offense', '4th Offense'];

function PoliciesTab({ policies, loading, onRefresh, onCreatePolicy, onDeletePolicy }: {
  policies: WorkplacePolicy[]; loading: boolean; onRefresh: () => void; onCreatePolicy: () => void; onDeletePolicy: (id: string) => void;
}) {
  const [selectedPolicy, setSelectedPolicy] = useState<WorkplacePolicy | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionTypeFilter, setSectionTypeFilter] = useState<string>('ALL');
  const [pdPos, setPdPos] = useState({ x: 0, y: 0 });
  const [pdCentered, setPdCentered] = useState(false);
  const [activating, setActivating] = useState(false);
  const pdDragRef = useRef<HTMLDivElement>(null);
  const pdPosRef = useRef({ x: 0, y: 0 });

  // Center modal on open
  useEffect(() => {
    if (selectedPolicy) {
      const pos = { x: Math.max(0, (window.innerWidth - 1024) / 2), y: Math.max(20, (window.innerHeight - window.innerHeight * 0.85) / 2) };
      setPdPos(pos);
      pdPosRef.current = pos;
      setPdCentered(false);
      requestAnimationFrame(() => setPdCentered(true));
    }
  }, [selectedPolicy]);

  const onPdDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX - pdPosRef.current.x;
    const startY = e.clientY - pdPosRef.current.y;
    const onMove = (ev: MouseEvent) => {
      const next = { x: ev.clientX - startX, y: ev.clientY - startY };
      pdPosRef.current = next;
      setPdPos(next);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const activePolicyCount = policies.filter(p => p.status === 'ACTIVE').length;

  const handleTogglePolicyActive = async () => {
    if (!selectedPolicy) return;
    setActivating(true);
    try {
      const nextStatus = selectedPolicy.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
      const updated = await updatePolicy(selectedPolicy.id, { status: nextStatus });
      setSelectedPolicy(updated);
      onRefresh();
    } catch (err) { console.error('Failed to update policy status:', err); }
    finally { setActivating(false); }
  };

  const sections: PolicySection[] = (() => {
    const raw = selectedPolicy?.sections;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
    return [];
  })();
  const sectionTypeCounts = sections.reduce<Record<string, number>>((acc, s) => {
    const t = s.type || 'OTHER';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const filteredSections = sections
    .filter(s => {
      if (sectionTypeFilter !== 'ALL' && (s.type || 'OTHER') !== sectionTypeFilter) return false;
      if (sectionSearch.trim()) {
        const q = sectionSearch.toLowerCase();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.content?.toLowerCase().includes(q) ||
          s.sectionNumber?.toLowerCase().includes(q) ||
          s.firstProgression?.toLowerCase().includes(q) ||
          s.secondProgression?.toLowerCase().includes(q) ||
          s.thirdProgression?.toLowerCase().includes(q) ||
          s.fourthProgression?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workplace Policies</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage policies used for guided case analysis • {activePolicyCount} active
          </p>
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
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add workplace policies to enable guided policy matching</p>
          <button onClick={onCreatePolicy} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 inline mr-1" /> Add Policy
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map(p => (
            <div
              key={p.id}
              onClick={() => { setSelectedPolicy(p); setExpandedSection(null); setSectionSearch(''); setSectionTypeFilter('ALL'); }}
              className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
            >
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
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  p.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {p.status}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePolicy(p.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete policy"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
              </div>
              {p.description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{p.description}</p>}
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                {p.effectiveDate && <span>Effective: {formatDate(p.effectiveDate)}</span>}
                <span>Created: {formatDate(p.createdAt)}</span>
              </div>
              {p.sections && p.sections.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {p.sections.length} {p.sections.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>
              )}
              {!p.sections?.length && p.originalText && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 max-h-24 overflow-hidden">
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 font-mono">{p.originalText}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Policy Detail Modal ─── */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            ref={pdDragRef}
            className={`absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto ${pdCentered ? 'animate-[bounceIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_forwards]' : 'opacity-0 scale-95'}`}
            style={{ left: pdPos.x, top: pdPos.y }}
          >
            {/* Drag Handle */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={onPdDragStart}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <GripHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{selectedPolicy.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">v{selectedPolicy.version}</span>
                    {selectedPolicy.documentFileName && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">• {selectedPolicy.documentFileName}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPolicy(null)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Stats Row */}
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex-1 text-center py-3 border-r border-gray-200 dark:border-gray-700">
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{sections.length}</p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Sections</p>
              </div>
              <div className="flex-1 text-center py-3 border-r border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-900 dark:text-white">{selectedPolicy.effectiveDate ? formatDate(selectedPolicy.effectiveDate) : '—'}</p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Effective</p>
              </div>
              <div className="flex-1 text-center py-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  selectedPolicy.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {selectedPolicy.status}
                </span>
              </div>
            </div>

            {/* Active Policy Toggle */}
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={handleTogglePolicyActive}
                disabled={activating}
                className={`w-full flex items-center justify-between px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all ${
                  selectedPolicy.status === 'ACTIVE'
                    ? 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-600/25'
                }`}
              >
                <div className="flex items-center gap-2">
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedPolicy.status === 'ACTIVE' ? <XCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {activating ? 'Updating...' : selectedPolicy.status === 'ACTIVE' ? 'Remove From Active Policies' : 'Add To Active Policies'}
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Active Policy Banner */}
            {selectedPolicy.status === 'ACTIVE' && (
              <div className="px-5 py-2.5 bg-green-50 dark:bg-green-900/10 border-b border-green-200 dark:border-green-800/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Included in policy matching. Multiple active policies can be used together.</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {sections.length > 0 ? (
                <div className="p-5 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={sectionSearch}
                      onChange={e => setSectionSearch(e.target.value)}
                      placeholder="Search sections..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Section Type Filter Chips */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    <button
                      onClick={() => setSectionTypeFilter('ALL')}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        sectionTypeFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      All ({sections.length})
                    </button>
                    {Object.entries(sectionTypeCounts).map(([type, count]) => (
                      <button
                        key={type}
                        onClick={() => setSectionTypeFilter(type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                          sectionTypeFilter === type ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {sectionTypeLabels[type] || type} ({count})
                      </button>
                    ))}
                  </div>

                  {/* Sections Table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">Section No</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-44">Policy Type</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Policy</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">1st Violation</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">2nd Violation</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">3rd Violation</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">4th Violation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSections.map(s => {
                          const rawViolations = [s.firstProgression, s.secondProgression, s.thirdProgression, s.fourthProgression];
                          const filled = rawViolations.filter(v => v && v.trim());
                          const v1 = filled[0] || '—';
                          const v2 = filled[1] || '—';
                          const v3 = filled[2] || '—';
                          const v4 = filled[3] || '—';
                          return (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="px-3 py-3">
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{s.sectionNumber}</span>
                              </td>
                              <td className="px-3 py-3">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white">{s.title}</p>
                              </td>
                              <td className="px-3 py-3">
                                <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-3">{s.content}</p>
                              </td>
                              <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v1}</td>
                              <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v2}</td>
                              <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v3}</td>
                              <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v4}</td>
                            </tr>
                          );
                        })}
                        {filteredSections.length === 0 && sectionSearch.trim() && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                              No sections match &ldquo;{sectionSearch}&rdquo;
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedPolicy.originalText ? (
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Original Text</p>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 max-h-[50vh] overflow-y-auto">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{selectedPolicy.originalText}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No sections or text available</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a policy document to extract sections</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ANALYTICS TAB
// ────────────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, loading, onRefresh, onTimeRangeChange, timeRange }: {
  analytics: CaseAnalytics | null; loading: boolean; onRefresh: () => void; onTimeRangeChange: (range: string) => void; timeRange: string;
}) {
  const timeRanges = [
    { value: '30', label: '30 Days' },
    { value: '90', label: '90 Days' },
    { value: '365', label: '12 Months' },
    { value: 'all', label: 'All Time' },
  ];

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
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
            {timeRanges.map(tr => (
              <button
                key={tr.value}
                onClick={() => onTimeRangeChange(tr.value)}
                className={`px-3.5 py-2 text-xs font-semibold transition-colors ${
                  timeRange === tr.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
          <button onClick={onRefresh} title="Refresh" className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
  const [showGuidedWizard, setShowGuidedWizard] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  // Analytics time range
  const [timeRange, setTimeRange] = useState('all');

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
      const params: any = { organizationId: orgId };
      if (timeRange !== 'all') {
        const days = parseInt(timeRange);
        const start = new Date();
        start.setDate(start.getDate() - days);
        params.startDate = start.toISOString();
      }
      const data = await fetchAnalytics(params);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [orgId, timeRange]);

  useEffect(() => {
    loadCases();
    loadPolicies();
  }, [loadCases, loadPolicies]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics && !analyticsLoading) loadAnalytics();
  }, [activeTab, analytics, analyticsLoading, loadAnalytics]);

  const tabs = [
    { id: 'cases' as const, label: 'Cases', icon: FolderOpen, count: cases.length },
    { id: 'policies' as const, label: 'Policies', icon: Shield, count: policies.length },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30">
                    <Scale className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conflict Resolution</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage workplace cases, policies, and guided analysis</p>
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
	      <div className="w-full px-6 lg:px-8 py-6">
	        {activeTab === 'cases' && (
	          <CasesTab
	            cases={cases}
	            loading={casesLoading}
	            onRefresh={loadCases}
	            onCreateCase={() => setShowCreateCase(true)}
	            onOpenGuidedWizard={() => setShowGuidedWizard(true)}
	            onDeleteCase={async (id, caseNumber) => {
	              if (!confirm(`Delete case ${caseNumber}? This action cannot be undone.`)) return;
	              try {
	                await deleteCase(id);
	                setCases(prev => prev.filter(c => c.id !== id));
	              } catch (err) { console.error('Failed to delete case:', err); }
	            }}
	          />
	        )}
        {activeTab === 'policies' && (
          <PoliciesTab
            policies={policies}
            loading={policiesLoading}
            onRefresh={loadPolicies}
            onCreatePolicy={() => setShowCreatePolicy(true)}
            onDeletePolicy={async (id) => {
              if (!confirm('Delete this policy? This cannot be undone.')) return;
              try {
                await deletePolicy(id);
                setPolicies(prev => prev.filter(p => p.id !== id));
              } catch (err) { console.error('Failed to delete policy:', err); }
            }}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            analytics={analytics}
            loading={analyticsLoading}
            onRefresh={loadAnalytics}
            timeRange={timeRange}
            onTimeRangeChange={(range) => {
              setTimeRange(range);
              setAnalytics(null); // force re-fetch
            }}
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
      <GuidedResolutionWizard
        isOpen={showGuidedWizard}
        onClose={() => setShowGuidedWizard(false)}
        onCaseCreated={(c) => {
          setCases(prev => [c, ...prev]);
          router.push(`/hr/case/${c.id}`);
        }}
        organizationId={orgId}
        userId={user?.id || ''}
        policies={policies}
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

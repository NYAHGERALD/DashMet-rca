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
  ArrowLeft,
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
  FileCheck2,
  XCircle,
  Maximize2,
  Minimize2,
  ClipboardList,
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
  GuidedIntakeAnswerFeedback,
  GuidedIntakeInformationAccount,
  GuidedIntakePlan,
  GuidedIntakeQuestion,
  GuidedIntakeResponseQualityFinding,
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
import { DashDatePicker } from '@/components/ui/DashDateTimeFields';

const cleanShiftName = (name?: string | null) => (
  (name || '')
    .replace(/\s*\([^)]*\d{1,2}:\d{2}[^)]*\)\s*/g, ' ')
    .replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const shiftLabel = (shift: ShiftOption) => cleanShiftName(shift.name) || shift.name || 'Unnamed shift';

const normalizeWizardText = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
const wizardFeedbackKey = (feedback: Pick<GuidedIntakeAnswerFeedback, 'question' | 'answer' | 'issue'>) => (
  normalizeWizardText(`${feedback.question || ''}|${feedback.answer || ''}|${feedback.issue || ''}`).toLowerCase()
);
const needsEmployeeProvidedRecordOption = (text: string) => (
  /\b(statement|written|complaint|response|respond|replied|reply|explanation|witness report|employee report|documentation|document|upload|attach|photo|record|handwritten|signed|employee said|employee says|employee explanation|employee reply|complainant statement|affected employee|subject of concern)\b/i.test(text)
);
const WIZARD_MATCH_STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'already', 'also', 'answer', 'because', 'before', 'being',
  'could', 'details', 'during', 'employee', 'employees', 'given', 'have', 'include', 'known',
  'made', 'more', 'needed', 'needs', 'provided', 'question', 'record', 'related', 'review',
  'same', 'should', 'specific', 'status', 'that', 'their', 'there', 'these', 'this', 'those',
  'what', 'when', 'where', 'which', 'while', 'with', 'would'
]);
const wizardMeaningfulTokens = (value?: string | null) => (
  normalizeWizardText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !WIZARD_MATCH_STOP_WORDS.has(token))
);
const wizardTokenOverlapSatisfied = (source?: string | null, target?: string | null, minOverlap = 2) => {
  const sourceTokens = Array.from(new Set(wizardMeaningfulTokens(source)));
  const targetTokens = new Set(wizardMeaningfulTokens(target));
  if (!sourceTokens.length || !targetTokens.size) return false;
  const overlap = sourceTokens.filter(token => targetTokens.has(token)).length;
  return overlap >= Math.min(minOverlap, sourceTokens.length);
};

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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create a new workplace review case with guided support</p>
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
                    <option key={s.id} value={shiftLabel(s)}>{shiftLabel(s)}</option>
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
type WizardPersonRole = 'subject' | 'affected_party' | 'complainant' | 'witness' | 'supervisor' | 'hr' | 'representative' | 'employee' | 'other';
type WizardDocumentType = 'complaint' | 'witness_statement' | 'employee_response' | 'policy_note' | 'prior_record' | 'other';
type WizardStatementStatus = 'provided' | 'not_available' | 'not_applicable';
type WizardFlowStage = 'narrative' | 'people' | 'documents' | 'questions' | 'readiness';

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
  personKey?: string;
  personName?: string;
  personInvolvement?: WizardPersonRole;
  personRole?: string;
  personDepartment?: string;
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
  statementStatuses: Record<string, WizardStatementStatus>;
  supervisorNotes: string;
}

const EMPTY_WIZARD_DOCUMENT_NOTE: WizardDocumentNote = { title: '', type: 'complaint', content: '' };

const WIZARD_INITIAL_DRAFT: GuidedWizardDraft = {
  issueType: 'unsure',
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
  statementStatuses: {},
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

const WIZARD_PERSON_ROLE_OPTIONS: Array<{ value: WizardPersonRole; label: string; description: string }> = [
  { value: 'subject', label: 'Subject of concern', description: 'Employee whose conduct, performance, attendance, or action is being reviewed.' },
  { value: 'affected_party', label: 'Affected employee', description: 'Employee directly impacted by the reported behavior or incident.' },
  { value: 'complainant', label: 'Reporting party / complainant', description: 'Person who reported the concern, whether or not they were directly affected.' },
  { value: 'witness', label: 'Witness', description: 'Person who saw, heard, or has relevant information.' },
  { value: 'supervisor', label: 'Supervisor / manager', description: 'Leader involved in response, review, or decision making.' },
  { value: 'hr', label: 'HR partner', description: 'HR team member involved in guidance or review.' },
  { value: 'representative', label: 'Employee representative', description: 'Union steward, employee representative, translator, or support person if applicable.' },
  { value: 'employee', label: 'Other involved employee', description: 'Employee connected to the matter but not fitting the roles above.' },
  { value: 'other', label: 'Other person', description: 'Any other person relevant to the review.' },
];

const wizardPersonRoleLabel = (role: string) => (
  WIZARD_PERSON_ROLE_OPTIONS.find(option => option.value === role)?.label || role || 'Role not set'
);

const GUIDED_WIZARD_ENGINE_VERSION = 'document-first-employee-records-v4';
const GUIDED_PEOPLE_STAGE_SLOTS = new Set(['involved_people']);
const GUIDED_DOCUMENT_STAGE_SLOTS = new Set([
  'documentation_package',
  'evidence_available',
  'witness_statement_need',
  'employee_response',
]);
const GUIDED_SECONDARY_REVIEW_STAGE_SLOTS = new Set([
  'direct_observation_source',
  'prior_history',
  'training_acknowledgment',
  'policy_or_standard',
]);

const resolveWizardDocumentType = (doc: WizardDocumentNote, complaintIndex: number) => {
  if (doc.type === 'complaint') {
    return complaintIndex === 0 ? 'complaint_a' : complaintIndex === 1 ? 'complaint_b' : 'other';
  }
  if (doc.type === 'employee_response') return 'other';
  if (doc.type === 'policy_note') return 'other';
  return doc.type;
};

interface GuidedWizardStepSnapshot {
  step: number;
  title: string;
  purpose: string;
  readinessScore: number;
  readinessLabel: string;
  questionCount: number;
  requiredCount: number;
  inputFingerprint: string;
  engineVersion: string;
  plan: GuidedIntakePlan;
  analyzedAt: string;
}

const WIZARD_DOCUMENT_TYPE_LABELS: Record<WizardDocumentType, string> = {
  complaint: 'Complaint',
  witness_statement: 'Witness statement',
  employee_response: 'Employee response',
  policy_note: 'Policy note',
  prior_record: 'Prior record',
  other: 'Other',
};

const GUIDED_REVIEW_STATUS_OPTIONS = {
  policyTrainingStatus: [
    { value: 'unknown', label: 'Unknown' },
    { value: 'yes', label: 'Training confirmed' },
    { value: 'no', label: 'Training not confirmed' },
  ],
  repeatedBehaviorStatus: [
    { value: 'unknown', label: 'Unknown' },
    { value: 'first_time', label: 'No prior pattern known' },
    { value: 'repeated', label: 'Prior pattern reported' },
  ],
  safetyImpactStatus: [
    { value: 'unknown', label: 'Unknown' },
    { value: 'yes', label: 'Safety impact reported' },
    { value: 'no', label: 'No safety impact reported' },
  ],
  employeeResponseStatus: [
    { value: 'needed', label: 'Response still needed' },
    { value: 'received', label: 'Response received' },
    { value: 'not_applicable', label: 'Not applicable' },
  ],
} as const;

const GUIDED_RISK_OPTIONS: Array<{ key: GuidedRiskKey; title: string; description: string }> = [
  { key: 'safety_complaint', title: 'Safety policy complaint', description: 'Facts may involve refusal, bypass, or failure to follow safety rules.' },
  { key: 'harassment_or_discrimination', title: 'Harassment or discrimination', description: 'Facts may involve protected class, harassment, bias, or hostile conduct.' },
  { key: 'retaliation_concern', title: 'Retaliation concern', description: 'Action could appear connected to a report, complaint, or protected activity.' },
  { key: 'medical_or_accommodation', title: 'Medical or accommodation', description: 'Facts may involve injury, disability, medical restriction, or accommodation.' },
  { key: 'protected_concerted_activity', title: 'Protected workplace activity', description: 'Facts may involve group concerns about working conditions or labor rights.' },
  { key: 'wage_hour_or_leave', title: 'Wage, hour, or leave', description: 'Facts may involve timekeeping, leave, scheduling, or pay protections.' },
  { key: 'none', title: 'No sensitive risk identified', description: 'No HR-sensitive risk flag has been identified from the available facts.' },
];

const guidedRiskLabel = (key: GuidedRiskKey) => (
  GUIDED_RISK_OPTIONS.find(option => option.key === key)?.title || key.replace(/_/g, ' ')
);

const readinessTone = (score: number) => {
  if (score >= 85) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score >= 65) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
};

const readinessLabelFromScore = (score: number) => {
  if (score >= 100) return 'Ready for supervisor decision';
  if (score >= 85) return 'Supervisor-ready with HR check';
  if (score >= 65) return 'HR review likely';
  if (score >= 35) return 'Needs facts';
  return 'Not ready';
};

const evidenceQualityLabelFromScore = (score: number) => {
  if (score >= 90) return 'Strong response package';
  if (score >= 75) return 'Solid with review notes';
  if (score >= 50) return 'Usable but needs improvement';
  return 'Weak - improve before relying on it';
};

const qualityStatusTone = (status: string) => {
  if (status === 'strong') return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/25 dark:text-green-200 dark:border-green-900';
  if (status === 'partial') return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/25 dark:text-blue-200 dark:border-blue-900';
  if (status === 'weak') return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/25 dark:text-amber-100 dark:border-amber-900';
  return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/25 dark:text-red-200 dark:border-red-900';
};

const WIZARD_FLOW_STEPS: Array<{ stage: WizardFlowStage; title: string; description: string }> = [
  { stage: 'narrative', title: 'Describe the issue', description: 'Opening narrative' },
  { stage: 'people', title: 'Identify involved people', description: 'Reporting party, subject, affected employees, witnesses, and support roles' },
  { stage: 'documents', title: 'Collect handwritten statements', description: 'Complaint, witness statements, employee responses, and records' },
  { stage: 'questions', title: 'Complete remaining questions', description: 'Only questions not answered by source records' },
  { stage: 'readiness', title: 'Review readiness', description: 'Score, gaps, and case creation' },
];

const wizardStageForStep = (step: number): WizardFlowStage => (
  WIZARD_FLOW_STEPS[Math.max(0, Math.min(WIZARD_FLOW_STEPS.length - 1, step))]?.stage || 'narrative'
);

const wizardPersonKey = (person: Pick<WizardPerson, 'name' | 'involvement'>, index?: number) => (
  `${normalizeWizardText(person.name).toLowerCase()}|${person.involvement || ''}|${typeof index === 'number' ? index : ''}`
);

const statementStatusLabel = (status?: WizardStatementStatus) => {
  if (status === 'provided') return 'Statement received';
  if (status === 'not_available') return 'Not available yet';
  if (status === 'not_applicable') return 'Not applicable';
  return 'Needs status';
};

const statementRequirementForPerson = (person: WizardPerson) => {
  switch (person.involvement) {
    case 'complainant':
      return { required: true, label: 'Complaint or reporting statement' };
    case 'affected_party':
      return { required: true, label: 'Affected employee statement' };
    case 'witness':
      return { required: true, label: 'Witness statement' };
    case 'subject':
    case 'employee':
      return { required: true, label: 'Employee response to the concern' };
    case 'supervisor':
      return { required: false, label: 'Supervisor notes if available' };
    case 'hr':
      return { required: false, label: 'HR notes if available' };
    case 'representative':
      return { required: false, label: 'Representative notes if available' };
    default:
      return { required: false, label: 'Supporting statement if available' };
  }
};

const documentRequiresPersonLink = (type?: WizardDocumentType | string) => (
  type === 'complaint' || type === 'witness_statement' || type === 'employee_response'
);

const documentTypeMatchesPersonRequirement = (doc: WizardDocumentNote, person: WizardPerson) => {
  if (person.involvement === 'witness') return doc.type === 'witness_statement';
  if (person.involvement === 'subject' || person.involvement === 'employee') return doc.type === 'employee_response';
  if (person.involvement === 'complainant' || person.involvement === 'affected_party') {
    return doc.type === 'complaint' || doc.type === 'witness_statement';
  }
  return documentRequiresPersonLink(doc.type);
};

const documentBelongsToPerson = (doc: WizardDocumentNote, person: WizardPerson, personKey: string) => {
  if (doc.personKey && doc.personKey === personKey) return true;
  const docPersonName = normalizeWizardText(doc.personName).toLowerCase();
  const personName = normalizeWizardText(person.name).toLowerCase();
  if (!docPersonName || !personName || docPersonName !== personName) return false;
  return !doc.personInvolvement || doc.personInvolvement === person.involvement;
};

const documentSatisfiesPersonStatement = (doc: WizardDocumentNote, person: WizardPerson, personKey: string) => (
  documentBelongsToPerson(doc, person, personKey) && documentTypeMatchesPersonRequirement(doc, person)
);

const wizardNameCue = (name: string) => normalizeWizardText(name).toLowerCase();

const narrativeSuggestsSubjectOfConcern = (person: WizardPerson, narrative: string) => {
  const name = wizardNameCue(person.name);
  const text = normalizeWizardText(narrative).toLowerCase();
  if (!name || !text) return false;
  return [
    `reported that ${name}`,
    `${name} made`,
    `${name} allegedly`,
    `${name}'s behavior`,
    `${name}’s behavior`,
    `${name} behaved`,
    `${name} said`,
    `behavior of ${name}`,
    `conduct of ${name}`,
    `complaint against ${name}`,
    `concern about ${name}`,
    `allegation against ${name}`,
  ].some(cue => text.includes(cue));
};

const narrativeSuggestsReportingParty = (person: WizardPerson, narrative: string) => {
  const name = wizardNameCue(person.name);
  const text = normalizeWizardText(narrative).toLowerCase();
  if (!name || !text) return false;
  return [
    `${name} reported`,
    `${name} complained`,
    `${name} raised`,
    `${name} notified`,
    `reported by ${name}`,
    `complaint from ${name}`,
  ].some(cue => text.includes(cue));
};

const narrativeSuggestsWitness = (person: WizardPerson, narrative: string) => {
  const name = wizardNameCue(person.name);
  const text = normalizeWizardText(narrative).toLowerCase();
  if (!name || !text) return false;
  return [
    `${name} witnessed`,
    `${name} observed`,
    `${name} saw`,
    `${name} heard`,
    `${name} confirmed`,
    `witness ${name}`,
  ].some(cue => text.includes(cue));
};

const narrativeRoleConflictForPerson = (person: WizardPerson, narrative: string) => {
  const subjectCue = narrativeSuggestsSubjectOfConcern(person, narrative);
  const reporterCue = narrativeSuggestsReportingParty(person, narrative);
  const witnessCue = narrativeSuggestsWitness(person, narrative);

  if (subjectCue && person.involvement !== 'subject' && person.involvement !== 'employee') {
    return `${person.name} appears in the description as the person whose conduct may need review, but is marked as ${wizardPersonRoleLabel(person.involvement)}.`;
  }
  if (reporterCue && person.involvement === 'subject') {
    return `${person.name} appears to be a reporting party in the description, but is marked as Subject of concern.`;
  }
  if (witnessCue && person.involvement !== 'witness' && person.involvement !== 'complainant' && person.involvement !== 'affected_party') {
    return `${person.name} appears to have witness information, but is marked as ${wizardPersonRoleLabel(person.involvement)}.`;
  }
  return '';
};

const inferPersonRoleFromNarrative = (name: string, narrative: string): WizardPersonRole => {
  const lowerName = name.toLowerCase();
  const lowerNarrative = narrative.toLowerCase();
  const index = lowerNarrative.indexOf(lowerName);
  const windowText = index >= 0
    ? lowerNarrative.slice(Math.max(0, index - 90), Math.min(lowerNarrative.length, index + lowerName.length + 90))
    : lowerNarrative;
  const syntheticPerson: WizardPerson = { name, role: '', department: '', employeeId: '', involvement: 'employee' };
  if (narrativeSuggestsSubjectOfConcern(syntheticPerson, narrative) || /\b(regarding|toward|accused|alleged|subject|behavior|conduct|made comments|did)\b/.test(windowText)) return 'subject';
  if (narrativeSuggestsWitness(syntheticPerson, narrative) || /\b(witness|saw|heard|observed|confirmed)\b/.test(windowText)) return 'witness';
  if (narrativeSuggestsReportingParty(syntheticPerson, narrative) || /\b(reported|complainant|complaint|raised|stated|told|notified)\b/.test(windowText)) return 'complainant';
  if (/\b(regarding|toward|accused|alleged|subject|behavior|conduct|made comments|did)\b/.test(windowText)) return 'subject';
  if (/\b(affected|impacted|targeted|victim|received|experienced)\b/.test(windowText)) return 'affected_party';
  return 'employee';
};

const extractPersonSuggestionsFromNarrative = (narrative: string): WizardPerson[] => {
  const stopPhrases = new Set([
    'DashMet',
    'Guided Resolution',
    'Human Resources',
    'HR',
    'Food Safety',
    'Quality Assurance',
    'Don Miguel',
    'MegaMex Foods',
  ].map(value => value.toLowerCase()));
  const matches = Array.from(narrative.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g))
    .map(match => match[1].trim())
    .filter(name => {
      const normalized = name.toLowerCase();
      if (stopPhrases.has(normalized)) return false;
      if (/^(During|Additional|Management|Supervisor|Employee|Witness|Complaint|Case|Shift|Line|Department|Safety|Quality)\b/.test(name)) return false;
      return name.split(/\s+/).every(part => part.length > 1);
    });
  return Array.from(new Set(matches)).slice(0, 8).map(name => ({
    name,
    role: '',
    department: '',
    employeeId: '',
    involvement: inferPersonRoleFromNarrative(name, narrative),
  }));
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
  const [newPerson, setNewPerson] = useState<WizardPerson>({ name: '', role: '', department: '', employeeId: '', involvement: 'subject' });
  const [newDoc, setNewDoc] = useState<WizardDocumentNote>(EMPTY_WIZARD_DOCUMENT_NOTE);
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
  const [stepHistory, setStepHistory] = useState<GuidedWizardStepSnapshot[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [aiProgressOpen, setAiProgressOpen] = useState(false);
  const [acknowledgedAnswerFeedback, setAcknowledgedAnswerFeedback] = useState<Record<string, string>>({});
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
	  const canGenerate = Boolean(draft.behaviorSummary.trim() && hasWizardContent);
  const currentWizardStage = wizardStageForStep(step);
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
  const narrativePersonSuggestions = useMemo(() => {
    const existing = new Set(draft.people.map(person => normalizeWizardText(person.name).toLowerCase()));
    return extractPersonSuggestionsFromNarrative(draft.behaviorSummary)
      .filter(person => person.name && !existing.has(normalizeWizardText(person.name).toLowerCase()));
  }, [draft.behaviorSummary, draft.people]);
  const peopleNeedingStatementStatus = useMemo(() => (
    draft.people
      .map((person, index) => ({ person, index, requirement: statementRequirementForPerson(person), key: wizardPersonKey(person, index) }))
      .filter(item => item.requirement.required)
  ), [draft.people]);
  const statementOwnerOptions = useMemo(() => (
    draft.people.map((person, index) => ({
      key: wizardPersonKey(person, index),
      person,
      requirement: statementRequirementForPerson(person),
    }))
  ), [draft.people]);
  const providedStatementMissingLinkedDocument = useMemo(() => (
    peopleNeedingStatementStatus.filter(({ person, key }) => (
      draft.statementStatuses[key] === 'provided' &&
      !draft.documents.some(doc => documentSatisfiesPersonStatement(doc, person, key))
    ))
  ), [draft.documents, draft.statementStatuses, peopleNeedingStatementStatus]);
  const missingStatementStatuses = useMemo(() => (
    peopleNeedingStatementStatus.filter(item => !draft.statementStatuses[item.key])
  ), [draft.people, draft.statementStatuses, peopleNeedingStatementStatus]);
  const statementStatusSummary = useMemo(() => {
    if (!peopleNeedingStatementStatus.length) return '';
    return peopleNeedingStatementStatus
      .map(({ person, requirement, key }) => {
        const linkedDocumentCount = draft.documents.filter(doc => documentSatisfiesPersonStatement(doc, person, key)).length;
        return `${person.name} (${wizardPersonRoleLabel(person.involvement)}): ${requirement.label} - ${statementStatusLabel(draft.statementStatuses[key])}${linkedDocumentCount ? `, ${linkedDocumentCount} linked record${linkedDocumentCount === 1 ? '' : 's'}` : ''}`;
      })
      .join('; ');
  }, [draft.documents, draft.statementStatuses, peopleNeedingStatementStatus]);
	  const currentAllowedWizardSlotIds = useMemo(() => {
    if (currentWizardStage === 'people') return GUIDED_PEOPLE_STAGE_SLOTS;
    if (currentWizardStage === 'documents') return GUIDED_DOCUMENT_STAGE_SLOTS;
    if (currentWizardStage === 'narrative' || currentWizardStage === 'readiness') return new Set<string>();
	    if (!intakePlan) return null;
	    const planSlotIds = new Set<string>(
	      (intakePlan.questions || [])
	        .map(question => question.slotId)
	        .filter((slotId): slotId is string => Boolean(slotId))
	    );
	    const stillInSecondaryStage = Array.from(planSlotIds).some(slotId => GUIDED_SECONDARY_REVIEW_STAGE_SLOTS.has(slotId));
	    if (stillInSecondaryStage) return GUIDED_SECONDARY_REVIEW_STAGE_SLOTS;
	    return null;
	  }, [currentWizardStage, intakePlan]);
	  const guardedWizardStage = useMemo(() => {
    if (currentWizardStage === 'people') {
      return {
        title: 'Identify involved people',
        purpose: 'Review suggested names from the description, add anyone else involved, and assign each person a clear role before statements are requested.',
      };
    }
    if (currentWizardStage === 'documents') {
      return {
        title: 'Collect handwritten statements',
        purpose: 'Upload or enter the complaint, witness statements, employee responses, and any supporting records before deeper review questions appear.',
      };
    }
    if (currentWizardStage === 'questions') {
      return {
        title: 'Complete remaining questions',
        purpose: 'Review any answers found in the records, edit them if needed, and answer only the questions still missing.',
      };
    }
    if (currentWizardStage === 'readiness') {
      return {
        title: 'Review readiness',
        purpose: 'Review readiness, weak areas, source-backed answers, documents, and people before creating the case record.',
      };
    }
	    return null;
	  }, [currentWizardStage]);
  const guardedPeopleQuestion = useMemo<GuidedIntakeQuestion>(() => ({
    id: 'guided_stage_people_required',
    slotId: 'involved_people',
    playbookKey: intakePlan?.caseClassification?.primaryPlaybook || 'general_intake',
    step: 'people',
    category: 'People',
	    question: 'Confirm everyone involved in this situation.',
	    whyNeeded: 'Review the suggested names from the description, add anyone else involved, and identify each role before handwritten statements are requested.',
    answerType: 'person',
    required: true,
  }), [intakePlan?.caseClassification?.primaryPlaybook]);
  const peopleReviewConfirmed = useMemo(() => {
    const answer = normalizeWizardText(intakeAnswers[guardedPeopleQuestion.id]).toLowerCase();
    return Boolean(
      answer &&
      (answer.includes('no additional') || answer.includes('everyone involved has been added') || answer.includes('i confirm'))
    );
  }, [guardedPeopleQuestion.id, intakeAnswers]);
  const guardedDocumentQuestion = useMemo<GuidedIntakeQuestion>(() => ({
    id: 'guided_stage_documents_required',
    slotId: 'documentation_package',
    playbookKey: intakePlan?.caseClassification?.primaryPlaybook || 'general_intake',
    step: 'documents',
    category: 'Documentation',
	    question: 'Add the handwritten complaint, witness statements, employee responses, and supporting records.',
	    whyNeeded: 'The wizard reviews these source records first so it can prefill answers it finds and ask only what is still missing.',
    answerType: 'document',
    required: true,
  }), [intakePlan?.caseClassification?.primaryPlaybook]);
	  const currentStepQuestions = useMemo(() => {
    if (currentWizardStage === 'narrative' || currentWizardStage === 'readiness') return [];
	    const questions = intakePlan?.questions || [];
    if (currentWizardStage === 'people') return [guardedPeopleQuestion];
    if (currentWizardStage === 'documents') return [guardedDocumentQuestion];
	    if (!currentAllowedWizardSlotIds) {
      return questions.filter(question => (
        !question.slotId ||
        (!GUIDED_PEOPLE_STAGE_SLOTS.has(question.slotId) && !GUIDED_DOCUMENT_STAGE_SLOTS.has(question.slotId))
      ));
    }
	    const filtered = questions.filter(question => question.slotId && currentAllowedWizardSlotIds.has(question.slotId));
	    if (filtered.length) return filtered;
	    return questions.filter(question => !question.slotId);
	  }, [currentAllowedWizardSlotIds, currentWizardStage, guardedDocumentQuestion, guardedPeopleQuestion, intakePlan]);
  const answerFeedbackItems = useMemo(() => (
    (intakePlan?.answerFeedback || []).filter(feedback => !acknowledgedAnswerFeedback[wizardFeedbackKey(feedback)])
  ), [intakePlan, acknowledgedAnswerFeedback]);
  const answeredDynamicCount = useMemo(() => Object.values(intakeAnswers).filter(answer => answer.trim()).length, [intakeAnswers]);
  const requiredCurrentQuestions = currentStepQuestions.filter(question => question.required);
  const missingRequiredCurrentQuestions = useMemo(
    () => requiredCurrentQuestions.filter(question => !intakeAnswers[question.id]?.trim()),
    [requiredCurrentQuestions, intakeAnswers]
  );
  const answeredQuestionContexts = useMemo(() => (
    currentStepQuestions
      .map(question => ({
        question,
        answer: intakeAnswers[question.id]?.trim() || '',
      }))
      .filter(item => item.answer)
  ), [currentStepQuestions, intakeAnswers]);
  const isWizardItemSatisfiedLocally = useCallback((label: string) => {
    const normalizedLabel = normalizeWizardText(label).toLowerCase();
    if (!normalizedLabel) return false;
    const answeredByCurrentQuestion = answeredQuestionContexts.some(({ question, answer }) => (
      wizardTokenOverlapSatisfied(label, `${question.question} ${question.category} ${question.whyNeeded} ${answer}`)
    ));
    if (answeredByCurrentQuestion) return true;

    if (/\b(policy|training|trained|acknowledg)/i.test(normalizedLabel) && draft.policyTrainingStatus !== 'unknown') return true;
    if (/\b(safety|injury|hazard|near miss)\b/i.test(normalizedLabel) && draft.safetyImpactStatus !== 'unknown') return true;
    if (/\b(people|person|individual|witness|complainant|subject|affected)\b/i.test(normalizedLabel) && draft.people.length > 0) return true;
    if (/\b(complaint|statement|document|evidence|record|response|reply|handwritten|signed)\b/i.test(normalizedLabel) && draft.documents.length > 0) {
      return draft.documents.some(doc => wizardTokenOverlapSatisfied(label, `${doc.title} ${doc.type} ${doc.summary || ''} ${doc.content}`));
    }
    return false;
  }, [answeredQuestionContexts, draft.documents, draft.people.length, draft.policyTrainingStatus, draft.safetyImpactStatus]);
  const activeMissingInformation = useMemo(() => {
    const openRequired = missingRequiredCurrentQuestions.map(question => question.question);
    if (currentWizardStage === 'people') {
      const missingPeople = draft.people.length
        ? []
        : ['Add every involved person you know about, including the reporting party, subject of concern, affected employee, witnesses, supervisor, HR, representative, or other involved employee.'];
      const unreviewedSuggestions = narrativePersonSuggestions.length
        ? [`Review the ${narrativePersonSuggestions.length} suggested name${narrativePersonSuggestions.length === 1 ? '' : 's'} from the description and add any that belong in this review.`]
        : [];
      const missingConfirmation = draft.people.length > 0 && narrativePersonSuggestions.length === 0 && !peopleReviewConfirmed
        ? ['Confirm that everyone currently known to be involved has been added before moving to handwritten statements.']
        : [];
      return [...missingPeople, ...unreviewedSuggestions, ...missingConfirmation].slice(0, 3);
    }
    if (currentWizardStage === 'documents') {
      const missingStatuses = missingStatementStatuses.map(item => `${item.person.name} needs a statement status before deeper questions appear.`);
      const missingDocument = providedStatementMissingLinkedDocument.map(item => (
        `${item.person.name} is marked as statement received, but no written record is linked to that person yet.`
      ));
      return Array.from(new Set([...missingStatuses, ...missingDocument])).slice(0, 5);
    }
    if (currentWizardStage === 'narrative') {
      return draft.behaviorSummary.trim() ? [] : ['Describe what happened before the wizard identifies people, records, and follow-up questions.'];
    }
    const backendUnknowns = (intakePlan?.missingInformation || []).filter(item => !isWizardItemSatisfiedLocally(item));
    return Array.from(new Set([...openRequired, ...backendUnknowns])).slice(0, 5);
  }, [
    currentWizardStage,
    draft.behaviorSummary,
    draft.documents.length,
    draft.people.length,
    draft.statementStatuses,
    intakePlan?.missingInformation,
    isWizardItemSatisfiedLocally,
    missingRequiredCurrentQuestions,
    missingStatementStatuses,
    narrativePersonSuggestions.length,
    peopleNeedingStatementStatus,
    peopleReviewConfirmed,
    providedStatementMissingLinkedDocument,
  ]);
  const computedReadiness = useMemo(() => {
    if (!intakePlan) return null;
    const requiredSlots = (intakePlan.requiredInformationSlots || []).filter(slot => slot.required);
    const locallyAnsweredSlotIds = new Set(
      currentStepQuestions
        .filter(question => question.required && intakeAnswers[question.id]?.trim())
        .map(question => question.slotId)
        .filter(Boolean)
    );
    const total = requiredSlots.length || currentStepQuestions.filter(question => question.required).length;
    if (!total) {
      return {
        score: 100,
        label: readinessLabelFromScore(100),
        completed: 0,
        total: 0,
      };
    }
    const completed = requiredSlots.length
      ? requiredSlots.filter(slot => slot.completed || locallyAnsweredSlotIds.has(slot.id) || isWizardItemSatisfiedLocally(slot.label)).length
      : currentStepQuestions.filter(question => question.required && intakeAnswers[question.id]?.trim()).length;
    const score = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
    return {
      score,
      label: readinessLabelFromScore(score),
      completed,
      total,
    };
  }, [currentStepQuestions, intakeAnswers, intakePlan, isWizardItemSatisfiedLocally]);
  const stageReadiness = useMemo(() => {
    if (currentWizardStage === 'narrative') {
      const complete = draft.behaviorSummary.trim().length > 0;
      return {
        score: complete ? 100 : 0,
        label: complete ? 'Description complete' : 'Needs description',
        completed: complete ? 1 : 0,
        total: 1,
      };
    }
    if (currentWizardStage === 'people') {
      const remainingSuggestions = narrativePersonSuggestions.length;
      const complete = draft.people.length > 0 && remainingSuggestions === 0 && peopleReviewConfirmed;
      const total = Math.max(draft.people.length + remainingSuggestions + (peopleReviewConfirmed ? 0 : 1), 1);
      const partialScore = draft.people.length ? Math.max(25, Math.round((draft.people.length / total) * 100)) : 0;
      return {
        score: complete ? 100 : partialScore,
        label: complete ? 'List confirmed by user' : draft.people.length ? remainingSuggestions > 0 ? 'Review suggested people' : 'Needs final confirmation' : 'Needs involved people',
        completed: draft.people.length,
        total,
      };
    }
    if (currentWizardStage === 'documents') {
      const total = Math.max(peopleNeedingStatementStatus.length, 1);
      const completedStatuses = peopleNeedingStatementStatus.filter(item => Boolean(draft.statementStatuses[item.key])).length;
      const receivedWithoutRecord = providedStatementMissingLinkedDocument.length > 0;
      const score = receivedWithoutRecord ? Math.min(50, Math.round((completedStatuses / total) * 100)) : Math.round((completedStatuses / total) * 100);
      return {
        score,
        label: score >= 100 ? 'Statement status complete' : 'Needs statement review',
        completed: completedStatuses,
        total,
      };
    }
    if (currentWizardStage === 'questions') {
      const total = Math.max(requiredCurrentQuestions.length, 1);
      const answered = requiredCurrentQuestions.filter(question => intakeAnswers[question.id]?.trim()).length;
      const score = requiredCurrentQuestions.length ? Math.round((answered / total) * 100) : 100;
      return {
        score,
        label: score >= 100 ? 'Questions complete' : `${Math.max(requiredCurrentQuestions.length - answered, 0)} required left`,
        completed: answered,
        total: requiredCurrentQuestions.length,
      };
    }
    return computedReadiness;
  }, [
    computedReadiness,
    currentWizardStage,
    draft.behaviorSummary,
    draft.documents.length,
    draft.people.length,
    draft.statementStatuses,
    intakeAnswers,
    narrativePersonSuggestions.length,
    peopleNeedingStatementStatus,
    peopleReviewConfirmed,
    providedStatementMissingLinkedDocument.length,
    requiredCurrentQuestions,
  ]);
  const reviewableSourceBackedAnswers = useMemo(() => (
    (intakePlan?.sourceBackedAnswers || [])
      .filter(item => item?.sourceTitle && item?.value)
      .slice(0, 6)
  ), [intakePlan?.sourceBackedAnswers]);
	  const activeRecommendedDocuments = useMemo(() => {
    if (currentWizardStage === 'people' || currentWizardStage === 'narrative') return [];
	    const existingDocs = draft.documents;
	    return (intakePlan?.recommendedDocuments || []).filter(doc => {
      const docType = normalizeWizardText(doc.documentType).toLowerCase();
      const docText = `${doc.title} ${doc.documentType} ${doc.whyNeeded}`;
      if (docType && existingDocs.some(existing => normalizeWizardText(existing.type).toLowerCase() === docType)) return false;
      if (existingDocs.some(existing => wizardTokenOverlapSatisfied(docText, `${existing.title} ${existing.type} ${existing.summary || ''} ${existing.content}`))) return false;
      if (answeredQuestionContexts.some(({ question, answer }) => (
        needsEmployeeProvidedRecordOption(`${question.question} ${question.whyNeeded}`) &&
        wizardTokenOverlapSatisfied(docText, `${question.question} ${question.whyNeeded} ${answer}`)
      ))) return false;
	      return true;
	    }).slice(0, 4);
	  }, [answeredQuestionContexts, currentWizardStage, draft.documents, intakePlan?.recommendedDocuments]);
  const deterministicReviewFindings = useMemo<GuidedIntakeResponseQualityFinding[]>(() => {
    const findings: GuidedIntakeResponseQualityFinding[] = [];
    const sourceAnswerCount = (intakePlan?.sourceBackedAnswers || []).length;
    const normalizedNarrative = normalizeWizardText(draft.behaviorSummary).toLowerCase();
    const allegationOrConductReview = Boolean(
      draft.people.length &&
      (
        ['conduct', 'conflict', 'complaint', 'performance', 'attendance', 'unsure'].includes(draft.issueType || '') ||
        /\b(complaint|reported that|alleged|harass|assault|threat|behavior|conduct|comment|retaliat|discriminat|hostile|warning|counsel)\b/.test(normalizedNarrative)
      )
    );

    const addFinding = (
      area: string,
      finding: string,
      improvement: string,
      status: GuidedIntakeResponseQualityFinding['status'] = 'weak',
      score = status === 'missing' ? 15 : status === 'weak' ? 30 : 55,
      source?: string
    ) => {
      findings.push({ area, finding, improvement, status, score, source });
    };

    if (draft.documents.length > 0 && sourceAnswerCount === 0) {
      addFinding(
        'Employee-provided records',
        'Records were added, but the wizard did not find any source-backed answers it can point to for the review questions.',
        'Review the uploaded or typed records for clarity, link each record to the correct person, and add a clearer transcription if the record answers any review question.',
        'weak',
        25
      );
    }

    draft.documents
      .filter(doc => documentRequiresPersonLink(doc.type) && !doc.personKey && !doc.personName)
      .forEach(doc => {
        addFinding(
          'Record ownership',
          `${doc.title || WIZARD_DOCUMENT_TYPE_LABELS[doc.type]} is not linked to the employee who provided it.`,
          'Select the employee who provided this complaint, witness statement, or response so the wizard can use it correctly.',
          'weak',
          30,
          doc.title
        );
      });

    providedStatementMissingLinkedDocument.forEach(({ person, requirement }) => {
      addFinding(
        'Statement verification',
        `${person.name} is marked as "${statementStatusLabel('provided')}", but no ${requirement.label.toLowerCase()} is linked to that person.`,
        `Upload, transcribe, or type ${person.name}'s ${requirement.label.toLowerCase()}, then link it to that person before relying on the review.`,
        'missing',
        20,
        person.name
      );
    });

    peopleNeedingStatementStatus
      .filter(({ person, key }) => draft.statementStatuses[key] === 'not_available')
      .forEach(({ person, requirement }) => {
        addFinding(
          'Missing employee-provided record',
          `${person.name}'s ${requirement.label.toLowerCase()} is not available yet.`,
          `Collect the original handwritten ${requirement.label.toLowerCase()} if available, or document why it could not be obtained before HR relies on the case file.`,
          'partial',
          55,
          person.name
        );
      });

    draft.people.forEach(person => {
      const conflict = narrativeRoleConflictForPerson(person, draft.behaviorSummary);
      if (conflict) {
        addFinding(
          'People and roles',
          conflict,
          'Review the person role before continuing. Role accuracy matters because it controls which statement, response, and HR review steps are required.',
          'weak',
          30,
          person.name
        );
      }
    });

    const hasSubjectOfConcern = draft.people.some(person => person.involvement === 'subject' || person.involvement === 'employee');
    if (allegationOrConductReview && !hasSubjectOfConcern) {
      addFinding(
        'People and roles',
        'No subject of concern or responding employee is identified, even though the description appears to involve reported conduct or a workplace complaint.',
        'Add the employee whose conduct or response is being reviewed, or document why there is no subject of concern for this matter.',
        'missing',
        20
      );
    }

    const hasReportingOrAffectedParty = draft.people.some(person => person.involvement === 'complainant' || person.involvement === 'affected_party');
    if (allegationOrConductReview && !hasReportingOrAffectedParty) {
      addFinding(
        'People and roles',
        'No reporting party, complainant, or affected employee is identified for this review.',
        'Add the person who reported the concern or the employee directly affected by the situation.',
        'missing',
        25
      );
    }

    return findings.slice(0, 12);
  }, [
    draft.behaviorSummary,
    draft.documents,
    draft.issueType,
    draft.people,
    draft.statementStatuses,
    intakePlan?.sourceBackedAnswers,
    peopleNeedingStatementStatus,
    providedStatementMissingLinkedDocument,
  ]);
  const evidenceQualityReview = useMemo(() => {
    const backendScore = intakePlan?.responseStrengthScore ?? intakePlan?.alignmentScore ?? intakePlan?.readinessScore ?? computedReadiness?.score ?? 0;
    const sourceAnswerCount = (intakePlan?.sourceBackedAnswers || []).length;
    const nonInfoFeedback = answerFeedbackItems.filter(item => item.severity !== 'info');
    const deterministicBlockingFindings = deterministicReviewFindings.filter(item => item.status === 'weak' || item.status === 'missing');
    const sourceRecordFinding = deterministicReviewFindings.find(item => item.area === 'Employee-provided records');
    let deterministicCap = 100;

    if (!draft.behaviorSummary.trim()) deterministicCap = Math.min(deterministicCap, 20);
    if (!draft.people.length) deterministicCap = Math.min(deterministicCap, 35);
    if (missingStatementStatuses.length > 0) deterministicCap = Math.min(deterministicCap, 50);
    if (peopleNeedingStatementStatus.length > 0 && !draft.documents.length) deterministicCap = Math.min(deterministicCap, 60);
    if (sourceAnswerCount === 0 && draft.documents.length > 0) deterministicCap = Math.min(deterministicCap, 35);
    if (activeMissingInformation.length > 0) deterministicCap = Math.min(deterministicCap, Math.max(25, 86 - activeMissingInformation.length * 7));
    if (nonInfoFeedback.length > 0) deterministicCap = Math.min(deterministicCap, Math.max(20, 76 - nonInfoFeedback.length * 8));
    if (nonInfoFeedback.some(item => item.severity === 'high_risk')) deterministicCap = Math.min(deterministicCap, 55);
    if (deterministicBlockingFindings.length > 0) deterministicCap = Math.min(deterministicCap, Math.max(18, 72 - deterministicBlockingFindings.length * 10));

    const score = Math.max(0, Math.min(100, Math.round(Math.min(backendScore, deterministicCap))));
    const label = deterministicCap < 75
      ? evidenceQualityLabelFromScore(score)
      : intakePlan?.responseStrengthLabel || evidenceQualityLabelFromScore(score);
    const documentStatus = draft.documents.length
      ? sourceAnswerCount
        ? 'strong'
        : 'weak'
      : peopleNeedingStatementStatus.length
        ? 'missing'
        : 'partial';
    const responseAlignmentIssues = [
      ...nonInfoFeedback,
      ...deterministicReviewFindings.filter(item => ['Response alignment', 'People and roles', 'Statement verification', 'Record ownership'].includes(item.area)),
    ];
    const fallbackAccounting: GuidedIntakeInformationAccount[] = [
      {
        area: 'People and roles',
        status: draft.people.length
          ? deterministicReviewFindings.some(item => item.area === 'People and roles' && (item.status === 'weak' || item.status === 'missing'))
            ? 'weak'
            : deterministicReviewFindings.some(item => item.area === 'People and roles')
              ? 'partial'
              : 'strong'
          : 'missing',
        detail: draft.people.length
          ? `${draft.people.length} involved person${draft.people.length === 1 ? '' : 's'} identified with review roles.`
          : 'No involved people have been identified yet.',
        recommendedImprovement: deterministicReviewFindings.find(item => item.area === 'People and roles')?.improvement || (draft.people.length ? undefined : 'Add the reporting party, subject of concern, affected employee, witnesses, supervisor, HR partner, or other involved people.'),
      },
      {
        area: 'Employee-provided records',
        status: documentStatus,
        detail: draft.documents.length
          ? `${draft.documents.length} record${draft.documents.length === 1 ? '' : 's'} added; ${sourceAnswerCount} source-backed answer${sourceAnswerCount === 1 ? '' : 's'} found for review.`
          : 'No written complaint, witness statement, employee response, or supporting record has been added.',
        recommendedImprovement: sourceRecordFinding?.improvement || (draft.documents.length ? undefined : 'Upload or transcribe the original employee-provided records when they exist.'),
      },
      {
        area: 'Required facts',
        status: activeMissingInformation.length ? (activeMissingInformation.length > 2 ? 'weak' : 'partial') : 'strong',
        detail: activeMissingInformation.length
          ? `${activeMissingInformation.length} important area${activeMissingInformation.length === 1 ? '' : 's'} still need stronger documentation or review.`
          : 'The wizard does not see open required fact gaps from the current record.',
        recommendedImprovement: activeMissingInformation.slice(0, 3).join('; ') || undefined,
      },
      {
        area: 'Response alignment',
        status: responseAlignmentIssues.length ? (responseAlignmentIssues.length > 2 ? 'weak' : 'partial') : 'strong',
        detail: responseAlignmentIssues.length
          ? `${responseAlignmentIssues.length} response, role, or source-record issue${responseAlignmentIssues.length === 1 ? '' : 's'} may weaken the case review if not corrected.`
          : 'Responses, roles, and linked source records currently align with the review structure.',
        recommendedImprovement: nonInfoFeedback[0]?.suggestedAction || deterministicReviewFindings.find(item => ['Response alignment', 'People and roles', 'Statement verification', 'Record ownership'].includes(item.area))?.improvement,
      },
    ];
    const qualityRank: Record<GuidedIntakeInformationAccount['status'], number> = {
      strong: 0,
      partial: 1,
      weak: 2,
      missing: 3,
    };
    const backendAccounting = intakePlan?.informationAccounting || [];
    const accountingByArea = new Map(
      backendAccounting.map(item => [normalizeWizardText(item.area).toLowerCase(), item])
    );
    const accounting = [
      ...fallbackAccounting.map(fallback => {
        const backendItem = accountingByArea.get(normalizeWizardText(fallback.area).toLowerCase());
        if (!backendItem) return fallback;
        if (qualityRank[fallback.status] > qualityRank[backendItem.status]) {
          return {
            ...backendItem,
            status: fallback.status,
            detail: fallback.detail,
            recommendedImprovement: fallback.recommendedImprovement || backendItem.recommendedImprovement,
          };
        }
        return backendItem;
      }),
      ...backendAccounting.filter(item => !fallbackAccounting.some(fallback => normalizeWizardText(fallback.area).toLowerCase() === normalizeWizardText(item.area).toLowerCase())),
    ].slice(0, 8);
    const feedbackFindings = nonInfoFeedback.map(item => ({
      area: item.issue || 'Response quality',
      question: item.question,
      score: item.severity === 'high_risk' ? 30 : 55,
      status: item.severity === 'high_risk' ? 'weak' as const : 'partial' as const,
      finding: item.reason,
      improvement: item.suggestedAction,
      source: item.answer,
    }));
    const findings = [
      ...(intakePlan?.responseQualityFindings || []),
      ...deterministicReviewFindings,
      ...feedbackFindings,
    ].slice(0, 10);
    const strengths = Array.from(new Set([
      ...(intakePlan?.strengthFactors || []),
      draft.people.length && !deterministicReviewFindings.some(item => item.area === 'People and roles' && item.status !== 'partial') ? 'People connected to the matter have been identified with no obvious role conflict.' : '',
      draft.documents.length && sourceAnswerCount ? 'Employee-provided records or supporting notes have been added and source-backed answers were found.' : '',
      sourceAnswerCount ? 'The wizard found source-backed answers in uploaded or typed records.' : '',
      !activeMissingInformation.length ? 'No open required fact gaps are currently visible.' : '',
    ].filter(Boolean))).slice(0, 6);
    const weaknesses = Array.from(new Set([
      ...(intakePlan?.weaknessFactors || []),
      ...activeMissingInformation,
      ...missingStatementStatuses.map(item => `${item.person.name} still needs a statement status`),
      ...deterministicReviewFindings.map(item => item.finding),
      ...nonInfoFeedback.map(item => item.issue || item.reason),
    ].filter(Boolean))).slice(0, 8);
    const deterministicAssessment = deterministicReviewFindings.length
      ? `The current review has ${deterministicReviewFindings.length} source, role, or statement issue${deterministicReviewFindings.length === 1 ? '' : 's'} that should be corrected or reviewed before relying on the case file. ${deterministicReviewFindings[0].finding}`
      : '';

    return {
      score,
      label,
      accounting,
      findings,
      strengths,
      weaknesses,
      assessment: score < 75 && deterministicAssessment
        ? deterministicAssessment
        : intakePlan?.caseStrengthAssessment || intakePlan?.summaryAssessment || 'Review the current information before creating the case record.',
    };
  }, [
    activeMissingInformation,
    answerFeedbackItems,
    computedReadiness?.score,
    deterministicReviewFindings,
    draft.behaviorSummary,
    draft.documents.length,
    draft.people.length,
    intakePlan,
    missingStatementStatuses,
    peopleNeedingStatementStatus.length,
  ]);
  const displayedWizardReadiness = currentWizardStage === 'readiness'
    ? { score: evidenceQualityReview.score, label: evidenceQualityReview.label }
    : stageReadiness;
  const currentStepIsComplete = Boolean(
    (displayedWizardReadiness?.score ?? 0) >= 100 &&
    activeMissingInformation.length === 0 &&
    missingRequiredCurrentQuestions.length === 0 &&
    answerFeedbackItems.length === 0
  );
	  const currentStepStatusMessage = useMemo(() => {
    if (!intakePlan) return '';
    if (activeMissingInformation.length > 0) {
      return `${activeMissingInformation.length} item${activeMissingInformation.length === 1 ? '' : 's'} still need${activeMissingInformation.length === 1 ? 's' : ''} attention on this step.`;
    }
    if (missingRequiredCurrentQuestions.length > 0) {
      return `${missingRequiredCurrentQuestions.length} required item${missingRequiredCurrentQuestions.length === 1 ? '' : 's'} still need${missingRequiredCurrentQuestions.length === 1 ? 's' : ''} a response on this step.`;
    }
    if (answerFeedbackItems.length > 0) {
      return `${answerFeedbackItems.length} response${answerFeedbackItems.length === 1 ? '' : 's'} may need clarification before the wizard relies on them.`;
    }
    if (!currentStepIsComplete) {
      return displayedWizardReadiness?.label || 'This step still needs review before continuing.';
    }
    return 'This step is complete based on the responses and records currently entered.';
  }, [
    activeMissingInformation.length,
    answerFeedbackItems.length,
    currentStepIsComplete,
    displayedWizardReadiness?.label,
    intakePlan,
    missingRequiredCurrentQuestions.length,
  ]);
	  const buildAnalysisFingerprint = useCallback(() => {
    const normalizedAnswers = Object.fromEntries(
      Object.entries(intakeAnswers)
        .map(([key, value]) => [key, normalizeWizardText(value)] as const)
        .filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b))
    );
    const normalizedPeople = draft.people
      .map(person => [
        normalizeWizardText(person.name).toLowerCase(),
        normalizeWizardText(person.involvement).toLowerCase(),
        normalizeWizardText(person.role).toLowerCase(),
        normalizeWizardText(person.department).toLowerCase(),
        normalizeWizardText(person.employeeId).toLowerCase(),
      ].join('|'))
      .sort();
	    const normalizedDocuments = draft.documents
	      .map(doc => [
	        normalizeWizardText(doc.title).toLowerCase(),
        normalizeWizardText(doc.type).toLowerCase(),
        normalizeWizardText(doc.personName).toLowerCase(),
        normalizeWizardText(doc.personInvolvement).toLowerCase(),
        normalizeWizardText(doc.personRole).toLowerCase(),
        normalizeWizardText(doc.personDepartment).toLowerCase(),
        normalizeWizardText(doc.content),
        normalizeWizardText(doc.summary),
	        normalizeWizardText(doc.detectedLanguage).toLowerCase(),
	      ].join('|'))
	      .sort();
    const normalizedStatementStatuses = Object.fromEntries(
      Object.entries(draft.statementStatuses)
        .map(([key, value]) => [key, value] as const)
        .sort(([a], [b]) => a.localeCompare(b))
    );
			    return JSON.stringify({
      engineVersion: GUIDED_WIZARD_ENGINE_VERSION,
	      issueType: draft.issueType || 'unsure',
	      incidentDate: normalizeWizardText(draft.incidentDate),
	      location: normalizeWizardText(draft.location).toLowerCase(),
      department: normalizeWizardText(draft.department).toLowerCase(),
      shift: cleanShiftName(draft.shift).toLowerCase(),
      behaviorSummary: normalizeWizardText(draft.behaviorSummary),
      desiredOutcome: normalizeWizardText(draft.desiredOutcome),
      repeatedBehaviorStatus: draft.repeatedBehaviorStatus,
      safetyImpactStatus: draft.safetyImpactStatus,
      employeeResponseStatus: draft.employeeResponseStatus,
      riskFlags: [...draft.riskFlags].sort(),
	      people: normalizedPeople,
	      documents: normalizedDocuments,
      statementStatuses: normalizedStatementStatuses,
	      answers: normalizedAnswers,
	      acknowledgedAnswerFeedback: Object.keys(acknowledgedAnswerFeedback).sort(),
	    });
  }, [draft, intakeAnswers, acknowledgedAnswerFeedback]);
  const inputClass = "w-full min-h-[48px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const textareaClass = `${inputClass} min-h-[180px] resize-y leading-relaxed`;

  useEffect(() => {
    if (!isOpen || !draftKey) return;
    setPlan(null);
    setIntakePlan(null);
    setIntakeAnswers({});
    setIntakeQuestionTextById({});
    setStepHistory([]);
    setAcknowledgedAnswerFeedback({});
    setFieldErrors({});
    setIntakeError('');
    setError('');
    setStep(0);
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedDraft = { ...WIZARD_INITIAL_DRAFT, ...parsed.draft, issueType: parsed.draft?.issueType || 'unsure', shift: cleanShiftName(parsed.draft?.shift || '') };
        setDraft(savedDraft);
        setSavedAt(parsed.savedAt || null);
      } else {
        setDraft(WIZARD_INITIAL_DRAFT);
        setSavedAt(null);
      }
    } catch {
      setDraft(WIZARD_INITIAL_DRAFT);
      setSavedAt(null);
    }
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
      setDraft(prev => prev.shift ? { ...prev, shift: '' } : prev);
      return;
    }
    const loadShifts = async () => {
      setShiftsLoading(true);
      try {
        const list = await fetchShifts({ departmentId: selectedWizardDepartment.id });
        setShifts(list);
        const labels = list.map(shiftLabel);
        setDraft(prev => prev.shift && !labels.includes(cleanShiftName(prev.shift)) ? { ...prev, shift: '' } : { ...prev, shift: cleanShiftName(prev.shift) });
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
	      localStorage.setItem(draftKey, JSON.stringify({ draft, savedAt: nextSavedAt, engineVersion: GUIDED_WIZARD_ENGINE_VERSION }));
      setSavedAt(nextSavedAt);
    }, 450);
    return () => window.clearTimeout(id);
  }, [draft, isOpen, draftKey]);

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
	    setDraft(prev => ({ ...prev, [field]: field === 'shift' ? cleanShiftName(value as string) as GuidedWizardDraft[K] : value }));
      setPlan(null);
	    setError('');
	  };

    const toggleRiskFlag = (risk: GuidedRiskKey) => {
      const current = new Set(draft.riskFlags);
      if (risk === 'none') {
        updateDraft('riskFlags', current.has('none') ? [] : ['none']);
        return;
      }
      current.delete('none');
      if (current.has(risk)) {
        current.delete(risk);
      } else {
        current.add(risk);
      }
      updateDraft('riskFlags', Array.from(current) as GuidedRiskKey[]);
    };

    const selectIssueType = (issueType: WizardIssueType) => {
      setDraft(prev => ({ ...prev, issueType }));
      setPlan(null);
      setIntakePlan(null);
      setIntakeAnswers({});
      setIntakeQuestionTextById({});
      setStepHistory([]);
      setAcknowledgedAnswerFeedback({});
      setStep(0);
      setError('');
      setIntakeError('');
      setFieldErrors({});
    };

	    const saveAnalyzedStep = (nextStep: number, result: GuidedIntakePlan, inputFingerprint: string) => {
	      const requiredCount = (result.questions || []).filter(question => question.required).length;
      const flowStep = WIZARD_FLOW_STEPS[nextStep];
	      const snapshot: GuidedWizardStepSnapshot = {
	        step: nextStep,
	        title: flowStep?.title || result.currentStepTitle || `Follow-up ${nextStep}`,
	        purpose: flowStep?.description || result.currentStepPurpose || 'Answer the current questions before moving forward.',
        readinessScore: result.readinessScore,
	        readinessLabel: result.readinessLabel,
	        questionCount: result.questions?.length || 0,
	        requiredCount,
	        inputFingerprint,
        engineVersion: GUIDED_WIZARD_ENGINE_VERSION,
	        plan: result,
	        analyzedAt: new Date().toISOString(),
	      };
      setStepHistory(prev => [
        ...prev.filter(item => item.step < nextStep),
        snapshot,
      ]);
    };

    const goToWizardStep = (targetStep: number) => {
      const normalizedStep = Math.max(0, targetStep);
      setError('');
      setIntakeError('');
      setFieldErrors({});
      setPlan(null);

      if (normalizedStep === 0) {
        setStep(0);
        setIntakePlan(null);
        return;
      }

      const snapshot = stepHistory.find(item => item.step === normalizedStep);
      if (!snapshot) return;
      setStep(normalizedStep);
      setIntakePlan(snapshot.plan);
      setIntakeQuestionTextById(prev => ({
        ...prev,
        ...Object.fromEntries((snapshot.plan.questions || []).map(question => [question.id, question.question])),
      }));
    };

	  const continueWizard = async () => {
	    if (!draft.behaviorSummary.trim()) {
	      setStep(0);
	      setError('Describe what happened first so the wizard can ask the right follow-up questions.');
	      return;
	    }

    if (currentWizardStage === 'people' && !draft.people.length) {
      setFieldErrors({ [guardedPeopleQuestion.id]: 'Add every involved person you know about, including the reporting party, subject of concern, affected employee, witnesses, supervisor, HR, representative, or other involved employee.' });
      setError('Identify at least one involved person before the wizard requests handwritten statements.');
      return;
    }
    if (currentWizardStage === 'people' && narrativePersonSuggestions.length > 0) {
      setFieldErrors({ [guardedPeopleQuestion.id]: 'Review the suggested names from the description. Add each person that belongs in the review before continuing.' });
      setError('Review all suggested people from the description before moving to handwritten statements.');
      return;
    }
    if (currentWizardStage === 'people' && !peopleReviewConfirmed) {
      setFieldErrors({ [guardedPeopleQuestion.id]: 'Confirm that everyone currently known to be involved has been added before continuing.' });
      setError('Confirm the involved people list before the wizard requests handwritten statements.');
      return;
    }

    if (currentWizardStage === 'documents' && missingStatementStatuses.length > 0) {
      setFieldErrors({ [guardedDocumentQuestion.id]: 'Set the statement status for each required person before moving forward. Use Not available yet or Not applicable when the statement cannot be added now.' });
      setError(`${missingStatementStatuses.length} required statement status${missingStatementStatuses.length === 1 ? '' : 'es'} still need${missingStatementStatuses.length === 1 ? 's' : ''} review before deeper questions appear.`);
      return;
    }
    if (
      currentWizardStage === 'documents' &&
      providedStatementMissingLinkedDocument.length > 0
    ) {
      setFieldErrors({ [guardedDocumentQuestion.id]: 'A statement is marked as received, but no written record is linked to that person. Select the employee, upload/transcribe or type the record, then add it to the wizard.' });
      setError(`Add the received handwritten statement for ${providedStatementMissingLinkedDocument.map(item => item.person.name).join(', ')} or mark the statement as not available yet before moving forward.`);
      return;
    }

	    if (currentWizardStage === 'questions' && intakePlan && missingRequiredCurrentQuestions.length > 0) {
        setFieldErrors(Object.fromEntries(missingRequiredCurrentQuestions.map(question => [
          question.id,
          `This is required because ${question.whyNeeded || 'HR needs this before the review can move forward.'}`,
        ])));
	      setError(`The wizard needs ${missingRequiredCurrentQuestions.length} required answer${missingRequiredCurrentQuestions.length === 1 ? '' : 's'} before continuing. Please answer accurately to the best of your knowledge, or state that the information is unknown and needs HR review.`);
	      return;
	    }

      if (currentWizardStage === 'readiness') {
        await createCaseFromWizard();
        return;
      }

      setFieldErrors({});
	    setError('');
      const inputFingerprint = buildAnalysisFingerprint();
      const nextStep = Math.min(step + 1, WIZARD_FLOW_STEPS.length - 1);
      const cachedNextStep = stepHistory.find(snapshot => snapshot.step === nextStep);
      if (
        cachedNextStep &&
        cachedNextStep.inputFingerprint === inputFingerprint &&
        cachedNextStep.engineVersion === GUIDED_WIZARD_ENGINE_VERSION
      ) {
	        goToWizardStep(nextStep);
	        return;
	      }
      setAiProgressOpen(true);
      const result = await runIntakeCoach('all');
      setAiProgressOpen(false);
      if (!result) return;

      if (currentWizardStage === 'people') {
        setIntakeAnswers(prev => ({
          ...prev,
          [guardedPeopleQuestion.id]: draft.people.map(person => `${person.name} (${wizardPersonRoleLabel(person.involvement)}${person.role ? `, ${person.role}` : ''}${person.department ? `, ${person.department}` : ''})`).join('; '),
        }));
      }
      if (currentWizardStage === 'documents') {
        setIntakeAnswers(prev => ({
          ...prev,
          [guardedDocumentQuestion.id]: [
            draft.documents.length ? draft.documents.map(doc => `${doc.title} (${WIZARD_DOCUMENT_TYPE_LABELS[doc.type]}${doc.personName ? ` for ${doc.personName}` : ''})`).join('; ') : 'No uploaded or typed records were added in this step.',
            statementStatusSummary ? `Statement status: ${statementStatusSummary}` : '',
          ].filter(Boolean).join('\n'),
        }));
      }

      saveAnalyzedStep(nextStep, result, inputFingerprint);
	    setStep(nextStep);
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
    const payload = Object.entries(intakeAnswers).reduce<Record<string, string>>((acc, [questionId, answer]) => {
      if (answer.trim()) acc[questionLookup.get(questionId) || questionId] = answer.trim();
      return acc;
    }, {});
	    Object.entries(acknowledgedAnswerFeedback).forEach(([key, note]) => {
	      payload[`Response clarification acknowledged: ${key.slice(0, 140)}`] = note;
	    });
    if (statementStatusSummary) {
      payload['Handwritten statement status by involved person'] = statementStatusSummary;
    }
	    return payload;
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
      statementStatusSummary ? `Statement status: ${statementStatusSummary}` : '',
	      Object.keys(buildDynamicAnswerPayload()).length ? `Dynamic intake answers:\n${Object.entries(buildDynamicAnswerPayload()).map(([question, answer]) => `- ${question}: ${answer}`).join('\n')}` : '',
    ].filter(Boolean).join('\n'),
    updatedAt: new Date().toISOString(),
  });

  const runIntakeCoach = async (stepOverride: GuidedIntakeStep = currentIntakeStep): Promise<GuidedIntakePlan | null> => {
    if (!draft.behaviorSummary.trim()) {
      setStep(0);
      setError('Describe what happened first so the wizard can understand the situation and ask relevant follow-up questions.');
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
          shift: cleanShiftName(draft.shift) || '',
        },
        issueType: draft.issueType || 'unsure',
        currentStep: stepOverride,
        behaviorSummary: draft.behaviorSummary,
        desiredOutcome: draft.desiredOutcome,
        people: draft.people,
        documents: draft.documents.map(doc => ({
          title: doc.title,
          type: doc.type,
          personName: doc.personName,
          personInvolvement: doc.personInvolvement,
          personRole: doc.personRole,
          personDepartment: doc.personDepartment,
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
      const sourceBackedBySlot = new Map(
        (result.sourceBackedAnswers || [])
          .filter(item => item?.slotId && item?.value)
          .map(item => [item.slotId, item])
      );
      const prefilledAnswers = Object.fromEntries(
        (result.questions || [])
          .map(question => {
            const sourceAnswer = question.slotId ? sourceBackedBySlot.get(question.slotId) : null;
            if (!sourceAnswer || intakeAnswers[question.id]?.trim()) return null;
            const sourceNote = [
              sourceAnswer.value,
              '',
              `Found in: ${sourceAnswer.sourceTitle || 'uploaded record'}`,
              sourceAnswer.excerpt ? `Review note: ${sourceAnswer.excerpt}` : '',
            ].filter(Boolean).join('\n');
            return [question.id, sourceNote] as const;
          })
          .filter((entry): entry is readonly [string, string] => Boolean(entry))
      );
      if (Object.keys(prefilledAnswers).length) {
        setIntakeAnswers(prev => ({ ...prefilledAnswers, ...prev }));
      }
	      return result;
    } catch (err: any) {
      setIntakeError(err?.response?.data?.error || err?.message || 'Unable to prepare dynamic intake questions.');
      setError(err?.response?.data?.error || err?.message || 'Unable to prepare dynamic intake questions.');
      return null;
    } finally {
      setIntakeLoading(false);
    }
  };

  const generateGuidance = async (planOverride?: GuidedIntakePlan) => {
    if (!canGenerate) {
      setError('Describe what happened before generating guidance.');
      return;
    }
    const guidanceSourcePlan = planOverride || intakePlan;
    if (!planOverride && intakePlan && missingRequiredCurrentQuestions.length > 0) {
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
          shift: cleanShiftName(draft.shift) || '',
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
          missingDetails: guidanceSourcePlan?.missingInformation || [],
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
	      setError('Complete the incident description before creating a case.');
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
	        shift: cleanShiftName(draft.shift) || undefined,
	        description: review.behaviorSummary,
	        employeesJson: draft.people.map(person => ({
	          name: person.name,
	          role: person.role || wizardPersonRoleLabel(person.involvement),
	          department: person.department || draft.department || 'Not specified',
	          employeeId: person.employeeId,
	          isComplainant: person.involvement === 'complainant',
	        })),
	        documentsJson: draft.documents.map(doc => {
	          const type = resolveWizardDocumentType(doc, doc.type === 'complaint' ? complaintIndex++ : -1);
          const personContext = doc.personName
            ? `Linked person: ${doc.personName} (${wizardPersonRoleLabel(doc.personInvolvement || 'other')}${doc.personRole ? `, ${doc.personRole}` : ''}${doc.personDepartment ? `, ${doc.personDepartment}` : ''})\n\n`
            : '';
	          return {
	            type,
	            content: `${doc.title}\n\n${personContext}${doc.content}`,
	            originalText: doc.originalText || `${doc.title}\n\n${personContext}${doc.content}`,
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
      setStepHistory([]);
      setAcknowledgedAnswerFeedback({});
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
    setStepHistory([]);
    setAcknowledgedAnswerFeedback({});
    setStep(0);
    setError('');
    setNewDoc(EMPTY_WIZARD_DOCUMENT_NOTE);
    setNewPerson({ name: '', role: '', department: '', employeeId: '', involvement: 'subject' });
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
      setPlan(null);
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

    const shouldOfferDocumentCapture = needsEmployeeProvidedRecordOption(questionText);
    const addDocumentForQuestion = () => {
      if (!newDoc.content.trim()) return;
      const selectedOwner = statementOwnerOptions.find(option => option.key === newDoc.personKey);
      if (documentRequiresPersonLink(newDoc.type) && statementOwnerOptions.length > 0 && !selectedOwner) {
        setFieldErrors(prev => ({
          ...prev,
          [question.id]: 'Select the employee this complaint, witness statement, or employee response belongs to before adding it.',
        }));
        return;
      }
      const nextDoc = {
        title: newDoc.title.trim() || 'Wizard note',
        type: newDoc.type,
        content: newDoc.content.trim(),
        personKey: selectedOwner?.key,
        personName: selectedOwner?.person.name,
        personInvolvement: selectedOwner?.person.involvement,
        personRole: selectedOwner?.person.role,
        personDepartment: selectedOwner?.person.department,
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
      setDraft(prev => {
        const nextStatuses = { ...prev.statementStatuses };
        if (selectedOwner && documentSatisfiesPersonStatement(nextDoc, selectedOwner.person, selectedOwner.key)) {
          nextStatuses[selectedOwner.key] = 'provided';
        }
        return { ...prev, documents: nextDocuments, statementStatuses: nextStatuses };
      });
      setPlan(null);
      setIntakeAnswers(prev => ({
        ...prev,
        [question.id]: nextDocuments.map(doc => `${doc.title} (${doc.type}${doc.personName ? `, for ${doc.personName}` : ''}${doc.createdFrom === 'upload' ? ', uploaded and transcribed' : ''})`).join('; '),
      }));
      setFieldErrors(prev => {
        const { [question.id]: _removed, ...rest } = prev;
        return rest;
      });
      setNewDoc(EMPTY_WIZARD_DOCUMENT_NOTE);
      setDocMode('manual');
      setDocUploadError('');
    };

    const renderDocumentCapturePanel = (supplemental = false) => (
      <div className={`space-y-3 ${supplemental ? 'mt-4 rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/10 p-4' : ''}`}>
        {supplemental && (
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileUp className="w-4 h-4 text-blue-600" />
              Add written record
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Upload an employee complaint, response, witness report, photo, or related written statement when it supports this answer.
            </p>
          </div>
        )}
	        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
	          Keep the original handwritten complaint, response, witness report, or statement for HR audit documentation. Employees should write their own statement whenever possible, including in their preferred language; retain both the original handwritten record and any translated copy.
	        </div>
        {peopleNeedingStatementStatus.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 p-3 space-y-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Statement checklist</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mark each required statement as received, not available yet, or not applicable. This keeps the review honest without forcing users to type what should come from employee records.
              </p>
            </div>
            {peopleNeedingStatementStatus.map(({ person, requirement, key }) => {
              const linkedDocuments = draft.documents.filter(doc => documentSatisfiesPersonStatement(doc, person, key));
              return (
              <div key={key} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{person.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {wizardPersonRoleLabel(person.involvement)} · {requirement.label}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${linkedDocuments.length ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {linkedDocuments.length ? `${linkedDocuments.length} linked record${linkedDocuments.length === 1 ? '' : 's'}` : 'No linked record yet'}
                  </p>
                </div>
                <select
                  value={draft.statementStatuses[key] || ''}
                  onChange={e => {
                    const nextStatus = e.target.value as WizardStatementStatus | '';
                    setDraft(prev => {
                      const nextStatuses = { ...prev.statementStatuses };
                      if (nextStatus) nextStatuses[key] = nextStatus;
                      else delete nextStatuses[key];
                      return { ...prev, statementStatuses: nextStatuses };
                    });
                    setPlan(null);
                    const nextSummary = peopleNeedingStatementStatus
                      .map(item => {
                        const status = item.key === key ? nextStatus || undefined : draft.statementStatuses[item.key];
                        return `${item.person.name}: ${statementStatusLabel(status)}`;
                      })
                      .join('; ');
                    updateAnswer(nextSummary);
                  }}
                  className={inputClass}
                  title={`Statement status for ${person.name}`}
                >
                  <option value="">Set status</option>
                  <option value="provided">Statement received</option>
                  <option value="not_available">Not available yet</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </div>
              );
            })}
          </div>
        )}
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_260px] gap-3">
          <input value={newDoc.title} onChange={e => setNewDoc(prev => ({ ...prev, title: e.target.value }))} className={inputClass} placeholder="Title" />
	          <select value={newDoc.type} onChange={e => setNewDoc(prev => ({ ...prev, type: e.target.value as WizardDocumentType }))} className={inputClass} title="Document type">
	            <option value="complaint">Employee complaint</option>
	            <option value="witness_statement">Witness statement</option>
	            <option value="employee_response">Employee response</option>
	            <option value="policy_note">Policy note</option>
            <option value="prior_record">Prior record</option>
            <option value="other">Other</option>
          </select>
          <select
            value={newDoc.personKey || ''}
            onChange={e => {
              const selected = statementOwnerOptions.find(option => option.key === e.target.value);
              setNewDoc(prev => ({
                ...prev,
                personKey: selected?.key,
                personName: selected?.person.name,
                personInvolvement: selected?.person.involvement,
                personRole: selected?.person.role,
                personDepartment: selected?.person.department,
              }));
            }}
            className={inputClass}
            title="Statement owner"
            disabled={!statementOwnerOptions.length}
          >
            <option value="">{statementOwnerOptions.length ? 'Select employee' : 'Add involved people first'}</option>
            {statementOwnerOptions.map(({ key, person, requirement }) => (
              <option key={key} value={key}>
                {person.name} - {wizardPersonRoleLabel(person.involvement)} - {requirement.label}
              </option>
            ))}
          </select>
        </div>
        {documentRequiresPersonLink(newDoc.type) && statementOwnerOptions.length > 0 && !newDoc.personKey && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Select the employee this record belongs to so the wizard can track whose complaint, witness statement, or employee response has been received.
          </div>
        )}
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
        <button
          type="button"
          onClick={addDocumentForQuestion}
          disabled={!newDoc.content.trim() || (documentRequiresPersonLink(newDoc.type) && statementOwnerOptions.length > 0 && !newDoc.personKey)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
        >
          <FileUp className="w-4 h-4" /> Add to Wizard
        </button>
        {draft.documents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {draft.documents.map((doc, index) => (
              <div key={`${doc.title}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{doc.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.type.replace(/_/g, ' ')}
                      {doc.personName ? ` - linked to ${doc.personName} (${wizardPersonRoleLabel(doc.personInvolvement || 'other')})` : ''}
                      {doc.createdFrom === 'upload' ? ' - uploaded evidence saved' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDocuments = draft.documents.filter((_, i) => i !== index);
                      updateDraft('documents', nextDocuments);
                      setPlan(null);
                      setIntakeAnswers(prev => ({ ...prev, [question.id]: nextDocuments.map(item => `${item.title} (${item.type}${item.personName ? `, for ${item.personName}` : ''})`).join('; ') }));
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

    const wrapInput = (node: ReactNode) => (
      <div className="space-y-2">
        {node}
        {shouldOfferDocumentCapture && question.answerType !== 'document' && renderDocumentCapturePanel(true)}
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
    const shouldUseYesNoDropdown = question.answerType === 'yes_no' || (question.answerType !== 'person' && question.answerType !== 'document' && isYesNoPromptQuestion);
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
        setPlan(null);
        setIntakeAnswers(prev => ({
          ...prev,
          [question.id]: nextPeople.map(person => `${person.name} (${wizardPersonRoleLabel(person.involvement)}${person.role ? `, ${person.role}` : ''}${person.department ? `, ${person.department}` : ''})`).join('; '),
        }));
        setFieldErrors(prev => {
          const { [question.id]: _removed, ...rest } = prev;
          return rest;
        });
        setNewPerson({ name: '', role: '', department: '', employeeId: '', involvement: 'subject' });
      };

      const markNoAdditionalPeople = () => {
        const answer = draft.people.length
          ? `I confirm everyone involved has been added. No additional subjects of concern, affected employees, reporting parties, witnesses, supervisors, HR partners, representatives, or other involved people identified beyond: ${draft.people.map(person => `${person.name} (${wizardPersonRoleLabel(person.involvement)})`).join('; ')}.`
          : 'No subjects of concern, affected employees, reporting parties, witnesses, supervisors, HR partners, representatives, or other involved people have been identified at this time.';
        updateAnswer(answer);
      };

      const normalizedPersonAnswer = value.toLowerCase();
      const personSelection = normalizedPersonAnswer.includes('no additional') || normalizedPersonAnswer.includes('everyone involved has been added') || normalizedPersonAnswer.startsWith('no employees')
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
            ? draft.people.map(person => `${person.name} (${wizardPersonRoleLabel(person.involvement)}${person.role ? `, ${person.role}` : ''}${person.department ? `, ${person.department}` : ''})`).join('; ')
            : 'Yes. Additional person details will be added below.';
          updateAnswer(answer);
          return;
        }
	        updateAnswer('');
	      };
      const addSuggestedPerson = (person: WizardPerson) => {
        const nextPeople = [...draft.people, {
          ...person,
          name: person.name.trim(),
          role: person.role.trim(),
          department: person.department.trim(),
          employeeId: person.employeeId.trim(),
        }];
        setDraft(prev => ({ ...prev, people: nextPeople }));
        setPlan(null);
        setIntakeAnswers(prev => ({
          ...prev,
          [question.id]: nextPeople.map(item => `${item.name} (${wizardPersonRoleLabel(item.involvement)}${item.role ? `, ${item.role}` : ''}${item.department ? `, ${item.department}` : ''})`).join('; '),
        }));
        setFieldErrors(prev => {
          const { [question.id]: _removed, ...rest } = prev;
          return rest;
        });
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
              <option value="no">No, everyone involved has been added</option>
            </select>
	          </div>
          {narrativePersonSuggestions.length > 0 && (
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Suggested from the description</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {narrativePersonSuggestions.map(person => (
                  <button
                    type="button"
                    key={`${person.name}-${person.involvement}`}
                    onClick={() => addSuggestedPerson(person)}
                    className="rounded-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  >
                    + {person.name} · {wizardPersonRoleLabel(person.involvement)}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                {WIZARD_PERSON_ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button type="button" onClick={addPersonForQuestion} disabled={!newPerson.name.trim()} className="min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 px-4">
                <UserPlus className="w-4 h-4" /> Add
              </button>
            </div>
          )}
          {personSelection === 'no' && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              Everyone currently known to be involved is confirmed for this step. The wizard may still ask for more detail later if the records introduce another person.
            </div>
          )}
          {draft.people.length > 0 && (
            <div className="space-y-2">
              {draft.people.map((person, index) => (
                <div key={`${person.name}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{person.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{wizardPersonRoleLabel(person.involvement)} - {person.role || 'Job title not set'} - {person.department || 'Department not set'}</p>
                  </div>
	                  <button
	                    type="button"
	                    onClick={() => {
                      const removedKey = wizardPersonKey(person, index);
	                      const nextPeople = draft.people.filter((_, i) => i !== index);
                      setDraft(prev => {
                        const nextStatuses = { ...prev.statementStatuses };
                        delete nextStatuses[removedKey];
                        return { ...prev, people: nextPeople, statementStatuses: nextStatuses };
                      });
	                      setPlan(null);
	                      setIntakeAnswers(prev => ({ ...prev, [question.id]: nextPeople.map(item => `${item.name} (${wizardPersonRoleLabel(item.involvement)})`).join('; ') }));
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
      return wrapInput(renderDocumentCapturePanel());
    }

    if (question.answerType === 'select' || question.answerType === 'yes_no') {
      const options = question.answerType === 'yes_no'
        ? ['Yes', 'No', 'Unknown / needs review']
        : isDepartmentQuestion
          ? departments.map(dept => dept.name)
          : isShiftQuestion
            ? shifts.map(shiftLabel)
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

  const resolveFeedbackQuestionId = (feedback: GuidedIntakeAnswerFeedback) => {
    const feedbackQuestion = normalizeWizardText(feedback.question).toLowerCase();
    if (!feedbackQuestion) return '';
    const exact = Object.entries(intakeQuestionTextById).find(([, question]) => normalizeWizardText(question).toLowerCase() === feedbackQuestion);
    if (exact) return exact[0];
    const partial = Object.entries(intakeQuestionTextById).find(([, question]) => {
      const normalized = normalizeWizardText(question).toLowerCase();
      return normalized.includes(feedbackQuestion) || feedbackQuestion.includes(normalized);
    });
    return partial?.[0] || '';
  };

  const renderAnswerFeedback = () => {
    if (!answerFeedbackItems.length) return null;
    return (
      <div className="space-y-3">
        {answerFeedbackItems.map((feedback, index) => {
          const key = wizardFeedbackKey(feedback) || `feedback-${index}`;
          const questionId = resolveFeedbackQuestionId(feedback);
          const currentAnswer = questionId ? intakeAnswers[questionId] || feedback.answer || '' : feedback.answer || '';
          return (
            <div key={key} className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {feedback.issue || 'Response needs clarification'}
                  </p>
                  {feedback.question && (
                    <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Question: {feedback.question}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-amber-900 dark:text-amber-100 leading-relaxed">{feedback.reason}</p>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    Suggested next step: {feedback.suggestedAction}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAcknowledgedAnswerFeedback(prev => ({
                    ...prev,
                    [key]: `Supervisor chose to continue with the current response for: ${feedback.question || feedback.issue}`,
                  }))}
                  className="shrink-0 rounded-xl border border-amber-300 dark:border-amber-800 bg-white/80 dark:bg-gray-900/80 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-100 hover:bg-white dark:hover:bg-gray-900"
                >
                  Continue with current response
                </button>
              </div>
              {questionId ? (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">Improve response</label>
                  <textarea
                    value={currentAnswer}
                    onChange={e => {
                      setIntakeAnswers(prev => ({ ...prev, [questionId]: e.target.value }));
                      setAcknowledgedAnswerFeedback(prev => {
                        const { [key]: _removed, ...rest } = prev;
                        return rest;
                      });
                      setPlan(null);
                    }}
                    rows={4}
                    className={textareaClass}
                    placeholder="Add the specific facts, employee response, or documentation status."
                  />
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-white/70 dark:bg-gray-900/60 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  Use the progress panel to return to the related step if you want to revise this answer.
                </p>
              )}
            </div>
          );
        })}
      </div>
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
            Based on what you have shared so far, these are the next details needed for a fair review.
          </p>
        </div>
	        {displayedWizardReadiness && (
	          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${readinessTone(displayedWizardReadiness.score)}`}>
	            {displayedWizardReadiness.score}% · {displayedWizardReadiness.label}
	          </span>
	        )}
      </div>

      {intakePlan && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Readiness</p>
	              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{displayedWizardReadiness?.score ?? 0}%</p>
	              <p className="text-[11px] text-gray-500 dark:text-gray-400">{displayedWizardReadiness?.label ?? 'Not ready'}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Questions</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{currentStepQuestions.length}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{missingRequiredCurrentQuestions.length} required left</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Answers</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{answeredDynamicCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">saved for this review</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white/80 dark:bg-gray-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Policy Guidance</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{activePolicySections.length}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">available</p>
            </div>
          </div>

          {currentStepStatusMessage && (
            <div className={`rounded-xl border p-3 text-sm leading-relaxed ${
              !currentStepIsComplete
                ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100'
                : 'border-green-200 dark:border-green-800 bg-green-50/80 dark:bg-green-950/20 text-green-900 dark:text-green-200'
            }`}>
              {currentStepStatusMessage}
            </div>
          )}

          {reviewableSourceBackedAnswers.length > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <FileCheck2 className="w-3.5 h-3.5" />
                Found in uploaded records
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                These answers were found in uploaded or typed records. Review them before relying on them for the case file.
              </p>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                {reviewableSourceBackedAnswers.map(item => (
                  <div key={`${item.slotId}-${item.sourceTitle}-${item.value}`} className="rounded-lg border border-emerald-100 dark:border-emerald-900/70 bg-white/80 dark:bg-gray-900/70 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{item.value}</p>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Source: {item.sourceTitle}{item.sourceType ? ` (${item.sourceType.replace(/_/g, ' ')})` : ''}
                    </p>
                    {item.excerpt && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{item.excerpt}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(intakePlan.selectedPlaybooks?.length || intakePlan.complianceRiskGates?.length) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {intakePlan.selectedPlaybooks?.length ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-gray-900/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Review focus</p>
                  <div className="flex flex-wrap gap-2">
                    {intakePlan.selectedPlaybooks.slice(0, 4).map(playbook => (
                      <span key={playbook.key} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {playbook.title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {intakePlan.complianceRiskGates?.length ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-gray-900/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Items to watch</p>
                  <div className="flex flex-wrap gap-2">
                    {intakePlan.complianceRiskGates.slice(0, 6).map(gate => (
                      <span key={gate.key} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${gate.triggered ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {gate.triggered ? 'Review: ' : 'Clear: '}{gate.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {renderAnswerFeedback()}

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
                  {question.required && <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[11px] font-semibold">Required</span>}
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
          Click <span className="font-semibold">Continue</span> to review your answers and show the next helpful question.
        </div>
      )}

      {intakePlan && (activeMissingInformation.length > 0 || activeRecommendedDocuments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {activeMissingInformation.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-3">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Still needed on this step
              </p>
              <div className="space-y-1.5">
                {activeMissingInformation.map((item, index) => (
                  <p key={index} className="text-xs text-amber-900 dark:text-amber-100">{item}</p>
                ))}
              </div>
            </div>
          )}
          {activeRecommendedDocuments.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/20 p-3">
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Evidence or documents still requested
              </p>
              <div className="space-y-1.5">
                {activeRecommendedDocuments.map((doc, index) => (
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

	  const renderWizardReadinessReview = () => {
	    const score = evidenceQualityReview.score;
	    const label = evidenceQualityReview.label;
	    const allDocuments = draft.documents.map(doc => `${doc.title} (${WIZARD_DOCUMENT_TYPE_LABELS[doc.type]}${doc.personName ? ` for ${doc.personName}` : ''})`);
	    const allPeople = draft.people.map(person => `${person.name} (${wizardPersonRoleLabel(person.involvement)})`);
	    const weakAreas = Array.from(new Set([
	      ...evidenceQualityReview.weaknesses,
	      ...activeMissingInformation,
	      ...answerFeedbackItems.map(item => item.issue || item.question).filter(Boolean),
	      ...missingStatementStatuses.map(item => `${item.person.name} still needs a statement status`),
	    ])).slice(0, 8);
	    const reviewTone = score >= 75
	      ? 'border-emerald-200 dark:border-emerald-900/60 from-emerald-50 via-white to-blue-50 dark:from-emerald-950/20 dark:via-gray-900 dark:to-blue-950/20'
	      : score >= 50
	        ? 'border-amber-200 dark:border-amber-900/60 from-amber-50 via-white to-blue-50 dark:from-amber-950/20 dark:via-gray-900 dark:to-blue-950/20'
	        : 'border-red-200 dark:border-red-900/60 from-red-50 via-white to-amber-50 dark:from-red-950/20 dark:via-gray-900 dark:to-amber-950/20';

	    return (
	      <div className={`rounded-2xl border bg-gradient-to-br p-5 space-y-5 shadow-sm ${reviewTone}`}>
	        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
	          <div>
	            <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
	              <FileCheck2 className="w-4 h-4 text-emerald-600" />
	              Review response strength before creating the case
	            </p>
	            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
	              Review what is known, how strong the responses are, and whether weak areas should be improved before this becomes the case record.
	            </p>
	          </div>
	          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readinessTone(score)}`}>
	            {score}% · {label}
	          </span>
	        </div>

	        <div className={`rounded-xl border p-3 ${
	          score >= 75
	            ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/20'
	            : score >= 50
	              ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20'
	              : 'border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/20'
	        }`}>
	          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
	            <div>
	              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">AI response alignment review</p>
	              <p className="mt-1 text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{evidenceQualityReview.assessment}</p>
	            </div>
	            <div className="rounded-xl bg-white/80 dark:bg-gray-900/80 border border-white/70 dark:border-gray-800 px-4 py-3 min-w-[160px]">
	              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Strength score</p>
	              <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{score}%</p>
	              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{score < 50 ? 'Improve or involve HR before relying on this.' : 'Supervisor and HR should still review before final action.'}</p>
	            </div>
	          </div>
	        </div>

	        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	          <div className="rounded-xl border border-white/70 dark:border-gray-800 bg-white/85 dark:bg-gray-900/80 p-3">
	            <p className="text-[11px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">People</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{draft.people.length}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{allPeople.join('; ') || 'No people added'}</p>
          </div>
          <div className="rounded-xl border border-white/70 dark:border-gray-800 bg-white/85 dark:bg-gray-900/80 p-3">
            <p className="text-[11px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">Records</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{draft.documents.length}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{allDocuments.join('; ') || 'No documents added'}</p>
          </div>
          <div className="rounded-xl border border-white/70 dark:border-gray-800 bg-white/85 dark:bg-gray-900/80 p-3">
            <p className="text-[11px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">Answers</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{answeredDynamicCount}</p>
	            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Includes answers found in documents and answers entered by the user.</p>
	          </div>
	        </div>

	        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-gray-900/80 p-3">
	          <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Information reviewed</p>
	          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
	            {evidenceQualityReview.accounting.map((item, index) => (
	              <div key={`${item.area}-${index}`} className={`rounded-xl border px-3 py-2 ${qualityStatusTone(item.status)}`}>
	                <div className="flex items-center justify-between gap-2">
	                  <p className="text-xs font-bold">{item.area}</p>
	                  <span className="rounded-full bg-white/70 dark:bg-gray-950/40 px-2 py-0.5 text-[10px] font-bold uppercase">{item.status}</span>
	                </div>
	                <p className="mt-1 text-xs leading-relaxed">{item.detail}</p>
	                {item.source && <p className="mt-1 text-[11px] opacity-80">Source: {item.source}</p>}
	                {item.recommendedImprovement && <p className="mt-1 text-[11px] font-semibold">Improve: {item.recommendedImprovement}</p>}
	              </div>
	            ))}
	          </div>
	        </div>

	        {statementStatusSummary && (
	          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-gray-900/80 p-3">
	            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Statement status</p>
	            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{statementStatusSummary}</p>
          </div>
        )}

        {reviewableSourceBackedAnswers.length > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Answers found in records</p>
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {reviewableSourceBackedAnswers.map(item => (
                <div key={`${item.slotId}-${item.sourceTitle}-${item.value}`} className="rounded-lg bg-white/80 dark:bg-gray-900/70 border border-emerald-100 dark:border-emerald-900/70 px-3 py-2">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{item.value}</p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Source: {item.sourceTitle}</p>
                </div>
              ))}
            </div>
	          </div>
	        )}

	        {evidenceQualityReview.findings.length > 0 && (
	          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white/85 dark:bg-gray-900/80 p-3">
	            <p className="text-xs font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
	              <AlertTriangle className="w-3.5 h-3.5" />
	              Response quality notes
	            </p>
	            <div className="mt-2 space-y-2">
	              {evidenceQualityReview.findings.map((item, index) => (
	                <div key={`${item.area}-${index}`} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/30 px-3 py-2">
	                  <div className="flex flex-wrap items-center gap-2">
	                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${qualityStatusTone(item.status)}`}>{item.status}</span>
	                    <p className="text-xs font-bold text-gray-900 dark:text-white">{item.area}</p>
	                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{item.score}%</span>
	                  </div>
	                  <p className="mt-1 text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{item.finding}</p>
	                  {item.improvement && <p className="mt-1 text-xs font-semibold text-amber-900 dark:text-amber-100">Suggested improvement: {item.improvement}</p>}
	                </div>
	              ))}
	            </div>
	          </div>
	        )}

	        {(evidenceQualityReview.strengths.length > 0 || weakAreas.length > 0) && (
	          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
	            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/75 dark:bg-green-950/20 p-3">
	              <p className="text-xs font-bold text-green-900 dark:text-green-100">What is strong enough to keep</p>
	              {evidenceQualityReview.strengths.length ? (
	                <ul className="mt-2 space-y-1.5">
	                  {evidenceQualityReview.strengths.map((item, index) => (
	                    <li key={`${item}-${index}`} className="text-xs text-green-900 dark:text-green-100 flex items-start gap-2">
	                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
	                      <span>{item}</span>
	                    </li>
	                  ))}
	                </ul>
	              ) : (
	                <p className="mt-2 text-xs text-green-900 dark:text-green-100">No strong areas identified yet.</p>
	              )}
	            </div>
	            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-3">
	              <p className="text-xs font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
	                <AlertTriangle className="w-3.5 h-3.5" />
	                What to improve before relying on it
	              </p>
	              {weakAreas.length ? (
	                <ul className="mt-2 space-y-1.5">
	                  {weakAreas.map((item, index) => (
	                    <li key={`${item}-${index}`} className="text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2">
	                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
	                      <span>{item}</span>
	                    </li>
	                  ))}
	                </ul>
	              ) : (
	                <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">No improvement item is currently flagged.</p>
	              )}
	            </div>
	          </div>
	        )}

	      </div>
	    );
	  };

	  const renderGuidedReviewAndActionPlan = () => {
    if (!plan) return null;
    const missingItems = Array.from(new Set([...(plan.missingInformation || []), ...activeMissingInformation])).filter(Boolean);
    const selectedRiskLabels = draft.riskFlags.length
      ? draft.riskFlags.map(guidedRiskLabel).join(', ')
      : 'No sensitive risk selected';

    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/25 dark:via-gray-900 dark:to-indigo-950/20 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-900/60 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Guided Conduct Review</h3>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">HR-reviewable</span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Review the facts collected by the wizard before saving the case record.
                </p>
              </div>
            </div>
            {savedAt && <span className="text-xs text-gray-500 dark:text-gray-400">Saved {formatDateTime(savedAt)}</span>}
          </div>

          <div className="p-5 space-y-5">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
              Decision support only. Supervisors and HR make the final decision after reviewing facts, policy, consistency, and business risk.
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Conduct or complaint summary</span>
              <textarea
                value={draft.behaviorSummary}
                onChange={e => updateDraft('behaviorSummary', e.target.value)}
                rows={5}
                className={textareaClass}
                placeholder="Summarize the reported concern, observed facts, involved people, and immediate response."
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Policy training</span>
                <select
                  value={draft.policyTrainingStatus}
                  onChange={e => updateDraft('policyTrainingStatus', e.target.value as GuidedReviewAnswers['policyTrainingStatus'])}
                  className={inputClass}
                  title="Policy training"
                >
                  {GUIDED_REVIEW_STATUS_OPTIONS.policyTrainingStatus.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Prior pattern</span>
                <select
                  value={draft.repeatedBehaviorStatus}
                  onChange={e => updateDraft('repeatedBehaviorStatus', e.target.value as GuidedReviewAnswers['repeatedBehaviorStatus'])}
                  className={inputClass}
                  title="Prior pattern"
                >
                  {GUIDED_REVIEW_STATUS_OPTIONS.repeatedBehaviorStatus.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Safety impact</span>
                <select
                  value={draft.safetyImpactStatus}
                  onChange={e => updateDraft('safetyImpactStatus', e.target.value as GuidedReviewAnswers['safetyImpactStatus'])}
                  className={inputClass}
                  title="Safety impact"
                >
                  {GUIDED_REVIEW_STATUS_OPTIONS.safetyImpactStatus.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Employee response</span>
                <select
                  value={draft.employeeResponseStatus}
                  onChange={e => updateDraft('employeeResponseStatus', e.target.value as GuidedReviewAnswers['employeeResponseStatus'])}
                  className={inputClass}
                  title="Employee response"
                >
                  {GUIDED_REVIEW_STATUS_OPTIONS.employeeResponseStatus.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {missingItems.length > 0 && (
              <div className="rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/20 p-4">
                <p className="text-sm font-bold text-orange-950 dark:text-orange-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Missing information from the complaint analysis
                </p>
                <ul className="mt-3 space-y-2">
                  {missingItems.map((item, index) => (
                    <li key={index} className="text-sm text-orange-900 dark:text-orange-100 flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">HR risk screen</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${draft.riskFlags.length && !draft.riskFlags.includes('none') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                  {selectedRiskLabels}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {GUIDED_RISK_OPTIONS.map(option => {
                  const selected = draft.riskFlags.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleRiskFlag(option.key)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center ${selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-gray-900 dark:text-white">{option.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{option.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Supervisor decision notes</span>
              <textarea
                value={draft.supervisorNotes}
                onChange={e => updateDraft('supervisorNotes', e.target.value)}
                rows={5}
                className={textareaClass}
                placeholder="Document supervisor observations, follow-up steps, decisions considered, HR direction received, and remaining concerns."
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">HR Action Plan</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Use this review package to decide what should happen next and what should be preserved for the record.
                </p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${plan.hrReviewRequired ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
              {plan.hrReviewRequired ? 'HR Review Required' : 'Supervisor Review Ready'}
            </span>
          </div>

          <div className="p-5 space-y-5">
            <div className="rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{plan.executiveSummary}</p>
              {plan.hrReviewReason && (
                <div className="mt-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">HR review reason</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{plan.hrReviewReason}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <WizardList title="Missing information" items={plan.missingInformation} icon={AlertTriangle} />
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Risk review</p>
                {plan.riskFlags.length > 0 ? (
                  <div className="space-y-3">
                    {plan.riskFlags.map((risk, index) => (
                      <div key={`${risk.label}-${index}`} className="rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{risk.label}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${risk.requiresHRReview ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                            {risk.requiresHRReview ? 'HR review' : 'Monitor'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{risk.whyItMatters}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No HR-sensitive risk flag has been identified from the available facts.</p>
                )}
              </div>
            </div>

            <WizardList title="Policy alignment" items={plan.policyAlignment} icon={BookOpen} />

            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Decision options for review</p>
              {plan.recommendedDecisionOptions.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {plan.recommendedDecisionOptions.map((option, index) => (
                    <div key={`${option.option}-${index}`} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{option.option}</p>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{option.useWhen}</p>
                      {option.example && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Example: {option.example}</p>}
                      {option.cautions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-300">Cautions</p>
                          <ul className="mt-1 space-y-1">
                            {option.cautions.map((caution, cautionIndex) => (
                              <li key={cautionIndex} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                                {caution}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {option.nextSteps.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Next steps</p>
                          <ul className="mt-1 space-y-1">
                            {option.nextSteps.map((nextStep, nextIndex) => (
                              <li key={nextIndex} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                {nextStep}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
                  No decision option has been generated yet.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <WizardList title="Conversation questions" items={plan.employeeConversationQuestions} icon={MessageSquare} />
              <WizardList title="Supervisor checklist" items={plan.supervisorChecklist} icon={CheckCircle2} />
              <WizardList title="Audit notes" items={plan.auditNotes} icon={FileText} />
            </div>
          </div>
        </section>
      </div>
    );
  };

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
            <div className="relative w-full max-w-md mx-6 overflow-hidden rounded-3xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 shadow-2xl">
              <div className="relative p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/25">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">Analyzing your responses</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      Hang tight while the wizard analyzes your responses and any documentation provided.
                    </p>
                  </div>
                </div>
                <div className="mt-6 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950 h-2">
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" style={{ animation: 'guidedWizardProgress 1.25s ease-in-out infinite' }} />
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Checking facts, uploaded records, people involved, and policy context before opening the next step.
                </p>
              </div>
            </div>
            <style jsx>{`
              @keyframes guidedWizardProgress {
                0% { transform: translateX(-120%); }
                55% { transform: translateX(135%); }
                100% { transform: translateX(300%); }
              }
            `}</style>
          </div>
        )}

        <div className="grid grid-cols-[280px_1fr] min-h-0 flex-1">
          <div className="border-r border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-5 overflow-y-auto">
	            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-white dark:bg-gray-900 p-4 shadow-sm">
	              <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-300 font-bold">Current focus</p>
	              <h3 className="mt-2 text-base font-bold text-gray-900 dark:text-white">
	                {guardedWizardStage?.title || WIZARD_FLOW_STEPS[step]?.title || 'Guided review'}
	              </h3>
	              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
		                {guardedWizardStage?.purpose || WIZARD_FLOW_STEPS[step]?.description || 'Complete the current step before moving forward.'}
              </p>
	              {displayedWizardReadiness && (
	                <div className="mt-4 space-y-2">
	                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${readinessTone(displayedWizardReadiness.score)}`}>
	                    {displayedWizardReadiness.score}% · {displayedWizardReadiness.label}
	                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{answeredDynamicCount} answer{answeredDynamicCount === 1 ? '' : 's'} saved</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activePolicySections.length} active policy section{activePolicySections.length === 1 ? '' : 's'} available</p>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
	              <p className="px-2 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-bold">Wizard progress</p>
	              <div className="mt-3 space-y-2">
	                {WIZARD_FLOW_STEPS.map((flowStep, index) => {
	                  const isCurrent = index === step;
                    const isCompleted = index < step;
                    const isAvailable = index <= step || Boolean(stepHistory.find(snapshot => snapshot.step === index));
	                  return (
	                    <button
	                      type="button"
	                      key={flowStep.stage}
	                      onClick={() => isAvailable && goToWizardStep(index)}
                        disabled={!isAvailable}
	                      className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
	                        isCurrent
	                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
	                          : isAvailable
                            ? 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
	                      }`}
	                    >
	                      <div className="flex items-start justify-between gap-2">
	                        <span className="text-sm font-semibold leading-snug">{flowStep.title}</span>
	                        {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> : isCurrent ? <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" /> : null}
	                      </div>
	                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
	                        {flowStep.description}
	                      </p>
	                    </button>
	                  );
	                })}
              </div>
              {step > 0 && (
                <p className="mt-3 px-2 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  If you change an earlier answer, Continue reviews the updated details before moving forward.
                </p>
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
                <div className="rounded-3xl border border-blue-100 dark:border-blue-900/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/25 dark:via-gray-900 dark:to-indigo-950/20 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Describe what happened</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                        Start with a clear summary of the situation. Include what happened, who was involved, where it happened, and any immediate action already taken.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-5">
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Incident description *</label>
                    <textarea
                      value={draft.behaviorSummary}
                      onChange={e => updateDraft('behaviorSummary', e.target.value)}
                      rows={10}
                      className={textareaClass}
                      placeholder="Explain what happened, who was involved if known, where it happened, what was observed or reported, what immediate action was taken, and any safety, food safety, quality, attendance, conduct, performance, warehouse, or HR concern you already know about."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use facts and observations. Avoid conclusions unless they are supported by what was seen, reported, or documented.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Incident date</span>
                        <DashDatePicker
                          value={draft.incidentDate}
                          onChange={value => updateDraft('incidentDate', value)}
                          ariaLabel="Incident date"
                          className="min-h-[48px] rounded-xl px-4 py-3"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Location or area</span>
                        <input value={draft.location} onChange={e => updateDraft('location', e.target.value)} className={inputClass} placeholder="e.g., Line 2, warehouse dock, QA lab" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Department</span>
                        <select value={draft.department} onChange={e => updateDraft('department', e.target.value)} className={inputClass} title="Department" disabled={dropdownsLoading}>
                          <option value="">{dropdownsLoading ? 'Loading departments...' : 'Select department'}</option>
                          {departments.map(dept => (
                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Shift</span>
                        <select value={draft.shift} onChange={e => updateDraft('shift', e.target.value)} className={inputClass} title="Shift" disabled={shiftsLoading || !draft.department}>
                          <option value="">{!draft.department ? 'Select department first' : shiftsLoading ? 'Loading shifts...' : 'Select shift'}</option>
                          {shifts.map(shiftOption => (
                            <option key={shiftOption.id} value={shiftLabel(shiftOption)}>{shiftLabel(shiftOption)}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">Optional starting category</p>
                      <div className="flex flex-wrap gap-2">
                        {WIZARD_ISSUES.map(option => {
                    const Icon = option.icon;
                    const selected = draft.issueType === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => selectIssueType(option.key)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                          selected
                                  ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                              <Icon className="w-3.5 h-3.5" />
                              {option.title}
                      </button>
                    );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
	            ) : (
	              <div className="space-y-5">
	                {currentWizardStage === 'readiness'
                    ? renderWizardReadinessReview()
                    : renderInlineDynamicQuestions(guardedWizardStage?.title || intakePlan?.currentStepTitle || 'Follow-up questions')}
		                {currentWizardStage !== 'readiness' && currentStepQuestions.length === 0 && intakePlan && (
	                  <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">No additional questions right now</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Continue to let the wizard review the latest responses and decide whether another step is needed.
                    </p>
                  </div>
                )}
	              </div>
	            )}
          </div>
        </div>

        <div className="px-7 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between gap-3">
          <button onClick={resetWizard} className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">Reset wizard</button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => goToWizardStep(step - 1)}
                disabled={intakeLoading || generating || creatingCase}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
	            {currentWizardStage !== 'readiness' ? (
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
		              <button onClick={createCaseFromWizard} disabled={creatingCase || !canGenerate} className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2 ${evidenceQualityReview.score < 50 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}>
		                {creatingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
		                {evidenceQualityReview.score < 50 ? 'Create Case Anyway' : 'Create Case'}
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
function CasesTab({ cases, loading, onRefresh, onOpenGuidedWizard, onDeleteCase }: {
  cases: ConflictCase[];
  loading: boolean;
  onRefresh: () => void;
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
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Guided Case Wizard</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-3xl">
                Start every new case through the wizard. Saved cases remain here for review, HR reports, counseling guides, and audit history.
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
          onClick={onOpenGuidedWizard}
          className="ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/25"
        >
          <Sparkles className="w-4 h-4" /> Start New Case
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
            <button onClick={onOpenGuidedWizard} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Start New Case
            </button>
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

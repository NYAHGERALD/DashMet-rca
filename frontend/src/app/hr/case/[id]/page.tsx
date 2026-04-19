'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import {
  Scale,
  Users,
  FileText,
  Brain,
  Gavel,
  ClipboardCheck,
  Clock,
  Plus,
  X,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Edit3,
  Save,
  Eye,
  Lock,
  Send,
  Shield,
  Target,
  Zap,
  MessageSquare,
  RefreshCw,
  XCircle,
  Building2,
  Calendar,
  MapPin,
  Hash,
  User,
  FileUp,
  BookOpen,
  ArrowUpRight,
  Sparkles,
  Award,
  Flag,
  BarChart3,
  Image,
  Languages,
  Globe,
  Type,
  Maximize2,
  Minimize2,
  GripHorizontal,
  AlertCircle,
  Volume2,
  Square,
  Pencil,
  ChevronLeft,
  PenTool,
  ShieldCheck,
  Search,
  Lightbulb,
  Download,
  ArrowRight,
  FileDown,
  Unlock,
  ClipboardList,
  FileCheck,
} from 'lucide-react';
import {
  ConflictCase,
  InvolvedEmployee,
  CaseDocument,
  AuditEntry,
  WorkplacePolicy,
  ComparisonResult,
  PolicyMatchResult,
  PolicyMatch,
  PolicySection,
  RecommendationResult,
  Recommendation,
  EmployeeRecommendationGroup,
  GeneratedActionDocument,
  DocumentEdit,
  ReviewComment,
  CaseStatus,
  ActionType,
  DocumentType,
  fetchCase,
  fetchCaseDocuments,
  updateCase,
  deleteCase,
  closeCase,
  reopenCase,
  sendReopenCode,
  verifyReopenCode,
  addEmployee,
  updateEmployee,
  removeEmployee,
  addDocument,
  removeDocument,
  processDocumentOCR,
  documentTextToSpeech,
  submitDocumentAuditLog,
  OCRResult,
  fetchAudit,
  fetchPolicies,
  saveDocumentEdit,
  fetchDocumentEdits,
  deleteDocumentEdit,
  addReviewComment,
  fetchReviewComments,
  resolveReviewComment,
  deleteReviewComment,
  runComparison,
  runPolicyMatching,
  runDecisionSupport,
  generateActionDocument,
  getStatusColor,
  getStatusLabel,
  getCaseTypeLabel,
  getCaseTypeColor,
  getRiskColor,
  getRiskBgColor,
  formatDate,
  formatDateTime,
} from '@/lib/hrApi';
import { downloadDocx } from '@/lib/generateDocx';
import { downloadCaseReport, generateCaseReport, getDefaultConfig, type ReportConfig, type ReportTemplate, type ConfidentialityLevel, type ReportGenerationInput } from '@/lib/generateCaseReport';
import { saveAs } from 'file-saver';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${className}`}>{children}</span>;
}

function SectionCard({ title, icon: Icon, children, actions, collapsible, defaultOpen = true, className }: {
  title: string; icon?: any; children: React.ReactNode; actions?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden ${className || ''}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {collapsible && (
            <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          )}
        </div>
      </div>
      {(!collapsible || open) && <div className="p-6 flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>}
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab({ caseData, onUpdate, userId }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string;
}) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empId, setEmpId] = useState('');
  const [empIsComplainant, setEmpIsComplainant] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable case fields
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState(caseData.type || 'conflict');
  const [editIncidentDate, setEditIncidentDate] = useState(caseData.incidentDate ? caseData.incidentDate.split('T')[0] : '');
  const [editLocation, setEditLocation] = useState(caseData.location || '');
  const [editDepartment, setEditDepartment] = useState(caseData.department || '');
  const [editShift, setEditShift] = useState(caseData.shift || '');
  const [editDescription, setEditDescription] = useState(caseData.description || '');
  const [savingCase, setSavingCase] = useState(false);

  const handleSaveCaseDetails = async () => {
    setSavingCase(true);
    try {
      await updateCase(caseData.id, {
        caseType: editType,
        incidentDate: editIncidentDate ? new Date(editIncidentDate).toISOString() : undefined,
        location: editLocation || undefined,
        department: editDepartment || undefined,
        shift: editShift || undefined,
        description: editDescription || undefined,
        userId,
      });
      onUpdate();
      setIsEditing(false);
    } catch (err) { console.error(err); }
    finally { setSavingCase(false); }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditType(caseData.type || 'conflict');
    setEditIncidentDate(caseData.incidentDate ? caseData.incidentDate.split('T')[0] : '');
    setEditLocation(caseData.location || '');
    setEditDepartment(caseData.department || '');
    setEditShift(caseData.shift || '');
    setEditDescription(caseData.description || '');
  };

  const handleAddEmployee = async () => {
    if (!empName.trim()) return;
    setSaving(true);
    try {
      await addEmployee(caseData.id, {
        name: empName.trim(),
        role: empRole || undefined,
        department: empDept || undefined,
        employeeId: empId || undefined,
        isComplainant: empIsComplainant,
        userId,
      });
      onUpdate();
      setShowAddEmployee(false);
      setEmpName(''); setEmpRole(''); setEmpDept(''); setEmpId(''); setEmpIsComplainant(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleRemoveEmployee = async (empDbId: string) => {
    if (!confirm('Remove this employee from the case?')) return;
    try {
      await removeEmployee(caseData.id, empDbId, userId);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  // Deduplicate employees by employeeFileNo (or name+role+department fallback)
  const deduplicateEmployees = (employees: any[]) => {
    const seen = new Set<string>();
    return employees.filter(e => {
      const key = e.employeeFileNo || `${e.name}-${e.role}-${e.department}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const uniqueEmployees = deduplicateEmployees(caseData.involvedEmployees || []);
  const complainants = uniqueEmployees.filter(e => e.isComplainant);
  const witnesses = uniqueEmployees.filter(e => !e.isComplainant);

  return (
    <div className="space-y-6">
      {/* Case Info */}
      <SectionCard
        title="Case Information"
        icon={FileText}
        actions={
          !caseData.isLocked && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          )
        }
      >
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Case Type</label>
                <select value={editType} onChange={e => setEditType(e.target.value)} title="Case type" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                  <option value="conflict">Workplace Conflict</option>
                  <option value="conduct">Conduct Issue</option>
                  <option value="safety">Safety Concern</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Incident Date</label>
                <input type="date" value={editIncidentDate} onChange={e => setEditIncidentDate(e.target.value)} title="Incident date" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Location</label>
                <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Building A" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Department</label>
                <input type="text" value={editDepartment} onChange={e => setEditDepartment(e.target.value)} placeholder="e.g. Production" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Shift</label>
                <input type="text" value={editShift} onChange={e => setEditShift(e.target.value)} placeholder="e.g. Day, Night" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} placeholder="Brief description of the incident..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={handleSaveCaseDetails} disabled={savingCase} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {savingCase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
              </button>
              <button onClick={handleCancelEdit} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Case Number</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{caseData.caseNumber}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Type</p>
              <Badge className={getCaseTypeColor(caseData.type)}>{getCaseTypeLabel(caseData.type)}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</p>
              <Badge className={getStatusColor(caseData.status)}>{getStatusLabel(caseData.status)}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Incident Date</p>
              <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {formatDate(caseData.incidentDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Location</p>
              <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {caseData.location || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Department</p>
              <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-gray-400" /> {caseData.department || '—'}</p>
            </div>
            {caseData.shift && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Shift</p>
                <p className="text-sm text-gray-900 dark:text-white">{caseData.shift}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Created</p>
              <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(caseData.createdAt)}</p>
            </div>
            {caseData.createdByUser && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Created By</p>
                <p className="text-sm text-gray-900 dark:text-white">{caseData.createdByUser.firstName} {caseData.createdByUser.lastName}</p>
              </div>
            )}
            {caseData.description && (
              <div className="md:col-span-2 lg:col-span-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{caseData.description}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Involved Employees */}
      <SectionCard
        title={`Involved Parties (${uniqueEmployees.length})`}
        icon={Users}
        actions={
          !caseData.isLocked && (
            <button onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )
        }
      >
        {uniqueEmployees.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No employees added yet</p>
        ) : (
          <div className="space-y-3">
            {complainants.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Complainants</p>
                <div className="space-y-2">
                  {complainants.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{emp.name}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {emp.role && <span>{emp.role}</span>}
                            {emp.department && <span>{emp.department}</span>}
                            {emp.employeeFileNo && <span>ID: {emp.employeeFileNo}</span>}
                          </div>
                        </div>
                      </div>
                      {!caseData.isLocked && (
                        <button onClick={() => handleRemoveEmployee(emp.id)} title="Remove employee" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {witnesses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Witnesses</p>
                <div className="space-y-2">
                  {witnesses.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{emp.name}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {emp.role && <span>{emp.role}</span>}
                            {emp.department && <span>{emp.department}</span>}
                            {emp.employeeFileNo && <span>ID: {emp.employeeFileNo}</span>}
                          </div>
                        </div>
                      </div>
                      {!caseData.isLocked && (
                        <button onClick={() => handleRemoveEmployee(emp.id)} title="Remove employee" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Employee Form */}
        {showAddEmployee && (
          <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="grid md:grid-cols-2 gap-3">
              <input type="text" value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Full Name *" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={empRole} onChange={e => setEmpRole(e.target.value)} placeholder="Role (optional)" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={empDept} onChange={e => setEmpDept(e.target.value)} placeholder="Department (optional)" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={empId} onChange={e => setEmpId(e.target.value)} placeholder="Employee ID (optional)" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={empIsComplainant} onChange={e => setEmpIsComplainant(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
                Complainant
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddEmployee(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                <button onClick={handleAddEmployee} disabled={!empName.trim() || saving} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── DOCUMENTS TAB ────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Polish',
  'Russian', 'Arabic', 'Persian', 'Pashto', 'Dari', 'Chinese', 'Japanese', 'Korean',
  'Vietnamese', 'Tagalog', 'Hindi',
];

const LANGUAGE_CODES: Record<string, string> = {
  English: 'en-US', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE',
  Portuguese: 'pt-BR', Italian: 'it-IT', Dutch: 'nl-NL', Polish: 'pl-PL',
  Russian: 'ru-RU', Arabic: 'ar-SA', Persian: 'fa-IR', Pashto: 'ps-AF',
  Dari: 'fa-AF', Chinese: 'zh-CN', Japanese: 'ja-JP', Korean: 'ko-KR',
  Vietnamese: 'vi-VN', Tagalog: 'tl-PH', Hindi: 'hi-IN',
};

function DocumentsTab({ caseData, onUpdate, userId, userName }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string; userName: string;
}) {
  // Upload flow state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'scan' | 'manual' | null>(null);
  const [docType, setDocType] = useState<DocumentType>('complaint_a');
  const [docContent, setDocContent] = useState('');
  const [saving, setSaving] = useState(false);

  // OCR flow state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // base64 images
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const processingStepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrError, setOcrError] = useState('');
  const [reviewTab, setReviewTab] = useState<'original' | 'translated' | 'cleaned' | 'images'>('cleaned');
  const [fileLoading, setFileLoading] = useState(false);

  // Inline editing state
  const [isEditingOriginal, setIsEditingOriginal] = useState(false);
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedOriginalText, setEditedOriginalText] = useState('');
  const [editedCleanedText, setEditedCleanedText] = useState('');

  // TTS state
  // Auto-selected employee based on doc type
  const [selectedEmployee, setSelectedEmployee] = useState<InvolvedEmployee | null>(null);

  // TTS state
  const [isReading, setIsReading] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const highlightIndexRef = useRef(-1);
  const [showTranslationConsent, setShowTranslationConsent] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightContainerRef = useRef<HTMLPreElement | null>(null);

  // Preview state
  const [selectedDoc, setSelectedDoc] = useState<CaseDocument | null>(null);
  const [previewTab, setPreviewTab] = useState<'original' | 'translated' | 'cleaned' | 'images'>('cleaned');

  // Open image in new tab via Blob URL (Chrome blocks data: URLs in new tabs)
  const openImageInNewTab = (src: string) => {
    if (src.startsWith('http')) {
      window.open(src, '_blank');
      return;
    }
    // Convert data URL to blob URL
    const byteString = atob(src.replace(/^data:image\/\w+;base64,/, ''));
    const mimeMatch = src.match(/^data:(image\/\w+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  // Document Acceptance workflow state (3-step)
  const [showAcceptance, setShowAcceptance] = useState(false);
  const [acceptanceStep, setAcceptanceStep] = useState(0); // 0=Employee Review, 1=Digital Signature, 2=Supervisor Certification
  const [employeeReviewConfirmed, setEmployeeReviewConfirmed] = useState(false);
  const [employeeReviewTimestamp, setEmployeeReviewTimestamp] = useState<Date | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null); // base64 PNG
  const [employeeSignatureTimestamp, setEmployeeSignatureTimestamp] = useState<Date | null>(null);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorCertificationConfirmed, setSupervisorCertificationConfirmed] = useState(false);
  const [supervisorCertificationTimestamp, setSupervisorCertificationTimestamp] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState('');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePathsRef = useRef<{ points: { x: number; y: number }[] }[]>([]);
  const currentPathRef = useRef<{ points: { x: number; y: number }[] }>({ points: [] });
  const isDrawingRef = useRef(false);

  // Modal drag/resize/maximize state
  const [isMaximized, setIsMaximized] = useState(true);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ w: 720, h: 520 });
  const [modalReady, setModalReady] = useState(false);
  const [modalAnimating, setModalAnimating] = useState(false);
  const [contentBounds, setContentBounds] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-select employee based on document type (matching iOS)
  useEffect(() => {
    const employees = caseData.involvedEmployees || [];
    const complainants = employees.filter(e => e.isComplainant);
    const witnesses = employees.filter(e => !e.isComplainant);
    if (docType === 'complaint_a') {
      setSelectedEmployee(complainants[0] || null);
    } else if (docType === 'complaint_b') {
      setSelectedEmployee(complainants[1] || null);
    } else if (docType === 'witness_statement') {
      setSelectedEmployee(witnesses.length === 1 ? witnesses[0] : null);
    } else {
      setSelectedEmployee(employees.length === 1 ? employees[0] : null);
    }
  }, [docType, caseData.involvedEmployees]);

  // Measure the content area (main minus sticky header) — used for modal positioning
  const measureContentBounds = useCallback(() => {
    const mainEl = document.querySelector('main') as HTMLElement;
    const rect = mainEl ? mainEl.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    const stickyHeader = mainEl?.querySelector('.sticky.top-0') as HTMLElement;
    const stickyH = stickyHeader ? stickyHeader.offsetHeight : 0;
    const margin = 8; // thin bottom margin
    return { top: rect.top + stickyH, left: rect.left, width: rect.width, height: rect.height - stickyH - margin };
  }, []);

  // Keep contentBounds synced when sidebars expand/collapse or window resizes
  useEffect(() => {
    if (!showUpload) return;
    const mainEl = document.querySelector('main') as HTMLElement;
    if (!mainEl) return;
    const update = () => {
      const bounds = measureContentBounds();
      setContentBounds(bounds);
    };
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(mainEl);
    window.addEventListener('resize', update);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [showUpload, measureContentBounds]);

  // Center modal on first open and measure content area
  useEffect(() => {
    if (showUpload && !modalReady) {
      const bounds = measureContentBounds();
      setContentBounds(bounds);
      // Default size: 60% of content area width, 70% of content area height
      const w = Math.min(780, Math.max(560, bounds.width * 0.6));
      const h = Math.min(640, Math.max(420, bounds.height * 0.7));
      setModalSize({ w, h });
      setModalPos({ x: bounds.left + (bounds.width - w) / 2, y: Math.max(bounds.top + 10, bounds.top + (bounds.height - h) / 2) });
      setModalReady(true);
      // Trigger bounce animation
      setModalAnimating(true);
      setTimeout(() => setModalAnimating(false), 500);
    }
    if (!showUpload) { setModalReady(false); setModalAnimating(false); }
  }, [showUpload, modalReady]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: modalPos.x, origY: modalPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setModalPos({ x: dragRef.current.origX + dx, y: Math.max(0, dragRef.current.origY + dy) });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isMaximized, modalPos]);

  // Resize handlers
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: modalSize.w, origH: modalSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      setModalSize({ w: Math.max(480, resizeRef.current.origW + dw), h: Math.max(320, resizeRef.current.origH + dh) });
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isMaximized, modalSize]);

  const docTypeLabels: Record<string, string> = {
    complaint_a: 'Complaint A',
    complaint_b: 'Complaint B',
    witness_statement: 'Witness Statement',
    prior_record: 'Prior Record',
    counseling_record: 'Counseling Record',
    warning_document: 'Warning Document',
    evidence: 'Evidence',
    other: 'Other',
  };

  const getDocTypeLabel = (type: string) => docTypeLabels[type?.toLowerCase()] || type;

  const resetUpload = () => {
    setShowUpload(false);
    setUploadMode(null);
    setDocContent('');
    setUploadedImages([]);
    setImageNames([]);
    setSourceLanguage('English');
    setLanguageConfirmed(false);
    setProcessing(false);
    setFileLoading(false);
    setOcrResult(null);
    setOcrError('');
    setReviewTab('cleaned');
    setIsEditingOriginal(false);
    setIsEditingCleaned(false);
    stopReading();
    // Reset acceptance workflow
    setShowAcceptance(false);
    setAcceptanceStep(0);
    setEmployeeReviewConfirmed(false);
    setEmployeeReviewTimestamp(null);
    setSignatureImage(null);
    setEmployeeSignatureTimestamp(null);
    setSupervisorId('');
    setSupervisorCertificationConfirmed(false);
    setSupervisorCertificationTimestamp(null);
    setIsSubmitting(false);
    setAcceptanceError('');
    signaturePathsRef.current = [];
    currentPathRef.current = { points: [] };
  };

  // Initialize signature canvas background when entering step 2
  useEffect(() => {
    if (showAcceptance && acceptanceStep === 1) {
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f9fafb';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Redraw existing paths if any
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const path of signaturePathsRef.current) {
            if (path.points.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
              ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
          }
        }
      }
    }
  }, [showAcceptance, acceptanceStep]);

  // TTS helpers
  const stopReading = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (highlightTimerRef.current) { clearInterval(highlightTimerRef.current); highlightTimerRef.current = null; }
    highlightIndexRef.current = -1;
    // Clear all highlights from DOM
    if (highlightContainerRef.current) {
      highlightContainerRef.current.querySelectorAll('span[data-word]').forEach(el => {
        el.className = 'tts-word';
      });
    }
    setIsReading(false);
    setIsLoadingAudio(false);
  }, []);

  const startReading = useCallback(async (overrideTab?: 'original' | 'translated' | 'cleaned') => {
    if (!ocrResult) return;
    const tab = overrideTab || reviewTab;
    let text = '';
    let langCode = LANGUAGE_CODES[sourceLanguage] || 'en-US';
    if (tab === 'original') { text = isEditingOriginal ? editedOriginalText : (ocrResult.originalText || ''); }
    else if (tab === 'translated') { text = ocrResult.translatedText || ''; langCode = 'en-US'; }
    else if (tab === 'cleaned') { text = isEditingCleaned ? editedCleanedText : (ocrResult.cleanedText || ''); }
    if (!text) return;

    // Get employee name from case
    const empName = selectedEmployee?.name || caseData.involvedEmployees?.[0]?.name || 'Employee';
    const isNonEnglish = sourceLanguage !== 'English';
    const wasTranslationRead = overrideTab === 'translated';

    setIsLoadingAudio(true);
    try {
      const { audioBlob, introWordCount } = await documentTextToSpeech({
        text,
        employeeName: empName,
        documentType: getDocTypeLabel(docType),
        languageCode: langCode,
        skipIntro: false,
      });

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Word highlighting
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const wordsPerSec = 2.5;
      const introDelaySec = introWordCount / wordsPerSec;

      audio.onplay = () => {
        setIsReading(true);
        setIsLoadingAudio(false);
        const startTime = Date.now();
        highlightTimerRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const wordTime = elapsed - introDelaySec;
          if (wordTime < 0) return;
          const idx = Math.min(Math.floor(wordTime * wordsPerSec), words.length - 1);
          if (idx === highlightIndexRef.current) return; // no change
          highlightIndexRef.current = idx;
          // Update DOM directly — no React re-render
          if (highlightContainerRef.current) {
            const spans = highlightContainerRef.current.querySelectorAll('span[data-word]');
            spans.forEach((el, i) => {
              el.className = i <= idx ? 'tts-word tts-word-active' : 'tts-word';
            });
          }
        }, 80);
      };

      audio.onended = () => {
        stopReading();
        URL.revokeObjectURL(audioUrl);
        // Offer to read translation if non-English and has translation
        if (isNonEnglish && ocrResult.translatedText && !wasTranslationRead && (tab === 'original' || tab === 'cleaned')) {
          setTimeout(() => setShowTranslationConsent(true), 500);
        }
      };

      audio.onerror = () => {
        stopReading();
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setIsLoadingAudio(false);
    }
  }, [ocrResult, reviewTab, sourceLanguage, caseData, docType, stopReading, docTypeLabels, isEditingOriginal, editedOriginalText, isEditingCleaned, editedCleanedText, selectedEmployee]);

  const handleTranslationConsent = useCallback((accepted: boolean) => {
    setShowTranslationConsent(false);
    if (accepted && ocrResult?.translatedText) {
      setReviewTab('translated');
      setTimeout(() => startReading('translated'), 300);
    }
  }, [ocrResult, startReading]);

  // Handle file selection — convert images/PDFs to base64
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setFileLoading(true);
    setOcrError('');
    const newImages: string[] = [];
    const newNames: string[] = [];

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          // For PDFs: render each page to an image via canvas using pdfjs-dist v3
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
            newImages.push(base64);
            newNames.push(`${file.name} - Page ${i}`);
          }
        } else {
          // Image files: read as base64
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.replace(/^data:image\/[^;]+;base64,/, ''));
            };
            reader.readAsDataURL(file);
          });
          newImages.push(base64);
          newNames.push(file.name);
        }
      }

      setUploadedImages(prev => [...prev, ...newImages]);
      setImageNames(prev => [...prev, ...newNames]);
    } catch (err: any) {
      console.error('File processing error:', err);
      setOcrError(`Failed to process file: ${err?.message || 'Unknown error'}. Try uploading images (JPG/PNG) instead.`);
    } finally {
      setFileLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImageNames(prev => prev.filter((_, i) => i !== index));
  };

  // OCR processing
  const PROCESSING_STEPS = [
    { label: 'Preparing images', icon: '📄' },
    { label: 'Uploading to server', icon: '☁️' },
    { label: 'Running OCR analysis', icon: '🔍' },
    { label: 'Extracting text', icon: '✍️' },
    { label: 'Translating content', icon: '🌐' },
    { label: 'Cleaning & formatting', icon: '✨' },
    { label: 'Finalizing results', icon: '🎯' },
  ];

  const handleProcess = async () => {
    if (uploadedImages.length === 0) return;
    setProcessing(true);
    setProcessingStep(0);
    setOcrError('');

    // Animate through steps at intervals
    let step = 0;
    processingStepTimerRef.current = setInterval(() => {
      step++;
      if (step < PROCESSING_STEPS.length - 1) {
        setProcessingStep(step);
      } else {
        // Stay on the last step until done
        setProcessingStep(PROCESSING_STEPS.length - 1);
        if (processingStepTimerRef.current) clearInterval(processingStepTimerRef.current);
      }
    }, 3500);

    try {
      const result = await processDocumentOCR({
        images: uploadedImages,
        documentType: getDocTypeLabel(docType),
        sourceLanguage,
      });
      setOcrResult(result);
      setEditedOriginalText(result.originalText || '');
      setEditedCleanedText(result.cleanedText || '');
      setReviewTab(result.translatedText ? 'translated' : 'cleaned');
    } catch (err: any) {
      setOcrError(err?.response?.data?.message || err?.message || 'Failed to process document');
    } finally {
      if (processingStepTimerRef.current) clearInterval(processingStepTimerRef.current);
      setProcessing(false);
      setProcessingStep(0);
    }
  };

  // Save document (both manual and OCR)
  const handleSave = async () => {
    setSaving(true);
    try {
      if (uploadMode === 'manual') {
        await addDocument(caseData.id, {
          type: docType,
          originalText: docContent.trim(),
          cleanedText: docContent.trim(),
          name: getDocTypeLabel(docType),
          userId,
          employeeId: selectedEmployee?.id || undefined,
        });
      } else if (ocrResult) {
        await addDocument(caseData.id, {
          type: docType,
          originalText: editedOriginalText || ocrResult.originalText,
          cleanedText: editedCleanedText || ocrResult.cleanedText,
          translatedText: ocrResult.translatedText || undefined,
          detectedLanguage: ocrResult.detectedLanguage,
          isHandwritten: ocrResult.isHandwritten,
          pageCount: ocrResult.pageCount,
          name: getDocTypeLabel(docType),
          userId,
          employeeId: selectedEmployee?.id || undefined,
          originalImageUrls: uploadedImages.length > 0 ? uploadedImages : undefined,
        });
      }
      onUpdate();
      resetUpload();
    } catch (err) {
      console.error('Failed to save document:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDoc = async (docId: string) => {
    if (!confirm('Remove this document?')) return;
    try {
      await removeDocument(caseData.id, docId, userId);
      onUpdate();
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch (err) { console.error(err); }
  };

  const docs = caseData.documents || [];
  const groupedDocs = useMemo(() => {
    const groups: Record<string, CaseDocument[]> = {};
    docs.forEach(d => {
      const key = getDocTypeLabel(d.type);
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return groups;
  }, [docs]);

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-2">
      <SectionCard
        title={`Documents (${docs.length})`}
        icon={FileText}
        className="flex-1 flex flex-col min-h-0"
        actions={
          !caseData.isLocked && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Add Document
            </button>
          )
        }
      >
        {docs.length === 0 && !showUpload ? (
          <div className="text-center py-8">
            <FileUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded yet</p>
            {!caseData.isLocked && (
              <button onClick={() => setShowUpload(true)} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <Upload className="w-4 h-4 inline mr-1" /> Upload First Document
              </button>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 h-full min-h-0">
            {/* Document List */}
            <div className="lg:col-span-1 space-y-2 overflow-y-auto">
              {Object.entries(groupedDocs).map(([group, groupDocs]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
                  {groupDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => { setSelectedDoc(doc); setPreviewTab('cleaned'); }}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                        selectedDoc?.id === doc.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.type.replace(/_/g, ' ')}</span>
                        </div>
                        {!caseData.isLocked && (
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveDoc(doc.id); }} title="Remove document" className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(doc.createdAt)}</p>
                        {doc.detectedLanguage && doc.detectedLanguage.toLowerCase() !== 'english' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">{doc.detectedLanguage}</span>
                        )}
                        {doc.isHandwritten && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">Handwritten</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Document Preview */}
            <div className="lg:col-span-2 min-h-0 flex flex-col">
              {selectedDoc ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-5 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{selectedDoc.type.replace(/_/g, ' ')}</h4>
                    <span className="text-xs text-gray-400">{formatDateTime(selectedDoc.createdAt)}</span>
                  </div>
                  {/* Preview tabs */}
                  <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-shrink-0">
                    {selectedDoc.originalText && (
                      <button onClick={() => setPreviewTab('original')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === 'original' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                        Original
                      </button>
                    )}
                    {selectedDoc.translatedText && (
                      <button onClick={() => setPreviewTab('translated')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === 'translated' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                        Translated
                      </button>
                    )}
                    {selectedDoc.cleanedText && (
                      <button onClick={() => setPreviewTab('cleaned')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === 'cleaned' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                        Cleaned
                      </button>
                    )}
                    {selectedDoc.originalImageUrls && (
                      <button onClick={() => setPreviewTab('images')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${previewTab === 'images' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                        <Image className="w-3 h-3" /> Images
                      </button>
                    )}
                  </div>
                  {selectedDoc.detectedLanguage && (
                    <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                      <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        <Globe className="w-3 h-3" /> {selectedDoc.detectedLanguage}
                      </Badge>
                      {selectedDoc.isHandwritten && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Handwritten
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {previewTab === 'images' ? (
                      <div className="space-y-3 relative">
                        {/* Floating full-view button */}
                        {(() => {
                          try {
                            const urls: string[] = JSON.parse(selectedDoc.originalImageUrls || '[]');
                            if (urls.length > 0) return (
                              <button
                                onClick={() => {
                                  const src = urls[0].startsWith('data:') || urls[0].startsWith('http') ? urls[0] : `data:image/jpeg;base64,${urls[0]}`;
                                  openImageInNewTab(src);
                                }}
                                className="sticky top-0 z-10 ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors shadow-sm"
                                title="Open image in full view"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                Full View
                              </button>
                            );
                            return null;
                          } catch { return null; }
                        })()}
                        {(() => {
                          try {
                            const urls: string[] = JSON.parse(selectedDoc.originalImageUrls || '[]');
                            return urls.length > 0 ? urls.map((url, idx) => {
                              const imgSrc = url.startsWith('data:') || url.startsWith('http') ? url : `data:image/jpeg;base64,${url}`;
                              return (
                                <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                                  <button onClick={() => openImageInNewTab(imgSrc)} className="w-full" title="Click to view full size">
                                    <img src={imgSrc} alt={`Page ${idx + 1}`} className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" />
                                  </button>
                                  <p className="text-[10px] text-gray-400 text-center py-1">Page {idx + 1}</p>
                                </div>
                              );
                            }) : <p className="text-sm text-gray-400 text-center py-8">No uploaded images available</p>;
                          } catch {
                            return <p className="text-sm text-gray-400 text-center py-8">No uploaded images available</p>;
                          }
                        })()}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed p-0 m-0 bg-transparent">
                        {previewTab === 'original' && (selectedDoc.originalText || 'No original text')}
                        {previewTab === 'translated' && (selectedDoc.translatedText || 'No translated text')}
                        {previewTab === 'cleaned' && (selectedDoc.cleanedText || selectedDoc.originalText || 'No text content')}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[12rem] rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-400 dark:text-gray-500">Select a document to preview</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Upload Modal ─────────────────────────────────────────────── */}
        {showUpload && (
          <div
            ref={modalRef}
            className={`fixed z-50 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col select-none ${modalAnimating ? 'animate-modal-bounce' : ''}`}
            style={isMaximized
              ? { top: contentBounds.top, left: contentBounds.left, width: contentBounds.width, height: contentBounds.height, borderRadius: 0 }
              : { top: modalPos.y, left: modalPos.x, width: modalSize.w, height: modalSize.h }
            }
          >
            {/* Title bar — draggable */}
            <div
              onMouseDown={onDragStart}
              className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 cursor-move flex-shrink-0 rounded-t-2xl"
            >
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Add Document</h4>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (!isMaximized) {
                      setContentBounds(measureContentBounds());
                    }
                    setIsMaximized(!isMaximized);
                  }}
                  title={isMaximized ? 'Restore' : 'Maximize'}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {isMaximized ? <Minimize2 className="w-3.5 h-3.5 text-gray-400" /> : <Maximize2 className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <button onClick={resetUpload} title="Close" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>

            {/* ─── Processing Glassmorphism Overlay ─────────────────────── */}
            {processing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center animate-processing-overlay-in" style={{ borderRadius: 'inherit' }}>
                {/* Glassmorphism backdrop */}
                <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl" style={{ borderRadius: 'inherit' }} />

                {/* Floating ambient blobs */}
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
                  <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-400/20 dark:bg-blue-500/15 rounded-full blur-3xl animate-blob" />
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-400/20 dark:bg-purple-500/15 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
                </div>

                {/* Content card with bounce animation */}
                <div className="relative z-10 flex flex-col items-center gap-6 animate-processing-bounce-in">
                  {/* Circular Progress Ring */}
                  <div className="relative w-32 h-32">
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 rounded-full animate-processing-glow" />

                    {/* Background circle */}
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200/60 dark:text-gray-700/60" />
                      {/* Animated progress arc */}
                      <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className="text-blue-500 dark:text-blue-400 animate-processing-arc"
                        style={{
                          strokeDasharray: `${2 * Math.PI * 52}`,
                          strokeDashoffset: `${2 * Math.PI * 52 * (1 - ((processingStep + 1) / PROCESSING_STEPS.length))}`,
                          stroke: 'url(#processing-gradient)',
                          transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                      <defs>
                        <linearGradient id="processing-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl animate-processing-icon-pop" key={processingStep}>
                        {PROCESSING_STEPS[processingStep]?.icon}
                      </span>
                    </div>
                  </div>

                  {/* Step label */}
                  <div className="text-center space-y-2">
                    <p className="text-base font-semibold text-gray-800 dark:text-gray-100 animate-processing-text-in" key={`label-${processingStep}`}>
                      {PROCESSING_STEPS[processingStep]?.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Step {processingStep + 1} of {PROCESSING_STEPS.length}
                    </p>
                  </div>

                  {/* Step indicators */}
                  <div className="flex items-center gap-2">
                    {PROCESSING_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          i < processingStep
                            ? 'w-6 bg-blue-500 dark:bg-blue-400'
                            : i === processingStep
                            ? 'w-8 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse'
                            : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Page count info */}
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    Processing {uploadedImages.length} page{uploadedImages.length > 1 ? 's' : ''} • Please wait
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Step 1: Document Type */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Document Type</label>
                <select
                  value={docType}
                  onChange={e => setDocType(e.target.value as DocumentType)}
                  title="Document type"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(docTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Submitted By — auto-selected from doc type */}
              {(docType === 'complaint_a' || docType === 'complaint_b' || docType === 'witness_statement') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Submitted By</label>
                  {(() => {
                    const employees = caseData.involvedEmployees || [];
                    const complainants = employees.filter(e => e.isComplainant);
                    const witnesses = employees.filter(e => !e.isComplainant);

                    if (docType === 'witness_statement' && witnesses.length > 1) {
                      // Multiple witnesses — show picker
                      return (
                        <select
                          value={selectedEmployee?.id || ''}
                          onChange={e => setSelectedEmployee(witnesses.find(w => w.id === e.target.value) || null)}
                          title="Select witness"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select witness...</option>
                          {witnesses.map(w => <option key={w.id} value={w.id}>{w.name}{w.department ? ` · ${w.department}` : ''}</option>)}
                        </select>
                      );
                    }

                    if (selectedEmployee) {
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {selectedEmployee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedEmployee.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {selectedEmployee.role || (selectedEmployee.isComplainant ? 'Complainant' : 'Witness')}
                              {selectedEmployee.department ? ` · ${selectedEmployee.department}` : ''}
                            </p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                        No {docType === 'witness_statement' ? 'witnesses' : 'complainants'} found. Add employees to the case first.
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Step 2: Input Method */}
              {!uploadMode && !ocrResult && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUploadMode('scan')}
                    className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                  >
                    <Image className="w-8 h-8 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Upload File</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Upload images or PDFs for AI text extraction</span>
                  </button>
                  <button
                    onClick={() => setUploadMode('manual')}
                    className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                  >
                    <Type className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Type Manually</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Type or paste document text directly</span>
                  </button>
                </div>
              )}

              {/* ─── Manual Entry Mode ──────────────────────────────── */}
              {uploadMode === 'manual' && (
                <div>
                  <textarea
                    value={docContent}
                    onChange={e => setDocContent(e.target.value)}
                    rows={12}
                    placeholder="Type or paste document content here..."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button onClick={resetUpload} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={!docContent.trim() || saving} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Add Document
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Scan/Upload Mode ──────────────────────────────── */}
              {uploadMode === 'scan' && !ocrResult && (
                <div className="space-y-4">
                  <div>
                    {fileLoading ? (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Processing file...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          onChange={handleFileSelect}
                          title="Upload images or PDF"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-sm text-gray-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all">
                          <FileUp className="w-5 h-5" />
                          <span>Click to select images or PDF files</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadedImages.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{uploadedImages.length} page{uploadedImages.length > 1 ? 's' : ''} selected</p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {uploadedImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <button onClick={() => openImageInNewTab(`data:image/jpeg;base64,${img}`)} className="w-full" title="Click to view full size">
                              <img
                                src={`data:image/jpeg;base64,${img}`}
                                alt={imageNames[idx]}
                                className="w-full h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                              />
                            </button>
                            <button onClick={() => removeImage(idx)} title="Remove page" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              value={imageNames[idx]}
                              onChange={e => {
                                const newNames = [...imageNames];
                                newNames[idx] = e.target.value;
                                setImageNames(newNames);
                              }}
                              className="w-full text-[9px] text-gray-600 dark:text-gray-400 mt-0.5 px-1 py-0.5 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-400 focus:outline-none bg-transparent truncate"
                              title="Click to rename"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadedImages.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5" /> Document Language
                      </label>
                      <select value={sourceLanguage} onChange={e => { setSourceLanguage(e.target.value); setLanguageConfirmed(false); }} title="Source language" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                        {SUPPORTED_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                      </select>

                      {/* Language Confirmation Checkbox */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setLanguageConfirmed(!languageConfirmed)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLanguageConfirmed(!languageConfirmed); } }}
                        className={`mt-3 w-full flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer ${
                          languageConfirmed
                            ? 'border-green-300 dark:border-green-600 bg-green-50/60 dark:bg-green-900/15'
                            : 'border-orange-300 dark:border-orange-600 bg-orange-50/60 dark:bg-orange-900/15'
                        }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                          languageConfirmed
                            ? 'bg-green-500 text-white'
                            : 'border-2 border-orange-400 dark:border-orange-500'
                        }`}>
                          {languageConfirmed && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${
                            languageConfirmed
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {languageConfirmed ? 'Thank you for confirming!' : 'Please Confirm Language'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                            {languageConfirmed
                              ? 'You can now click the button below to proceed with processing.'
                              : 'Please confirm that the selected language matches the language used in the scanned document in order to get the correct result.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {ocrError && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{ocrError}</div>
                  )}

                </div>
              )}

              {/* ─── OCR Review ────────────────────────────────────── */}
              {ocrResult && (
                <div className="space-y-4 relative">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3" /> Processed</Badge>
                    <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{ocrResult.pageCount} page{ocrResult.pageCount > 1 ? 's' : ''}</Badge>
                    {ocrResult.detectedLanguage && <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"><Globe className="w-3 h-3" /> {ocrResult.detectedLanguage}</Badge>}
                    {ocrResult.isHandwritten && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Handwritten</Badge>}
                    {ocrResult.confidence > 0 && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{Math.round(ocrResult.confidence * 100)}% confidence</Badge>}
                  </div>

                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button onClick={() => { setReviewTab('original'); stopReading(); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reviewTab === 'original' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Original</button>
                    {ocrResult.translatedText && <button onClick={() => { setReviewTab('translated'); stopReading(); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reviewTab === 'translated' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Translated</button>}
                    <button onClick={() => { setReviewTab('cleaned'); stopReading(); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reviewTab === 'cleaned' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Cleaned</button>
                    <button onClick={() => { setReviewTab('images'); stopReading(); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reviewTab === 'images' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Images</button>
                  </div>

                  {/* Edit button row for Original and Cleaned */}
                  {(reviewTab === 'original' || reviewTab === 'cleaned') && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {reviewTab === 'original' ? `Original (${ocrResult.detectedLanguage || sourceLanguage})` : 'Cleaned'}
                      </p>
                      <button
                        onClick={() => {
                          if (reviewTab === 'original') {
                            if (!isEditingOriginal) setEditedOriginalText(ocrResult.originalText || '');
                            setIsEditingOriginal(!isEditingOriginal);
                          } else {
                            if (!isEditingCleaned) setEditedCleanedText(ocrResult.cleanedText || '');
                            setIsEditingCleaned(!isEditingCleaned);
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        {(reviewTab === 'original' ? isEditingOriginal : isEditingCleaned) ? 'Done' : 'Edit'}
                      </button>
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 overflow-y-auto flex-1">
                    {reviewTab === 'images' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {uploadedImages.map((img, idx) => (
                          <div key={idx}>
                            <button
                              onClick={() => openImageInNewTab(`data:image/jpeg;base64,${img}`)}
                              className="w-full"
                            >
                              <img
                                src={`data:image/jpeg;base64,${img}`}
                                alt={`Page ${idx + 1}`}
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-lg transition-all"
                                title="Click to view full size"
                              />
                            </button>
                            <p className="text-[10px] text-gray-400 text-center mt-1">Page {idx + 1}</p>
                          </div>
                        ))}
                      </div>
                    ) : reviewTab === 'original' && isEditingOriginal ? (
                      <textarea
                        value={editedOriginalText}
                        onChange={e => setEditedOriginalText(e.target.value)}
                        title="Edit original text"
                        className="w-full min-h-[300px] text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed bg-transparent border-none outline-none resize-none"
                      />
                    ) : reviewTab === 'cleaned' && isEditingCleaned ? (
                      <textarea
                        value={editedCleanedText}
                        onChange={e => setEditedCleanedText(e.target.value)}
                        title="Edit cleaned text"
                        className="w-full min-h-[300px] text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed bg-transparent border-none outline-none resize-none"
                      />
                    ) : (
                      <pre ref={highlightContainerRef} className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                        {(() => {
                          let text = '';
                          if (reviewTab === 'original') text = editedOriginalText || ocrResult.originalText || 'No text extracted';
                          else if (reviewTab === 'translated') text = ocrResult.translatedText || 'No translation';
                          else if (reviewTab === 'cleaned') text = editedCleanedText || ocrResult.cleanedText || 'No cleaned text';

                          if (!isReading || reviewTab === 'images') return text;

                          const words = text.split(/(\s+)/);
                          return words.map((segment, i) => {
                            if (/^\s+$/.test(segment)) return segment;
                            return (
                              <span key={i} data-word="" className="tts-word">
                                {segment}
                              </span>
                            );
                          });
                        })()}
                      </pre>
                    )}
                  </div>

                  {/* Translation Consent Dialog */}
                  {showTranslationConsent && (
                    <div className="p-4 rounded-xl border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 animate-fade-in">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Listen to English Translation?</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Would you like me to read the English translation of this document?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTranslationConsent(true)}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleTranslationConsent(false)}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {ocrResult.summary && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Summary</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{ocrResult.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer — Cancel / Process (scan mode, before OCR) */}
            {uploadMode === 'scan' && !ocrResult && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 rounded-b-2xl">
                <button onClick={resetUpload} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                <button onClick={handleProcess} disabled={uploadedImages.length === 0 || processing || !languageConfirmed} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {processing ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing {uploadedImages.length} page{uploadedImages.length > 1 ? 's' : ''}...</>) : !languageConfirmed && uploadedImages.length > 0 ? (<><AlertCircle className="w-3.5 h-3.5" /> Confirm Language First</>) : (<><Sparkles className="w-3.5 h-3.5" /> Process {uploadedImages.length} Page{uploadedImages.length > 1 ? 's' : ''}</>)}
                </button>
              </div>
            )}

            {/* Sticky footer — Cancel / Accept */}
            {ocrResult && !showAcceptance && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 rounded-b-2xl">
                <button onClick={resetUpload} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                <button onClick={() => setShowAcceptance(true)} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept &amp; Save Document
                </button>
              </div>
            )}

            {/* ─── Document Acceptance Workflow Overlay ─────────────────── */}
            {showAcceptance && ocrResult && (
              <div className="absolute inset-0 z-10 bg-white dark:bg-gray-800 rounded-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Document Acceptance</h4>
                  <button
                    onClick={() => { setShowAcceptance(false); setAcceptanceStep(0); setEmployeeReviewConfirmed(false); setEmployeeReviewTimestamp(null); setSignatureImage(null); setEmployeeSignatureTimestamp(null); setSupervisorId(''); setSupervisorCertificationConfirmed(false); setSupervisorCertificationTimestamp(null); setAcceptanceError(''); signaturePathsRef.current = []; currentPathRef.current = { points: [] }; }}
                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Error alert */}
                {acceptanceError && (
                  <div className="mx-5 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{acceptanceError}</p>
                  </div>
                )}

                {/* Stepper */}
                <div className="flex items-center justify-center gap-0 px-5 py-4 flex-shrink-0">
                  {[
                    { label: 'Employee Review', icon: Search },
                    { label: 'Digital Signature', icon: PenTool },
                    { label: 'Supervisor Certification', icon: ShieldCheck },
                  ].map((step, idx) => {
                    const isCompleted = idx === 0 ? !!employeeReviewTimestamp : idx === 1 ? !!(employeeSignatureTimestamp && signatureImage) : !!supervisorCertificationTimestamp;
                    const isCurrent = idx === acceptanceStep;
                    return (
                      <div key={idx} className="flex items-center">
                        {idx > 0 && (
                          <div className={`w-8 h-0.5 ${isCompleted || (idx <= acceptanceStep && idx > 0 && (idx === 1 ? !!employeeReviewTimestamp : !!employeeSignatureTimestamp)) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        )}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Step content — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
                  {/* Step header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700/50">
                    {acceptanceStep === 0 && <Search className="w-4 h-4 text-blue-600" />}
                    {acceptanceStep === 1 && <PenTool className="w-4 h-4 text-blue-600" />}
                    {acceptanceStep === 2 && <ShieldCheck className="w-4 h-4 text-blue-600" />}
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {acceptanceStep === 0 && 'Step 1: Employee Review'}
                      {acceptanceStep === 1 && 'Step 2: Digital Signature'}
                      {acceptanceStep === 2 && 'Step 3: Supervisor Certification'}
                    </h5>
                  </div>

                  {/* ─── Step 1: Employee Review ─── */}
                  {acceptanceStep === 0 && (
                    <div className="space-y-4">
                      {/* Document Type */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Document Type</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{getDocTypeLabel(docType)}</p>
                      </div>

                      {/* Original Text Review */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Original Text</p>
                        <div className="max-h-[200px] overflow-y-auto">
                          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {editedOriginalText || ocrResult.originalText}
                          </pre>
                        </div>
                      </div>

                      {/* Translated text if available */}
                      {ocrResult.translatedText && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                          <p className="text-[10px] font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-2">Translated Text</p>
                          <div className="max-h-[150px] overflow-y-auto">
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                              {ocrResult.translatedText}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Confirmation checkbox */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setEmployeeReviewConfirmed(!employeeReviewConfirmed)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEmployeeReviewConfirmed(!employeeReviewConfirmed); } }}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors mt-0.5 ${
                          employeeReviewConfirmed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {employeeReviewConfirmed && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          I confirm that I have reviewed this complaint and the text accurately reflects the submitted complaint based on my review.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ─── Step 2: Digital Signature ─── */}
                  {acceptanceStep === 1 && (
                    <div className="space-y-4">
                      {/* Instructions */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <PenTool className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Digital Signature</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          Please sign using your mouse or trackpad in the box below. Your signature will be recorded as part of the document audit trail.
                        </p>
                      </div>

                      {/* Signature Canvas */}
                      <div className="relative">
                        <canvas
                          ref={signatureCanvasRef}
                          width={500}
                          height={200}
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 cursor-crosshair"
                          style={{ height: 200, backgroundColor: '#f9fafb', touchAction: 'none' }}
                          onMouseDown={(e) => {
                            const canvas = signatureCanvasRef.current;
                            if (!canvas) return;
                            isDrawingRef.current = true;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const x = (e.clientX - rect.left) * scaleX;
                            const y = (e.clientY - rect.top) * scaleY;
                            currentPathRef.current = { points: [{ x, y }] };
                          }}
                          onMouseMove={(e) => {
                            if (!isDrawingRef.current) return;
                            const canvas = signatureCanvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            const x = (e.clientX - rect.left) * scaleX;
                            const y = (e.clientY - rect.top) * scaleY;
                            currentPathRef.current.points.push({ x, y });
                            // Draw live
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            const pts = currentPathRef.current.points;
                            if (pts.length < 2) return;
                            ctx.strokeStyle = '#000';
                            ctx.lineWidth = 3;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.beginPath();
                            ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
                            ctx.lineTo(x, y);
                            ctx.stroke();
                          }}
                          onMouseUp={() => {
                            if (!isDrawingRef.current) return;
                            isDrawingRef.current = false;
                            if (currentPathRef.current.points.length > 0) {
                              signaturePathsRef.current.push({ ...currentPathRef.current });
                              currentPathRef.current = { points: [] };
                              // Generate signature image
                              const canvas = signatureCanvasRef.current;
                              if (canvas) {
                                // Create a clean white-background image
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = canvas.width;
                                tempCanvas.height = canvas.height;
                                const tempCtx = tempCanvas.getContext('2d')!;
                                tempCtx.fillStyle = '#fff';
                                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                                // Redraw all paths
                                tempCtx.strokeStyle = '#000';
                                tempCtx.lineWidth = 3;
                                tempCtx.lineCap = 'round';
                                tempCtx.lineJoin = 'round';
                                for (const path of signaturePathsRef.current) {
                                  if (path.points.length < 2) continue;
                                  tempCtx.beginPath();
                                  tempCtx.moveTo(path.points[0].x, path.points[0].y);
                                  for (let i = 1; i < path.points.length; i++) {
                                    tempCtx.lineTo(path.points[i].x, path.points[i].y);
                                  }
                                  tempCtx.stroke();
                                }
                                const dataUrl = tempCanvas.toDataURL('image/png');
                                setSignatureImage(dataUrl.replace(/^data:image\/png;base64,/, ''));
                              }
                            }
                          }}
                          onMouseLeave={() => {
                            if (isDrawingRef.current) {
                              isDrawingRef.current = false;
                              if (currentPathRef.current.points.length > 0) {
                                signaturePathsRef.current.push({ ...currentPathRef.current });
                                currentPathRef.current = { points: [] };
                              }
                            }
                          }}
                        />
                        {/* Signature line guide */}
                        <div className="absolute bottom-10 left-6 right-6 h-px bg-gray-300 dark:bg-gray-500 opacity-30 pointer-events-none" />
                        {/* Placeholder text */}
                        {!signatureImage && signaturePathsRef.current.length === 0 && (
                          <p className="absolute bottom-12 left-1/2 -translate-x-1/2 text-sm italic text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                            Sign here
                          </p>
                        )}
                      </div>

                      {/* Clear + status row */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            signaturePathsRef.current = [];
                            currentPathRef.current = { points: [] };
                            setSignatureImage(null);
                            const canvas = signatureCanvasRef.current;
                            if (canvas) {
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                ctx.fillStyle = '#f9fafb';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                              }
                            }
                          }}
                          disabled={!signatureImage && signaturePathsRef.current.length === 0}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Clear
                        </button>
                        {signatureImage && (
                          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Signature captured</span>
                          </div>
                        )}
                      </div>

                      {/* Acknowledgment */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Acknowledgment</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          By signing above, I acknowledge that I have reviewed the document content and confirm its accuracy to the best of my knowledge.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ─── Step 3: Supervisor Certification ─── */}
                  {acceptanceStep === 2 && (
                    <div className="space-y-4">
                      {/* Supervisor Information */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Supervisor Information</p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">Supervisor or Manager ID</label>
                            <input
                              type="text"
                              value={supervisorId}
                              onChange={e => setSupervisorId(e.target.value.toUpperCase())}
                              placeholder="Enter ID (optional)"
                              className="w-full px-3 py-2 rounded-lg text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">Supervisor Name</label>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-600/50 border border-gray-200 dark:border-gray-600">
                              <Lock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-700 dark:text-gray-300">{userName || 'Current User'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Document Review Summary */}
                      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Document Review Summary</p>
                        </div>
                        <div className="space-y-2">
                          {/* Employee Review row */}
                          <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-white dark:bg-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-700 dark:text-gray-300">Employee Review</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {employeeReviewTimestamp ? (
                                <>
                                  <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Completed</span>
                                  <span className="text-[10px] text-gray-400">{employeeReviewTimestamp.toLocaleTimeString()}</span>
                                </>
                              ) : (
                                <span className="text-[10px] font-medium text-orange-500">Pending</span>
                              )}
                            </div>
                          </div>
                          {/* Digital Signature row */}
                          <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-white dark:bg-gray-700/50">
                            <div className="flex items-center gap-2">
                              <PenTool className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-700 dark:text-gray-300">Digital Signature</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {employeeSignatureTimestamp ? (
                                <>
                                  <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Captured</span>
                                  <span className="text-[10px] text-gray-400">{employeeSignatureTimestamp.toLocaleTimeString()}</span>
                                </>
                              ) : (
                                <span className="text-[10px] font-medium text-orange-500">Pending</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Certification checkbox */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSupervisorCertificationConfirmed(!supervisorCertificationConfirmed)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSupervisorCertificationConfirmed(!supervisorCertificationConfirmed); } }}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors mt-0.5 ${
                          supervisorCertificationConfirmed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {supervisorCertificationConfirmed && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          As the supervising authority, I certify that the employee has properly reviewed the document, provided their digital signature, and the submission process has been completed in accordance with company policy.
                        </p>
                      </div>

                      {/* Audit Trail Notice */}
                      <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-3.5 h-3.5 text-orange-500" />
                          <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Audit Trail Notice</p>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                          Upon submission, a comprehensive audit log will be created containing all timestamps, signatures, and document content. This log is tamper-evident and includes a cryptographic hash for verification purposes.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation buttons — sticky footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  {/* Back button (hidden on step 0) */}
                  {acceptanceStep > 0 ? (
                    <button
                      onClick={() => setAcceptanceStep(acceptanceStep - 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                  ) : <div />}

                  {/* Continue / Submit */}
                  {acceptanceStep < 2 ? (
                    <button
                      onClick={() => {
                        if (acceptanceStep === 0) {
                          setEmployeeReviewTimestamp(new Date());
                        } else if (acceptanceStep === 1) {
                          setEmployeeSignatureTimestamp(new Date());
                        }
                        setAcceptanceStep(acceptanceStep + 1);
                      }}
                      disabled={
                        (acceptanceStep === 0 && !employeeReviewConfirmed) ||
                        (acceptanceStep === 1 && !signatureImage)
                      }
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Continue
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const canSubmit = !!employeeReviewTimestamp && !!signatureImage && !!employeeSignatureTimestamp && supervisorCertificationConfirmed;
                        if (!canSubmit) {
                          setAcceptanceError('Please complete all required steps before submitting.');
                          return;
                        }
                        setIsSubmitting(true);
                        setAcceptanceError('');
                        const now = new Date();
                        setSupervisorCertificationTimestamp(now);
                        try {
                          // Generate version hash (SHA-256)
                          const hashContent = (editedOriginalText || ocrResult.originalText) + (editedCleanedText || ocrResult.cleanedText) + (ocrResult.translatedText || '') + signatureImage;
                          const encoder = new TextEncoder();
                          const data = encoder.encode(hashContent);
                          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                          const hashArray = Array.from(new Uint8Array(hashBuffer));
                          const versionHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                          // Save document with signature and audit fields
                          await addDocument(caseData.id, {
                            type: docType,
                            originalText: editedOriginalText || ocrResult.originalText,
                            cleanedText: editedCleanedText || ocrResult.cleanedText,
                            translatedText: ocrResult.translatedText || undefined,
                            detectedLanguage: ocrResult.detectedLanguage,
                            isHandwritten: ocrResult.isHandwritten,
                            pageCount: ocrResult.pageCount,
                            name: getDocTypeLabel(docType),
                            userId,
                            employeeId: selectedEmployee?.id || undefined,
                            submittedBy: selectedEmployee?.name || undefined,
                            originalImageUrls: uploadedImages.length > 0 ? uploadedImages : undefined,
                            signatureImageData: signatureImage,
                            employeeReviewTimestamp: employeeReviewTimestamp!.toISOString(),
                            employeeSignatureTimestamp: employeeSignatureTimestamp!.toISOString(),
                            supervisorCertificationTimestamp: now.toISOString(),
                            supervisorId: supervisorId || undefined,
                            supervisorName: userName || undefined,
                          });

                          // Fire-and-forget audit log submission
                          submitDocumentAuditLog({
                            complaintId: caseData.id,
                            documentId: crypto.randomUUID(),
                            originalText: editedOriginalText || ocrResult.originalText,
                            cleanedText: editedCleanedText || ocrResult.cleanedText,
                            translatedText: ocrResult.translatedText || undefined,
                            signatureImageBase64: signatureImage,
                            employeeReviewTimestamp: employeeReviewTimestamp!.toISOString(),
                            employeeSignatureTimestamp: employeeSignatureTimestamp!.toISOString(),
                            supervisorCertificationTimestamp: now.toISOString(),
                            supervisorId: supervisorId || undefined,
                            supervisorName: userName || undefined,
                            submittedBy: selectedEmployee?.name || 'Unknown',
                            submittedById: selectedEmployee?.id || undefined,
                            deviceId: 'web-browser',
                            appVersion: '1.0.0',
                            versionHash,
                          }).catch(err => console.error('Audit log error:', err));

                          onUpdate();
                          resetUpload();
                        } catch (err) {
                          console.error('Submit document error:', err);
                          setAcceptanceError('Failed to submit document. Please try again.');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={!supervisorCertificationConfirmed || isSubmitting}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          Submit Document
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Resize handle */}
            {!isMaximized && (
              <div
                onMouseDown={onResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                style={{ background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%, transparent 51%, transparent 75%, #94a3b8 75%)' }}
              />
            )}
          </div>
        )}

        {/* Floating Read Button — fixed to content area, above modal */}
        {showUpload && ocrResult && reviewTab !== 'images' && !(reviewTab === 'original' && isEditingOriginal) && !(reviewTab === 'cleaned' && isEditingCleaned) && (
          <button
            onClick={() => isReading ? stopReading() : startReading()}
            disabled={isLoadingAudio}
            className={`fixed z-[60] flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
              isReading
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'
            } ${isLoadingAudio ? 'opacity-70 cursor-wait' : ''}`}
            style={{
              bottom: ocrResult ? 80 : 30,
              right: 40,
            }}
          >
            {isLoadingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isReading ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            {isLoadingAudio ? 'Loading...' : isReading ? 'Stop' : 'Read'}
          </button>
        )}
      </SectionCard>

    </div>
  );
}

// ─── ANALYSIS TAB ─────────────────────────────────────────────────────────────

function AnalysisTab({ caseData, onUpdate, userId }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string;
}) {
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [policyResult, setPolicyResult] = useState<PolicyMatchResult | null>(null);
  const [recommendationResult, setRecommendationResult] = useState<RecommendationResult | null>(null);
  const [policies, setPolicies] = useState<WorkplacePolicy[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisModalTab, setAnalysisModalTab] = useState<'summary' | 'compare' | 'details'>('summary');
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [expandedPolicyMatch, setExpandedPolicyMatch] = useState<number | null>(null);
  const [policyDeleteTarget, setPolicyDeleteTarget] = useState<{ index: number; match: PolicyMatch } | null>(null);

  // ─── Post-Selection Flow States ─────────────────────────────────────────────
  const [confirmRec, setConfirmRec] = useState<Recommendation | null>(null); // null = modal hidden
  const [docGenerating, setDocGenerating] = useState(false);
  const [docGenStep, setDocGenStep] = useState(0);
  const docGenStepRef = useRef(0);
  const docGenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docGenOverlayRef = useRef<HTMLDivElement | null>(null);
  const [generatingRec, setGeneratingRec] = useState<Recommendation | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedActionDocument | null>(null);
  const [docPhase, setDocPhase] = useState<'none' | 'generated' | 'review' | 'approval'>('none');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionContent, setEditingSectionContent] = useState('');
  const [docEdits, setDocEdits] = useState<DocumentEdit[]>([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [commentSectionId, setCommentSectionId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const DOC_GEN_STEPS = [
    { label: 'Analyzing case details', icon: '📋' },
    { label: 'Reviewing statements', icon: '📝' },
    { label: 'Applying policy references', icon: '📜' },
    { label: 'Crafting professional language', icon: '✍️' },
    { label: 'Formatting document', icon: '📄' },
    { label: 'Finalizing', icon: '✅' },
  ];

  const [policyAnalysisStep, setPolicyAnalysisStep] = useState(0);
  const [policyAnalyzing, setPolicyAnalyzing] = useState(false);
  const policyStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const policyOverlayRef = useRef<HTMLDivElement | null>(null);
  const policyStepRef = useRef(0);

  const [comparisonAnalysisStep, setComparisonAnalysisStep] = useState(0);
  const [comparisonAnalyzing, setComparisonAnalyzing] = useState(false);
  const comparisonStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comparisonOverlayRef = useRef<HTMLDivElement | null>(null);
  const comparisonStepRef = useRef(0);

  const [recommendationAnalysisStep, setRecommendationAnalysisStep] = useState(0);
  const [recommendationAnalyzing, setRecommendationAnalyzing] = useState(false);
  const recommendationStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recommendationOverlayRef = useRef<HTMLDivElement | null>(null);
  const recommendationStepRef = useRef(0);

  const RECOMMENDATION_ANALYSIS_STEPS = [
    { label: 'Reviewing case evidence', icon: '📂' },
    { label: 'Analyzing policy alignment', icon: '📋' },
    { label: 'Evaluating employee history', icon: '👤' },
    { label: 'Generating per-employee options', icon: '⚖️' },
    { label: 'Assessing risk levels', icon: '🛡️' },
    { label: 'Building supervisor guidance', icon: '💡' },
    { label: 'Finalizing recommendations', icon: '✅' },
  ];

  const POLICY_ANALYSIS_STEPS = [
    { label: 'Preparing policy sections', icon: '📋' },
    { label: 'Reading complaint statements', icon: '📝' },
    { label: 'Scanning witness accounts', icon: '👥' },
    { label: 'Matching against policies', icon: '🔍' },
    { label: 'Evaluating relevance scores', icon: '⚖️' },
    { label: 'Generating guidance', icon: '💡' },
    { label: 'Finalizing alignment', icon: '✅' },
  ];

  const COMPARISON_ANALYSIS_STEPS = [
    { label: 'Reading complaint statements', icon: '📄' },
    { label: 'Analyzing witness accounts', icon: '👥' },
    { label: 'Comparing key details', icon: '🔎' },
    { label: 'Identifying contradictions', icon: '⚡' },
    { label: 'Finding agreement points', icon: '🤝' },
    { label: 'Building neutral summary', icon: '📊' },
    { label: 'Finalizing analysis', icon: '✨' },
  ];

  // ─── Review Active Policy Modal State ─────────────────────────────────────────
  const [showPolicyReviewModal, setShowPolicyReviewModal] = useState(false);
  const [policyReviewSearch, setPolicyReviewSearch] = useState('');
  const [policyReviewSelected, setPolicyReviewSelected] = useState<Set<string>>(new Set());
  const [policyReviewPos, setPolicyReviewPos] = useState({ x: 80, y: 60 });
  const [policyReviewSize, setPolicyReviewSize] = useState({ w: 1250, h: 600 });
  const policyReviewDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // AI validation flow for manually-added policy sections
  const [prValidating, setPrValidating] = useState(false);
  const [prValidationStep, setPrValidationStep] = useState(0);
  const prValidationStepRef = useRef(0);
  const prValidationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prValidationResults, setPrValidationResults] = useState<PolicyMatch[] | null>(null);
  const [prShowResults, setPrShowResults] = useState(false);

  const PR_VALIDATION_STEPS = [
    { label: 'Reviewing selected sections', icon: '📋' },
    { label: 'Analyzing complaint statements', icon: '📝' },
    { label: 'Checking witness accounts', icon: '👥' },
    { label: 'Evaluating relevance to case', icon: '⚖️' },
    { label: 'Generating assessment', icon: '✨' },
  ];

  // Evidence expansion state
  const [expandedEvSection, setExpandedEvSection] = useState<'witnesses' | 'history' | null>(null);
  const [hasPriorHistory, setHasPriorHistory] = useState<boolean | null>(null);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [addPersonName, setAddPersonName] = useState('');
  const [addPersonEmployeeId, setAddPersonEmployeeId] = useState('');
  const [addPersonRole, setAddPersonRole] = useState('');
  const [addPersonDepartment, setAddPersonDepartment] = useState('');
  const [addPersonIsComplainant, setAddPersonIsComplainant] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  // Prior history document upload state
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docUploadType, setDocUploadType] = useState<string>('prior_record');
  const [docUploadMode, setDocUploadMode] = useState<'file' | 'manual' | null>(null);
  const [docUploadText, setDocUploadText] = useState('');
  const [docUploadImages, setDocUploadImages] = useState<string[]>([]);
  const [docUploadImageNames, setDocUploadImageNames] = useState<string[]>([]);
  const [docUploadProcessing, setDocUploadProcessing] = useState(false);
  const [docUploadSaving, setDocUploadSaving] = useState(false);
  const [docUploadOcrResult, setDocUploadOcrResult] = useState<OCRResult | null>(null);
  const [docUploadFileLoading, setDocUploadFileLoading] = useState(false);
  const [docUploadLanguage, setDocUploadLanguage] = useState('English');

  // Doc upload modal drag/resize/maximize state
  const [duIsMaximized, setDuIsMaximized] = useState(true);
  const [duPos, setDuPos] = useState({ x: 0, y: 0 });
  const [duSize, setDuSize] = useState({ w: 720, h: 520 });
  const [duBounds, setDuBounds] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [duReady, setDuReady] = useState(false);
  const duDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const duResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Analysis modal drag/resize/maximize state
  const [amIsMaximized, setAmIsMaximized] = useState(true);
  const [amPos, setAmPos] = useState({ x: 0, y: 0 });
  const [amSize, setAmSize] = useState({ w: 720, h: 520 });
  const [amBounds, setAmBounds] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [amReady, setAmReady] = useState(false);
  const amDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const amResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const amModalRef = useRef<HTMLDivElement>(null);

  const measureAmBounds = useCallback(() => {
    const mainEl = document.querySelector('main') as HTMLElement;
    const rect = mainEl ? mainEl.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    const stickyHeader = mainEl?.querySelector('.sticky.top-0') as HTMLElement;
    const stickyH = stickyHeader ? stickyHeader.offsetHeight : 0;
    const margin = 8;
    return { top: rect.top + stickyH, left: rect.left, width: rect.width, height: rect.height - stickyH - margin };
  }, []);

  // Keep bounds synced when modal is open
  useEffect(() => {
    if (!showAnalysisModal) return;
    const mainEl = document.querySelector('main') as HTMLElement;
    if (!mainEl) return;
    const update = () => setAmBounds(measureAmBounds());
    const ro = new ResizeObserver(update);
    ro.observe(mainEl);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [showAnalysisModal, measureAmBounds]);

  // Center modal on first open
  useEffect(() => {
    if (showAnalysisModal && !amReady) {
      const bounds = measureAmBounds();
      setAmBounds(bounds);
      const w = Math.min(900, Math.max(600, bounds.width * 0.65));
      const h = Math.min(700, Math.max(450, bounds.height * 0.75));
      setAmSize({ w, h });
      setAmPos({ x: bounds.left + (bounds.width - w) / 2, y: Math.max(bounds.top + 10, bounds.top + (bounds.height - h) / 2) });
      setAmIsMaximized(true);
      setAmReady(true);
    }
    if (!showAnalysisModal) setAmReady(false);
  }, [showAnalysisModal, amReady, measureAmBounds]);

  const onAmDragStart = useCallback((e: React.MouseEvent) => {
    if (amIsMaximized) return;
    e.preventDefault();
    amDragRef.current = { startX: e.clientX, startY: e.clientY, origX: amPos.x, origY: amPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!amDragRef.current) return;
      setAmPos({ x: amDragRef.current.origX + (ev.clientX - amDragRef.current.startX), y: Math.max(0, amDragRef.current.origY + (ev.clientY - amDragRef.current.startY)) });
    };
    const onUp = () => { amDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [amIsMaximized, amPos]);

  const onAmResizeStart = useCallback((e: React.MouseEvent) => {
    if (amIsMaximized) return;
    e.preventDefault(); e.stopPropagation();
    amResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: amSize.w, origH: amSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!amResizeRef.current) return;
      setAmSize({ w: Math.max(480, amResizeRef.current.origW + (ev.clientX - amResizeRef.current.startX)), h: Math.max(320, amResizeRef.current.origH + (ev.clientY - amResizeRef.current.startY)) });
    };
    const onUp = () => { amResizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [amIsMaximized, amSize]);

  // Doc upload modal positioning
  useEffect(() => {
    if (!showDocUpload) return;
    const mainEl = document.querySelector('main') as HTMLElement;
    if (!mainEl) return;
    const update = () => setDuBounds(measureAmBounds());
    const ro = new ResizeObserver(update);
    ro.observe(mainEl);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [showDocUpload, measureAmBounds]);

  useEffect(() => {
    if (showDocUpload && !duReady) {
      const bounds = measureAmBounds();
      setDuBounds(bounds);
      setDuIsMaximized(true);
      setDuReady(true);
    }
    if (!showDocUpload) setDuReady(false);
  }, [showDocUpload, duReady, measureAmBounds]);

  const onDuDragStart = useCallback((e: React.MouseEvent) => {
    if (duIsMaximized) return;
    e.preventDefault();
    duDragRef.current = { startX: e.clientX, startY: e.clientY, origX: duPos.x, origY: duPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!duDragRef.current) return;
      setDuPos({ x: duDragRef.current.origX + (ev.clientX - duDragRef.current.startX), y: Math.max(0, duDragRef.current.origY + (ev.clientY - duDragRef.current.startY)) });
    };
    const onUp = () => { duDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [duIsMaximized, duPos]);

  const onDuResizeStart = useCallback((e: React.MouseEvent) => {
    if (duIsMaximized) return;
    e.preventDefault(); e.stopPropagation();
    duResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: duSize.w, origH: duSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!duResizeRef.current) return;
      setDuSize({ w: Math.max(480, duResizeRef.current.origW + (ev.clientX - duResizeRef.current.startX)), h: Math.max(320, duResizeRef.current.origH + (ev.clientY - duResizeRef.current.startY)) });
    };
    const onUp = () => { duResizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [duIsMaximized, duSize]);

  const docUploadTypeLabels: Record<string, string> = {
    prior_record: 'Prior Record',
    counseling_record: 'Counseling Record',
    warning_document: 'Warning Document',
  };

  const openDocUpload = (type: string) => {
    setDocUploadType(type);
    setDocUploadMode(null);
    setDocUploadText('');
    setDocUploadImages([]);
    setDocUploadImageNames([]);
    setDocUploadOcrResult(null);
    setDocUploadLanguage('English');
    setShowDocUpload(true);
  };

  const closeDocUpload = () => {
    setShowDocUpload(false);
    setDocUploadMode(null);
    setDocUploadText('');
    setDocUploadImages([]);
    setDocUploadImageNames([]);
    setDocUploadOcrResult(null);
  };

  const handleDocFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setDocUploadFileLoading(true);
    const newImages: string[] = [];
    const newNames: string[] = [];
    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64 = canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
            newImages.push(base64);
            newNames.push(`${file.name} - Page ${i}`);
          }
        } else {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).replace(/^data:image\/[^;]+;base64,/, ''));
            reader.readAsDataURL(file);
          });
          newImages.push(base64);
          newNames.push(file.name);
        }
      }
      setDocUploadImages(prev => [...prev, ...newImages]);
      setDocUploadImageNames(prev => [...prev, ...newNames]);
    } catch (err) { setError('Failed to read file'); } finally { setDocUploadFileLoading(false); e.target.value = ''; }
  };

  const handleDocProcess = async () => {
    if (docUploadImages.length === 0) return;
    setDocUploadProcessing(true);
    try {
      const result = await processDocumentOCR({
        images: docUploadImages,
        documentType: docUploadTypeLabels[docUploadType] || docUploadType,
        sourceLanguage: docUploadLanguage,
      });
      setDocUploadOcrResult(result);
    } catch (err: any) { setError(err?.message || 'OCR processing failed'); } finally { setDocUploadProcessing(false); }
  };

  const handleDocSave = async () => {
    setDocUploadSaving(true);
    try {
      if (docUploadMode === 'manual') {
        await addDocument(caseData.id, {
          type: docUploadType as any,
          originalText: docUploadText.trim(),
          cleanedText: docUploadText.trim(),
          name: docUploadTypeLabels[docUploadType] || docUploadType,
          userId,
        });
      } else if (docUploadOcrResult) {
        await addDocument(caseData.id, {
          type: docUploadType as any,
          originalText: docUploadOcrResult.originalText,
          cleanedText: docUploadOcrResult.cleanedText,
          translatedText: docUploadOcrResult.translatedText || undefined,
          detectedLanguage: docUploadOcrResult.detectedLanguage,
          isHandwritten: docUploadOcrResult.isHandwritten,
          pageCount: docUploadOcrResult.pageCount,
          name: docUploadTypeLabels[docUploadType] || docUploadType,
          userId,
          originalImageUrls: docUploadImages.length > 0 ? docUploadImages : undefined,
        });
      }
      closeDocUpload();
      onUpdate();
    } catch (err: any) { setError(err?.message || 'Failed to save document'); } finally { setDocUploadSaving(false); }
  };

  // Load saved results
  useEffect(() => {
    if (caseData.comparisonResult) try { setComparisonResult(JSON.parse(caseData.comparisonResult)); } catch {}
    if (caseData.policyMatchingResult) try { setPolicyResult(JSON.parse(caseData.policyMatchingResult)); } catch {}
    if (caseData.policyMatches) try { setPolicyResult(JSON.parse(caseData.policyMatches)); } catch {}
    if (caseData.recommendationResult) try { setRecommendationResult(JSON.parse(caseData.recommendationResult)); } catch {}
    if (caseData.recommendations) try { setRecommendationResult(JSON.parse(caseData.recommendations)); } catch {}
    if (caseData.selectedAction) setSelectedRecommendation(caseData.selectedAction);
    // Load generated document if exists
    const rawDoc = caseData.fullGeneratedDocumentResult || caseData.generatedDocument;
    if (rawDoc) {
      try {
        const doc = typeof rawDoc === 'string' ? JSON.parse(rawDoc) : rawDoc;
        if (doc && typeof doc === 'object' && doc.actionType) {
          if (typeof doc.document === 'string') {
            try { doc.document = JSON.parse(doc.document); } catch {}
          }
          setGeneratedDoc(doc);
        }
      } catch (e) { console.error('[loadDoc] parse error:', e); }
    }
    // Load company logo URL if exists
    if (caseData.companyLogoUrl) {
      setCompanyLogoUrl(caseData.companyLogoUrl);
    }
  }, [caseData]);

  // Handle logo file selection: resize, convert to base64, save to backend
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 200;
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
              if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
              else { w = Math.round(w * maxSize / h); h = maxSize; }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
          img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setCompanyLogoUrl(dataUrl);
      await updateCase(caseData.id, { companyLogoUrl: dataUrl, userId });
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }, [caseData.id, userId]);

  const docs = caseData.documents || [];
  const complaintA = docs.find(d => d.type?.toLowerCase() === 'complaint_a');
  const complaintB = docs.find(d => d.type?.toLowerCase() === 'complaint_b');
  const witnessDocs = docs.filter(d => d.type?.toLowerCase() === 'witness_statement');
  const priorDocs = docs.filter(d => ['prior_record', 'counseling_record', 'warning_document'].includes(d.type?.toLowerCase()));
  const employees = caseData.involvedEmployees || [];
  const witnessEmployees = employees.filter(e => !e.isComplainant);
  const complainantA = employees.find(e => e.isComplainant) || employees[0];
  const complainantB = employees.find((e, i) => e.isComplainant && i > 0) || employees[1];
  const canAnalyze = complaintA && complaintB;
  const hasNewEvidence = witnessEmployees.length > 0 || priorDocs.length > 0;

  const loadPolicies = useCallback(async () => {
    if (!caseData.organizationId) return;
    try {
      const data = await fetchPolicies({ organizationId: caseData.organizationId });
      const list = Array.isArray(data) ? data : [];
      // Ensure sections is parsed if it came as a JSON string
      setPolicies(list.map(p => ({
        ...p,
        sections: typeof p.sections === 'string' ? (() => { try { return JSON.parse(p.sections as string); } catch { return null; } })() : p.sections,
      })));
    } catch {}
  }, [caseData.organizationId]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  // Fast-forward remaining animation steps then resolve
  const finishSteps = (
    currentStep: number,
    totalSteps: number,
    setStepFn: (s: number) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  ) => new Promise<void>(resolve => {
    if (timerRef.current) clearInterval(timerRef.current);
    let s = currentStep;
    const fastForward = () => {
      s++;
      if (s < totalSteps) {
        setStepFn(s);
        setTimeout(fastForward, 350);
      } else {
        setStepFn(totalSteps - 1);
        setTimeout(resolve, 600); // pause on final step before hiding
      }
    };
    if (s >= totalSteps - 1) {
      setStepFn(totalSteps - 1);
      setTimeout(resolve, 600);
    } else {
      fastForward();
    }
  });

  const handleRunComparison = async () => {
    if (!complaintA || !complaintB) return;
    setStep(1); setError('');
    setComparisonAnalysisStep(0);
    setComparisonAnalyzing(true);
    comparisonStepRef.current = 0;
    setTimeout(() => comparisonOverlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    comparisonStepTimerRef.current = setInterval(() => {
      comparisonStepRef.current++;
      if (comparisonStepRef.current < 6) { setComparisonAnalysisStep(comparisonStepRef.current); } else { setComparisonAnalysisStep(6); if (comparisonStepTimerRef.current) clearInterval(comparisonStepTimerRef.current); }
    }, 4000);
    try {
      const result = await runComparison({
        complaintA: {
          employeeName: complainantA?.name || 'Party A',
          originalText: complaintA.originalText || complaintA.cleanedText || '',
          translatedText: complaintA.translatedText || undefined,
          cleanedText: complaintA.cleanedText || undefined,
        },
        complaintB: {
          employeeName: complainantB?.name || 'Party B',
          originalText: complaintB.originalText || complaintB.cleanedText || '',
          translatedText: complaintB.translatedText || undefined,
          cleanedText: complaintB.cleanedText || undefined,
        },
        caseDetails: {
          incidentDate: caseData.incidentDate || '',
          location: caseData.location || '',
          department: caseData.department || '',
        },
        witnessStatements: witnessDocs.map(w => {
          const matchedEmp = witnessEmployees.find(e => e.id === w.employeeId);
          return { witnessName: matchedEmp?.name || 'Witness', text: w.originalText || w.cleanedText || '' };
        }),
        priorHistory: priorDocs.map(p => ({ type: p.type, summary: p.originalText || p.cleanedText || '' })),
      });
      setComparisonResult(result);
      await updateCase(caseData.id, { aiComparisonResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Analysis failed');
    } finally {
      await finishSteps(comparisonStepRef.current, COMPARISON_ANALYSIS_STEPS.length, (s) => { comparisonStepRef.current = s; setComparisonAnalysisStep(s); }, comparisonStepTimerRef);
      setStep(0); setComparisonAnalyzing(false);
    }
  };

  const handleRunPolicyMatching = async () => {
    if (!comparisonResult) return;
    setStep(2); setError('');
    setPolicyAnalysisStep(0);
    setPolicyAnalyzing(true);
    policyStepRef.current = 0;
    setTimeout(() => policyOverlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    policyStepTimerRef.current = setInterval(() => {
      policyStepRef.current++;
      if (policyStepRef.current < 6) { setPolicyAnalysisStep(policyStepRef.current); } else { setPolicyAnalysisStep(6); if (policyStepTimerRef.current) clearInterval(policyStepTimerRef.current); }
    }, 4000);
    try {
      const allSections: any[] = [];
      policies.forEach(p => {
        // Backend returns sections as a decrypted JSON string — parse it like iOS does
        let parsed: any[] | null = null;
        if (p.sections) {
          if (Array.isArray(p.sections)) {
            parsed = p.sections;
          } else if (typeof p.sections === 'string') {
            try { parsed = JSON.parse(p.sections); } catch {}
          }
        }
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          allSections.push(...parsed);
        } else if (p.originalText) {
          allSections.push({ id: p.id, sectionNumber: '1', title: p.name, content: p.originalText, type: 'general', keywords: [] });
        }
      });
      if (allSections.length === 0) { setError('No policy sections available. Please add policies first.'); setStep(0); setPolicyAnalyzing(false); if (policyStepTimerRef.current) clearInterval(policyStepTimerRef.current); return; }
      const result = await runPolicyMatching({
        caseDetails: { caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', text: complaintA?.cleanedText || complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', text: complaintB?.cleanedText || complaintB?.originalText || '' },
        analysisResult: { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary },
        witnessStatements: witnessDocs.map(w => {
          const matchedEmp = witnessEmployees.find(e => e.id === w.employeeId);
          return { witnessName: matchedEmp?.name || 'Witness', text: w.cleanedText || w.originalText || '' };
        }),
        policySections: allSections,
      });
      setPolicyResult(result);
      await updateCase(caseData.id, { policyMatchesJson: result, policyMatchingResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Policy matching failed');
    } finally {
      await finishSteps(policyStepRef.current, POLICY_ANALYSIS_STEPS.length, (s) => { policyStepRef.current = s; setPolicyAnalysisStep(s); }, policyStepTimerRef);
      setStep(0); setPolicyAnalyzing(false);
    }
  };

  const handleRunRecommendations = async () => {
    setStep(3); setError('');
    setRecommendationAnalysisStep(0);
    setRecommendationAnalyzing(true);
    recommendationStepRef.current = 0;
    setTimeout(() => recommendationOverlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    recommendationStepTimerRef.current = setInterval(() => {
      recommendationStepRef.current++;
      if (recommendationStepRef.current < RECOMMENDATION_ANALYSIS_STEPS.length) {
        setRecommendationAnalysisStep(recommendationStepRef.current);
      } else if (recommendationStepTimerRef.current) {
        clearInterval(recommendationStepTimerRef.current);
      }
    }, 4000);
    try {
      const result = await runDecisionSupport({
        caseDetails: { caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', employeeId: complainantA?.employeeFileNo || undefined, text: complaintA?.cleanedText || complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', employeeId: complainantB?.employeeFileNo || undefined, text: complaintB?.cleanedText || complaintB?.originalText || '' },
        analysisResult: comparisonResult ? { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary, emotionalLanguage: comparisonResult.emotionalLanguage } : undefined,
        policyMatches: policyResult?.matches?.map(m => ({ sectionTitle: m.sectionTitle, relevanceExplanation: m.relevanceExplanation, matchConfidence: m.matchConfidence })),
        witnessStatements: witnessDocs.map(w => {
          const matchedEmp = witnessEmployees.find(e => e.id === w.employeeId);
          return { witnessName: matchedEmp?.name || 'Witness', text: w.cleanedText || w.originalText || '' };
        }),
        priorHistory: priorDocs.length > 0 ? { hasPriorComplaints: priorDocs.some(d => d.type?.toLowerCase() === 'prior_record'), hasPriorCounseling: priorDocs.some(d => d.type?.toLowerCase() === 'counseling_record'), hasPriorWarnings: priorDocs.some(d => d.type?.toLowerCase() === 'warning_document') } : undefined,
      });
      setRecommendationResult(result);
      await updateCase(caseData.id, { aiRecommendationsJson: result, recommendationResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Recommendation generation failed');
    } finally {
      await finishSteps(recommendationStepRef.current, RECOMMENDATION_ANALYSIS_STEPS.length, (s) => { recommendationStepRef.current = s; setRecommendationAnalysisStep(s); }, recommendationStepTimerRef);
      setStep(0); setRecommendationAnalyzing(false);
    }
  };

  const handleSelectRecommendation = async (rec: Recommendation) => {
    // Show confirmation modal instead of immediately saving
    setConfirmRec(rec);
  };

  const handleConfirmSelection = async () => {
    if (!confirmRec) return;
    const rec = confirmRec;
    setConfirmRec(null);
    setSelectedRecommendation(rec.id);

    // Save selection to backend in parallel (don't block the modal)
    const targetIds = rec.targetEmployeeNames?.map(name => {
      const emp = employees.find(e => e.name.toLowerCase().includes(name.toLowerCase()));
      return emp?.id;
    }).filter(Boolean) || [];
    updateCase(caseData.id, {
      selectedActionType: rec.type,
      selectedTargetEmployeeIdsJson: targetIds,
      status: 'awaiting_action',
      userId,
    }).then(() => onUpdate()).catch(err => console.error('[ConfirmSelection] updateCase error:', err));

    // Show progress modal and generate document IMMEDIATELY
    await handleGenerateDocument(rec);
  };

  const handleGenerateDocument = async (rec: Recommendation) => {
    console.log('[DocGen] Starting generation for:', rec.title, rec.type);
    setGeneratingRec(rec);
    setDocGenerating(true);
    console.log('[DocGen] docGenerating set to true');
    setDocGenStep(0);
    docGenStepRef.current = 0;
    setError('');
    docGenTimerRef.current = setInterval(() => {
      docGenStepRef.current++;
      if (docGenStepRef.current < DOC_GEN_STEPS.length) {
        setDocGenStep(docGenStepRef.current);
      } else if (docGenTimerRef.current) {
        clearInterval(docGenTimerRef.current);
      }
    }, 5000);
    try {
      let compResult: ComparisonResult | null = null;
      try { if (caseData.comparisonResult) compResult = JSON.parse(caseData.comparisonResult); } catch {}

      let polMatches: any[] = [];
      try { if (caseData.policyMatches) polMatches = JSON.parse(caseData.policyMatches)?.matches || []; } catch {}
      try { if (caseData.policyMatchingResult) polMatches = JSON.parse(caseData.policyMatchingResult)?.matches || []; } catch {}

      const result = await generateActionDocument({
        actionType: rec.type as ActionType,
        caseDetails: { caseNumber: caseData.caseNumber, caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', text: complaintA?.cleanedText || complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', text: complaintB?.cleanedText || complaintB?.originalText || '' },
        analysisResult: compResult ? { contradictions: compResult.contradictions, agreementPoints: compResult.agreementPoints, neutralSummary: compResult.neutralSummary } : undefined,
        policyMatches: polMatches.map((m: any) => ({ sectionNumber: m.sectionNumber || '', sectionTitle: m.sectionTitle, relevanceExplanation: m.relevanceExplanation })),
        recommendationRationale: rec.rationale,
        targetEmployeeNames: rec.targetEmployeeNames,
      });
      setGeneratedDoc(result);
      setDocPhase('none');
      await updateCase(caseData.id, { generatedActionDocJson: result, fullGeneratedDocumentResultJson: result, status: 'pending_review', userId });
      onUpdate();
    } catch (err: any) {
      console.error('[DocGen] Error:', err);
      setError(err?.response?.data?.error || err?.message || 'Document generation failed');
    } finally {
      console.log('[DocGen] Finishing steps...');
      await finishSteps(docGenStepRef.current, DOC_GEN_STEPS.length, (s) => { docGenStepRef.current = s; setDocGenStep(s); }, docGenTimerRef);
      console.log('[DocGen] Setting docGenerating to false');
      setDocGenerating(false);
      setGeneratingRec(null);
    }
  };

  const handleRegenerateDocument = async () => {
    setGeneratedDoc(null);
    setDocPhase('none');
    setDocEdits([]);
    // Find the selected recommendation
    let rec: Recommendation | null = null;
    if (recommendationResult?.employeeRecommendations) {
      for (const g of recommendationResult.employeeRecommendations) {
        const found = g.recommendations.find(r => r.id === selectedRecommendation);
        if (found) { rec = found; break; }
      }
    }
    if (!rec) rec = recommendationResult?.recommendations?.find(r => r.id === selectedRecommendation) || null;
    if (rec) await handleGenerateDocument(rec);
  };

  const handleDeleteDocument = async () => {
    setGeneratedDoc(null);
    setSelectedRecommendation(null);
    setDocPhase('none');
    setDocEdits([]);
    try {
      await updateCase(caseData.id, { generatedActionDocJson: null, fullGeneratedDocumentResultJson: null, selectedActionType: null, status: 'awaiting_action', userId });
      onUpdate();
    } catch (err) { console.error(err); }
  };

  const handleApproveDocument = async () => {
    if (!approvalConfirmed) return;
    try {
      await updateCase(caseData.id, { status: 'pending_review', userId });
      setDocPhase('none');
      setApprovalNotes('');
      setApprovalConfirmed(false);
      onUpdate();
    } catch (err) { console.error(err); }
  };

  const getDocTitle = (doc: GeneratedActionDocument): string => {
    const at = (doc.actionType || '').toLowerCase();
    const d = doc.document;
    if (d && typeof d === 'object') {
      if (d.title) return d.title;
      if (at && d[at] && typeof d[at] === 'object' && d[at].title) return d[at].title;
    }
    return '';
  };

  const getDocDate = (doc: GeneratedActionDocument): string => {
    if (doc.generatedAt) {
      const d = new Date(doc.generatedAt);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return doc.generatedAt;
    }
    const at = (doc.actionType || '').toLowerCase();
    const dd = doc.document;
    if (dd && typeof dd === 'object') {
      const nested = at && dd[at] && typeof dd[at] === 'object' ? dd[at] : dd;
      if (nested.documentDate) return nested.documentDate;
    }
    return new Date().toISOString();
  };

  // Get unwrapped document data (handles nested structure like document.warning.{fields})
  const getDocData = (doc: GeneratedActionDocument): any => {
    if (!doc?.document) return {};
    let d = typeof doc.document === 'string' ? (() => { try { return JSON.parse(doc.document); } catch { return {}; } })() : doc.document;
    if (!d || typeof d !== 'object') return {};
    const at = (doc.actionType || '').toLowerCase();
    if (at && d[at] && typeof d[at] === 'object' && !Array.isArray(d[at])) {
      return { ...d[at], ...(d.title ? { title: d.title } : {}), ...(d.documentDate ? { documentDate: d.documentDate } : {}) };
    }
    return d;
  };

  const getDocSections = (doc: GeneratedActionDocument): { id: string; title: string; content: string; editable: boolean }[] => {
    if (!doc?.document) return [];
    let d = typeof doc.document === 'string' ? (() => { try { return JSON.parse(doc.document); } catch { return null; } })() : doc.document;
    if (!d || typeof d !== 'object') return [];
    const sections: { id: string; title: string; content: string; editable: boolean }[] = [];
    const at = (doc.actionType || '').toLowerCase();

    // Handle nested structure: document.warning.{fields} → unwrap to {fields}
    if (at && d[at] && typeof d[at] === 'object' && !Array.isArray(d[at])) {
      d = { ...d[at], ...(d.title ? { title: d.title } : {}), ...(d.documentDate ? { documentDate: d.documentDate } : {}) };
    }

    const fmt = (v: any): string => {
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.map(item => typeof item === 'object' ? (item.area ? `${item.area}: ${item.description || ''}` : JSON.stringify(item)) : String(item)).join('\n• ');
      if (typeof v === 'object' && v !== null) return Object.entries(v).map(([k, val]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join('\n');
      return String(v ?? '');
    };

    switch (at) {
      case 'warning':
        if (d.warningLevel) sections.push({ id: 'warningLevel', title: 'Warning Level', content: d.warningLevel, editable: false });
        if (d.describeInDetail || d.incidentDescription) sections.push({ id: 'description', title: 'Description', content: d.describeInDetail || d.incidentDescription, editable: true });
        if (d.companyRulesViolated || d.policyViolations) sections.push({ id: 'policyViolated', title: 'Policy Violated', content: fmt(d.companyRulesViolated || d.policyViolations), editable: true });
        if (d.conductDeficiency) sections.push({ id: 'conductDeficiency', title: 'Conduct Deficiency', content: d.conductDeficiency, editable: true });
        if (d.requiredCorrectiveAction || d.improvementRequired) sections.push({ id: 'correctiveAction', title: 'Corrective Action Required', content: fmt(d.requiredCorrectiveAction || d.improvementRequired), editable: true });
        if (d.consequencesOfNotPerforming || d.consequences) sections.push({ id: 'consequences', title: 'Future Consequences', content: d.consequencesOfNotPerforming || d.consequences, editable: true });
        if (d.priorActions) sections.push({ id: 'priorActions', title: 'Prior Actions', content: d.priorActions, editable: false });
        if (d.reviewDate) sections.push({ id: 'reviewDate', title: 'Review Date', content: d.reviewDate, editable: false });
        if (d.expectations) sections.push({ id: 'expectations', title: 'Expectations', content: fmt(d.expectations), editable: true });
        break;
      case 'counseling':
        if (d.incidentSummary) sections.push({ id: 'incidentSummary', title: 'Incident Summary', content: d.incidentSummary, editable: true });
        if (d.discussionPoints) sections.push({ id: 'discussionPoints', title: 'Discussion Points', content: fmt(d.discussionPoints), editable: true });
        if (d.expectations) sections.push({ id: 'expectations', title: 'Expectations', content: fmt(d.expectations), editable: true });
        if (d.policyReferences) sections.push({ id: 'policyReferences', title: 'Policy References', content: fmt(d.policyReferences), editable: true });
        if (d.improvementPlan) sections.push({ id: 'improvementPlan', title: 'Improvement Plan', content: typeof d.improvementPlan === 'object' ? `Goals: ${(d.improvementPlan.goals || []).join(', ')}\nTimeline: ${d.improvementPlan.timeline || ''}\nSupport: ${(d.improvementPlan.supportProvided || []).join(', ')}` : d.improvementPlan, editable: true });
        if (d.consequences) sections.push({ id: 'consequences', title: 'Consequences', content: d.consequences, editable: true });
        break;
      case 'coaching':
        if (d.overview) sections.push({ id: 'overview', title: 'Overview', content: d.overview, editable: true });
        if (d.discussionOutline) sections.push({ id: 'discussionOutline', title: 'Discussion Outline', content: typeof d.discussionOutline === 'object' ? `Opening: ${d.discussionOutline.opening || ''}\n\nKey Points:\n• ${(d.discussionOutline.keyPoints || []).join('\n• ')}` : d.discussionOutline, editable: true });
        if (d.talkingPoints) sections.push({ id: 'talkingPoints', title: 'Talking Points', content: fmt(d.talkingPoints), editable: true });
        if (d.questionsToAsk) sections.push({ id: 'questionsToAsk', title: 'Questions to Ask', content: fmt(d.questionsToAsk), editable: true });
        if (d.behavioralFocusAreas) sections.push({ id: 'behavioralFocusAreas', title: 'Behavioral Focus Areas', content: fmt(d.behavioralFocusAreas), editable: true });
        if (d.followUpPlan) sections.push({ id: 'followUpPlan', title: 'Follow-Up Plan', content: typeof d.followUpPlan === 'object' ? `Timeline: ${d.followUpPlan.timeline || ''}\nSuccess Indicators: ${(d.followUpPlan.successIndicators || []).join(', ')}` : d.followUpPlan, editable: true });
        break;
      case 'escalate':
        if (d.caseSummary) sections.push({ id: 'caseSummary', title: 'Case Summary', content: typeof d.caseSummary === 'object' ? `Case: ${d.caseSummary.caseNumber}\nType: ${d.caseSummary.caseType}\nDate: ${d.caseSummary.incidentDate}\nLocation: ${d.caseSummary.location}\nDepartment: ${d.caseSummary.department}` : d.caseSummary, editable: false });
        if (d.supervisorNotes) sections.push({ id: 'supervisorNotes', title: 'Supervisor Notes', content: d.supervisorNotes, editable: true });
        if (d.analysisFindings) sections.push({ id: 'analysisFindings', title: 'Analysis Findings', content: fmt(d.analysisFindings), editable: true });
        if (d.recommendedActions) sections.push({ id: 'recommendedActions', title: 'Recommended Actions', content: fmt(d.recommendedActions), editable: true });
        if (d.urgencyLevel) sections.push({ id: 'urgencyLevel', title: 'Urgency Level', content: d.urgencyLevel, editable: false });
        if (d.requestedHRActions) sections.push({ id: 'requestedHRActions', title: 'Requested HR Actions', content: fmt(d.requestedHRActions), editable: true });
        break;
    }
    return sections;
  };

  // Load review comments when review modal opens
  const loadReviewComments = useCallback(async () => {
    try {
      const result = await fetchReviewComments(caseData.id);
      setReviewComments(result.data || []);
    } catch {}
  }, [caseData.id]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !commentSectionId) return;
    setAddingComment(true);
    try {
      const comment = await addReviewComment(caseData.id, { section: commentSectionId, comment: commentText.trim(), createdBy: userId });
      setReviewComments(prev => [...prev, comment]);
      setCommentText('');
      setCommentSectionId(null);
    } catch (err) { console.error(err); }
    finally { setAddingComment(false); }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const updated = await resolveReviewComment(caseData.id, commentId);
      setReviewComments(prev => prev.map(c => c.id === commentId ? updated : c));
    } catch (err) { console.error(err); }
  };

  const handleOpenReviewModal = async () => {
    setShowReviewModal(true);
    await loadReviewComments();
    try {
      const editsResult = await fetchDocumentEdits(caseData.id);
      setDocEdits(editsResult.data || []);
    } catch {}
  };

  const handleSaveSection = async (sectionId: string, sectionTitle: string, originalContent: string, newContent: string) => {
    try {
      const edit = await saveDocumentEdit(caseData.id, { sectionId, sectionTitle, originalContent, newContent, editedBy: userId });
      setDocEdits(prev => [...prev, edit]);
      setEditingSectionId(null);
      setEditingSectionContent('');
    } catch (err) { console.error(err); }
  };

  const resetAddPersonForm = () => {
    setAddPersonName(''); setAddPersonEmployeeId(''); setAddPersonRole(''); setAddPersonDepartment(''); setAddPersonIsComplainant(false);
  };

  const handleAddPerson = async () => {
    if (!addPersonName.trim() || !addPersonEmployeeId.trim() || !addPersonRole.trim() || !addPersonDepartment.trim()) return;
    setAddingPerson(true);
    try {
      await addEmployee(caseData.id, {
        name: addPersonName.trim(),
        role: addPersonRole.trim(),
        department: addPersonDepartment.trim(),
        employeeId: addPersonEmployeeId.trim(),
        isComplainant: addPersonIsComplainant,
        userId,
      });
      resetAddPersonForm();
      setShowAddPersonModal(false);
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to add person');
    } finally { setAddingPerson(false); }
  };

  const handleRemovePerson = async (employeeId: string) => {
    try {
      await removeEmployee(caseData.id, employeeId, userId);
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to remove person');
    }
  };

  const handleReAnalyze = async () => {
    setComparisonResult(null);
    setPolicyResult(null);
    setRecommendationResult(null);
    setSelectedRecommendation(null);
    setGeneratedDoc(null);
    setDocPhase('none');
    setDocEdits([]);
    // Auto-run comparison with updated evidence
    await handleRunComparison();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'contradiction': return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Contradiction</span>;
      case 'agreement': return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Agreement</span>;
      case 'partial': return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Partial Agreement</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unclear</span>;
    }
  };

  // ─── Analysis Modal Content ──────────────────────────────────────────
  const renderAnalysisModal = () => {
    if (!showAnalysisModal || !comparisonResult) return null;
    const modalTabs = [
      { id: 'summary' as const, label: 'Summary' },
      { id: 'compare' as const, label: 'Compare' },
      { id: 'details' as const, label: 'Details' },
    ];
    return (
      <div
        ref={amModalRef}
        className="fixed z-50 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col select-none"
        style={amIsMaximized
          ? { top: amBounds.top, left: amBounds.left, width: amBounds.width, height: amBounds.height, borderRadius: 0 }
          : { top: amPos.y, left: amPos.x, width: amSize.w, height: amSize.h }
        }
      >
        {/* Title bar — draggable */}
        <div
          onMouseDown={onAmDragStart}
          className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 cursor-move flex-shrink-0 rounded-t-2xl"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-gray-300 dark:text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600" /> Complaint Analysis
            </h4>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (!amIsMaximized) setAmBounds(measureAmBounds()); setAmIsMaximized(!amIsMaximized); }}
              title={amIsMaximized ? 'Restore' : 'Maximize'}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {amIsMaximized ? <Minimize2 className="w-3.5 h-3.5 text-gray-400" /> : <Maximize2 className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            <button onClick={() => setShowAnalysisModal(false)} title="Close" className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 flex-shrink-0">
          {modalTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setAnalysisModalTab(t.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                analysisModalTab === t.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* ─── Summary Tab ─── */}
            {analysisModalTab === 'summary' && (
              <div className="space-y-5">
                {/* Neutral Summary */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Incident Summary</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{comparisonResult.neutralSummary}</p>
                </div>

                {/* Agreement Points */}
                {(comparisonResult.agreementPoints || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Agreement Points
                      <span className="ml-auto text-xs font-bold bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-300 px-2 py-0.5 rounded-full">{comparisonResult.agreementPoints.length}</span>
                    </h4>
                    <ul className="space-y-2">{comparisonResult.agreementPoints.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Contradictions */}
                {(comparisonResult.contradictions || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Contradictions
                      <span className="ml-auto text-xs font-bold bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full">{comparisonResult.contradictions.length}</span>
                    </h4>
                    <ul className="space-y-2">{comparisonResult.contradictions.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Missing Details */}
                {(comparisonResult.missingDetails || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Missing / Unclear Details
                      <span className="ml-auto text-xs font-bold bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full">{comparisonResult.missingDetails.length}</span>
                    </h4>
                    <ul className="space-y-2">{comparisonResult.missingDetails.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}
              </div>
            )}

            {/* ─── Compare Tab ─── */}
            {analysisModalTab === 'compare' && (
              <div className="space-y-4">
                {/* Party Names Header */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{comparisonResult.partyAName || 'Party A'}</span>
                  <span className="text-xs text-gray-400 font-medium">vs</span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{comparisonResult.partyBName || 'Party B'}</span>
                </div>

                {(comparisonResult.sideBySideComparison || []).map((item, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{item.topic}</h4>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                      <div className="p-4">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">{comparisonResult.partyAName || 'Party A'}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.partyAVersion}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">{comparisonResult.partyBName || 'Party B'}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.partyBVersion}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {(comparisonResult.sideBySideComparison || []).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No side-by-side comparison data available.</div>
                )}
              </div>
            )}

            {/* ─── Details Tab ─── */}
            {analysisModalTab === 'details' && (
              <div className="space-y-5">
                {/* Timeline Differences */}
                {(comparisonResult.timelineDifferences || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Timeline Differences</h4>
                    <ul className="space-y-2">{comparisonResult.timelineDifferences.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><Clock className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Emotional Language */}
                {(comparisonResult.emotionalLanguage || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800">
                    <h4 className="text-sm font-semibold text-pink-700 dark:text-pink-400 mb-3 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Emotional Language</h4>
                    <ul className="space-y-2">{comparisonResult.emotionalLanguage.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><MessageSquare className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Witness Analysis */}
                {(comparisonResult.witnessAnalysis || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800">
                    <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" /> Witness Analysis</h4>
                    <ul className="space-y-2">{(comparisonResult.witnessAnalysis || []).map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><Users className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Prior History Analysis */}
                {(comparisonResult.priorHistoryAnalysis || []).length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Prior History Analysis</h4>
                    <ul className="space-y-2">{(comparisonResult.priorHistoryAnalysis || []).map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40"><FileText className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />{p}</li>
                    ))}</ul>
                  </div>
                )}

                {/* Fallback if no details */}
                {!(comparisonResult.timelineDifferences || []).length && !(comparisonResult.emotionalLanguage || []).length && !(comparisonResult.witnessAnalysis || []).length && !(comparisonResult.priorHistoryAnalysis || []).length && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No additional detail data available for this analysis.</div>
                )}
              </div>
            )}
          </div>

          {/* Resize handle (bottom-right corner) */}
          {!amIsMaximized && (
            <div
              onMouseDown={onAmResizeStart}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              style={{ background: 'linear-gradient(135deg, transparent 50%, rgb(156 163 175) 50%)' }}
            />
          )}
        </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderAnalysisModal()}

      {!showReviewModal && !showDocPreview && (<>
      {/* ─── Analysis Status ─── */}
      {!canAnalyze && (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Upload both Complaint A and Complaint B documents to begin analysis.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      {/* ─── Start Analysis Button (when no results yet) ─── */}
      {canAnalyze && !comparisonResult && !comparisonAnalyzing && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to Analyze</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Both complaints are uploaded. Run the AI analysis to compare statements, match policies, and get recommendations.
          </p>
          <button
            onClick={handleRunComparison}
            disabled={step > 0}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 mx-auto"
          >
            {step > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run Analysis
          </button>
        </div>
      )}

      {/* ─── Comparison Analysis Loading Overlay ─── */}
      {comparisonAnalyzing && (
        <div ref={comparisonOverlayRef} className="relative rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ minHeight: 360 }}>
          <div className="absolute inset-0 z-20 flex items-center justify-center animate-processing-overlay-in">
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl" style={{ borderRadius: 'inherit' }} />
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-400/20 dark:bg-blue-500/15 rounded-full blur-3xl animate-blob" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-400/20 dark:bg-indigo-500/15 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-6 animate-processing-bounce-in">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full animate-processing-glow" />
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200/60 dark:text-gray-700/60" />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none" strokeWidth="6" strokeLinecap="round"
                    className="text-blue-500 dark:text-blue-400 animate-processing-arc"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 52}`,
                      strokeDashoffset: `${2 * Math.PI * 52 * (1 - ((comparisonAnalysisStep + 1) / COMPARISON_ANALYSIS_STEPS.length))}`,
                      stroke: 'url(#comparison-gradient)',
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <defs>
                    <linearGradient id="comparison-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl animate-processing-icon-pop" key={comparisonAnalysisStep}>
                    {COMPARISON_ANALYSIS_STEPS[comparisonAnalysisStep]?.icon}
                  </span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-100 animate-processing-text-in" key={`ca-label-${comparisonAnalysisStep}`}>
                  {COMPARISON_ANALYSIS_STEPS[comparisonAnalysisStep]?.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step {comparisonAnalysisStep + 1} of {COMPARISON_ANALYSIS_STEPS.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {COMPARISON_ANALYSIS_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < comparisonAnalysisStep
                        ? 'w-6 bg-blue-500 dark:bg-blue-400'
                        : i === comparisonAnalysisStep
                        ? 'w-8 bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse'
                        : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Analyzing complaints • Please wait
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Analysis Results Container ─── */}
      {comparisonResult && !comparisonAnalyzing && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">

      {/* ─── Complaint Comparison ─── */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Complaint Comparison
            </h3>
            <button
              onClick={() => { setShowAnalysisModal(true); setAnalysisModalTab('summary'); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" /> View Full Analysis
            </button>
          </div>

          {/* Compact summary */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4 line-clamp-3">{comparisonResult.neutralSummary}</p>

          {/* Stats badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {(comparisonResult.agreementPoints || []).length > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {comparisonResult.agreementPoints.length} Agreements
              </span>
            )}
            {(comparisonResult.contradictions || []).length > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> {comparisonResult.contradictions.length} Contradictions
              </span>
            )}
            {(comparisonResult.missingDetails || []).length > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {comparisonResult.missingDetails.length} Missing Details
              </span>
            )}
            {(comparisonResult.sideBySideComparison || []).length > 0 && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" /> {comparisonResult.sideBySideComparison.length} Topics Compared
              </span>
            )}
          </div>
        </div>

      {/* ─── Evidence Expansion ─── */}
        <hr className="border-black dark:border-gray-500 border-t-2" />
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Expand the Evidence</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Strengthen your case with additional context</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {/* ─── Witnesses Section ─── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedEvSection(expandedEvSection === 'witnesses' ? null : 'witnesses')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Were there any witnesses?</span>
                </div>
                <div className="flex items-center gap-2">
                  {witnessEmployees.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{witnessEmployees.length} added</span>
                  )}
                  {expandedEvSection === 'witnesses' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {expandedEvSection === 'witnesses' && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                  {witnessEmployees.length > 0 ? (
                    <>
                      {witnessEmployees.map((w) => {
                        const hasStatement = witnessDocs.some(d => d.employeeId === w.id);
                        return (
                          <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-400 flex-shrink-0">
                              {w.name?.charAt(0)?.toUpperCase() || 'W'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{w.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{w.role || 'No role specified'}</p>
                            </div>
                            {hasStatement ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Statement
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">No statement</span>
                            )}
                            {!caseData.isLocked && (
                              <button onClick={() => handleRemovePerson(w.id)} className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" title="Remove">
                                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-1">No witnesses added yet.</p>
                  )}
                  {!caseData.isLocked && (
                    <button
                      onClick={() => { setAddPersonIsComplainant(false); resetAddPersonForm(); setShowAddPersonModal(true); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/15 hover:bg-blue-100 dark:hover:bg-blue-900/25 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Witness
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ─── Prior History Section ─── */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedEvSection(expandedEvSection === 'history' ? null : 'history')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Any prior history?</span>
                </div>
                <div className="flex items-center gap-2">
                  {priorDocs.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{priorDocs.length} added</span>
                  )}
                  {expandedEvSection === 'history' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {expandedEvSection === 'history' && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                  {/* Yes/No quick selection — always visible when no prior docs exist */}
                  {priorDocs.length === 0 && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setHasPriorHistory(true)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border-2 ${
                          hasPriorHistory === true
                            ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-600'
                            : 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setHasPriorHistory(false)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border-2 ${
                          hasPriorHistory === false
                            ? 'bg-gray-600 text-white border-gray-600 dark:bg-gray-500 dark:border-gray-500'
                            : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {/* History type cards — shown when prior docs exist OR user chose Yes */}
                  {(priorDocs.length > 0 || hasPriorHistory === true) && (
                    <>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">What type of prior history?</p>
                      <div className="space-y-2">
                        {/* Prior Complaints */}
                        {(() => {
                          const count = priorDocs.filter(d => d.type?.toLowerCase() === 'prior_record').length;
                          return (
                            <button
                              onClick={() => openDocUpload('prior_record')}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/20 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Prior Complaints</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Previous complaints between these employees</p>
                              </div>
                              {count > 0 && (
                                <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{count}</span>
                              )}
                              <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </button>
                          );
                        })()}

                        {/* Counseling Records */}
                        {(() => {
                          const count = priorDocs.filter(d => d.type?.toLowerCase() === 'counseling_record').length;
                          return (
                            <button
                              onClick={() => openDocUpload('counseling_record')}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/20 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                <Users className="w-4.5 h-4.5 text-purple-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Counseling Records</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Previous counseling or HR discussions</p>
                              </div>
                              {count > 0 && (
                                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{count}</span>
                              )}
                              <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </button>
                          );
                        })()}

                        {/* Previous Warnings */}
                        {(() => {
                          const count = priorDocs.filter(d => d.type?.toLowerCase() === 'warning_document').length;
                          return (
                            <button
                              onClick={() => openDocUpload('warning_document')}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/20 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors text-left"
                            >
                              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4.5 h-4.5 text-amber-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Previous Warnings</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Written or verbal warnings issued</p>
                              </div>
                              {count > 0 && (
                                <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{count}</span>
                              )}
                              <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </button>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Re-Analyze Button */}
          {!caseData.isLocked && hasNewEvidence && (
            <button
              onClick={handleReAnalyze}
              disabled={step > 0}
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
            >
              {step === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Re-Analyze with New Evidence
            </button>
          )}
        </div>

      {/* ─── Add Person Modal ─── */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddPersonModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowAddPersonModal(false)} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Add Person</h4>
              <button
                onClick={handleAddPerson}
                disabled={addingPerson || !addPersonName.trim() || !addPersonEmployeeId.trim() || !addPersonRole.trim() || !addPersonDepartment.trim()}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600"
              >
                {addingPerson ? 'Adding...' : 'Add'}
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Users className="w-8 h-8 text-amber-500" />
                </div>
              </div>

              {/* Role Type Segmented Control */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Role Type</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setAddPersonIsComplainant(true)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${addPersonIsComplainant ? 'bg-amber-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Complainant
                  </button>
                  <button
                    onClick={() => setAddPersonIsComplainant(false)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!addPersonIsComplainant ? 'bg-gray-600 dark:bg-gray-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                  >
                    Witness
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">NAME <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addPersonName}
                    onChange={e => setAddPersonName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">EMPLOYEE ID / FILE NUMBER <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addPersonEmployeeId}
                    onChange={e => setAddPersonEmployeeId(e.target.value)}
                    placeholder="e.g., EMP-12345"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">ROLE/POSITION <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={addPersonRole}
                      onChange={e => setAddPersonRole(e.target.value)}
                      placeholder="e.g., Manager"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">DEPARTMENT <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={addPersonDepartment}
                      onChange={e => setAddPersonDepartment(e.target.value)}
                      placeholder="e.g., Bakery"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Run Policy Matching Button (when comparison done but no policy result yet) ─── */}
      {comparisonResult && !policyResult && !policyAnalyzing && !comparisonAnalyzing && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Match Policies</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Run policy matching to identify which company policies apply to this case based on the complaint analysis.
          </p>
          <button
            onClick={handleRunPolicyMatching}
            disabled={step > 0}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 mx-auto"
          >
            {step > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run Policy Matching
          </button>
        </div>
      )}

      {/* ─── Policy Analysis Loading Overlay ─── */}
      {policyAnalyzing && (
        <div ref={policyOverlayRef} className="relative rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ minHeight: 360 }}>
          <div className="absolute inset-0 z-20 flex items-center justify-center animate-processing-overlay-in">
            {/* Glassmorphism backdrop */}
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl" style={{ borderRadius: 'inherit' }} />

            {/* Floating ambient blobs */}
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-400/20 dark:bg-purple-500/15 rounded-full blur-3xl animate-blob" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-pink-400/20 dark:bg-pink-500/15 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
            </div>

            {/* Content card with bounce animation */}
            <div className="relative z-10 flex flex-col items-center gap-6 animate-processing-bounce-in">
              {/* Circular Progress Ring */}
              <div className="relative w-32 h-32">
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full animate-processing-glow" />

                {/* Background circle */}
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200/60 dark:text-gray-700/60" />
                  {/* Animated progress arc */}
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="text-purple-500 dark:text-purple-400 animate-processing-arc"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 52}`,
                      strokeDashoffset: `${2 * Math.PI * 52 * (1 - ((policyAnalysisStep + 1) / POLICY_ANALYSIS_STEPS.length))}`,
                      stroke: 'url(#policy-gradient)',
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <defs>
                    <linearGradient id="policy-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#9333ea" />
                      <stop offset="50%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl animate-processing-icon-pop" key={policyAnalysisStep}>
                    {POLICY_ANALYSIS_STEPS[policyAnalysisStep]?.icon}
                  </span>
                </div>
              </div>

              {/* Step label */}
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-100 animate-processing-text-in" key={`pa-label-${policyAnalysisStep}`}>
                  {POLICY_ANALYSIS_STEPS[policyAnalysisStep]?.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step {policyAnalysisStep + 1} of {POLICY_ANALYSIS_STEPS.length}
                </p>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {POLICY_ANALYSIS_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < policyAnalysisStep
                        ? 'w-6 bg-purple-500 dark:bg-purple-400'
                        : i === policyAnalysisStep
                        ? 'w-8 bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse'
                        : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Context info */}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Analyzing {policies.length} polic{policies.length === 1 ? 'y' : 'ies'} • Please wait
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Policy Alignment ─── */}
      {policyResult && !policyAnalyzing && !recommendationAnalyzing && (<>
        <hr className="border-black dark:border-gray-500 border-t-2" />
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Policy Alignment</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Identify relevant policy sections</p>
            </div>
            {policies.length > 0 && (
              <button
                onClick={() => { setPolicyReviewSelected(new Set()); setPolicyReviewSearch(''); setShowPolicyReviewModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Review Active Policy
              </button>
            )}
          </div>

          {/* Policy Match Cards */}
          <div className="space-y-3">
            {(policyResult.matches || []).map((m, i) => {
              const conf = m.matchConfidence;
              const confPercent = Math.round(conf * 100);
              const level = conf >= 0.8 ? 'high' : conf >= 0.65 ? 'moderate' : 'low';
              const levelLabel = level === 'high' ? 'High Relevance' : level === 'moderate' ? 'Moderate Relevance' : 'Low Relevance';
              const dotColor = level === 'high' ? 'bg-green-500' : level === 'moderate' ? 'bg-orange-500' : 'bg-gray-400';
              const badgeColor = level === 'high'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : level === 'moderate'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
              const confColor = level === 'high' ? 'text-green-600 dark:text-green-400' : level === 'moderate' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400';
              const isExpanded = expandedPolicyMatch === i;

              return (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden transition-colors"
                >
                  {/* Card Header — clickable */}
                  <button
                    onClick={() => setExpandedPolicyMatch(isExpanded ? null : i)}
                    className="w-full px-4 py-3.5 flex flex-col gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {/* Section number + relevance badge + delete */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {m.sectionNumber ? `Section ${m.sectionNumber}` : 'Policy Section'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeColor}`}>
                          {levelLabel}
                        </span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setPolicyDeleteTarget({ index: i, match: m }); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPolicyDeleteTarget({ index: i, match: m }); } }}
                          className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group/del"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover/del:text-red-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                    {/* Dot + Title + chevron */}
                    <div className="flex items-start gap-2 w-full">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0 mt-1`} />
                      <p className={`text-sm font-semibold text-gray-900 dark:text-white flex-1 ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {m.sectionTitle}
                      </p>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      {/* Relevance Explanation */}
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{m.relevanceExplanation}</p>

                      {/* Key Phrases */}
                      {(m.keyPhrases || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Key Phrases</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.keyPhrases.map((kp, j) => (
                              <span key={j} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">{kp}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Relevance Score */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Relevance Score</span>
                        <span className={`text-sm font-bold ${confColor}`}>{confPercent}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* No matches state */}
            {(policyResult.matches || []).length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No Direct Policy Matches</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use professional judgment based on the case details.</p>
              </div>
            )}
          </div>

          {/* Supervisor Guidance */}
          {policyResult.overallGuidance && (
            <div className="mt-4 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Supervisor Guidance</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{policyResult.overallGuidance}</p>
            </div>
          )}

          {/* Re-analyze button */}
          {!caseData.isLocked && comparisonResult && (
            <button
              onClick={() => { setPolicyResult(null); handleRunPolicyMatching(); }}
              disabled={step > 0}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-xl transition-colors disabled:opacity-50"
            >
              {step === 2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-analyze Policies
            </button>
          )}
        </div>

      {/* ─── Policy Section Delete Confirmation Modal ─── */}
      {policyDeleteTarget && typeof document !== 'undefined' && createPortal(
        (() => {
          const m = policyDeleteTarget.match;
          const conf = m.matchConfidence;
          const isLowRelevance = conf < 0.65;
          const isNotRelevant = conf < 0.5;
          const level = conf >= 0.8 ? 'high' : conf >= 0.65 ? 'moderate' : conf >= 0.5 ? 'low' : 'not_relevant';

          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Icon Header */}
                <div className={`px-6 pt-6 pb-4 flex flex-col items-center text-center ${isLowRelevance ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${isLowRelevance ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {isLowRelevance
                      ? <AlertTriangle className="w-7 h-7 text-orange-500" />
                      : <Trash2 className="w-7 h-7 text-red-500" />
                    }
                  </div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {isNotRelevant ? 'Remove Low-Relevance Section?' : isLowRelevance ? 'Remove This Section?' : 'Delete Policy Section?'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Section {m.sectionNumber || 'N/A'} — {Math.round(conf * 100)}% relevance
                  </p>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-3">
                  {/* Dynamic message based on relevance */}
                  {isNotRelevant ? (
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                          <span className="font-semibold">Good choice.</span> This section has low relevancy and is a better candidate for removal since it doesn&apos;t directly relate to the conflict at hand.
                        </p>
                      </div>
                    </div>
                  ) : isLowRelevance ? (
                    <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed">
                          This section has <span className="font-semibold">moderate-to-low relevance</span> to this case. It may still provide supporting context, but removing it is reasonable if it doesn&apos;t align with the core issues.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
                          <span className="font-semibold">Caution:</span> This section has <span className="font-semibold">{level === 'high' ? 'high' : 'moderate'} relevance</span> to this case and is likely important for the policy alignment analysis. Removing it could weaken the assessment.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Section preview */}
                  <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Section to remove:</p>
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{m.sectionTitle}</p>
                  </div>

                  {/* Permanent warning */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                    This action is <span className="font-semibold text-red-500">permanent</span> and cannot be undone. The section will be removed from the Policy Alignment analysis.
                  </p>
                </div>

                {/* Actions */}
                <div className="px-6 pb-5 flex items-center gap-3">
                  <button
                    onClick={() => setPolicyDeleteTarget(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (policyResult) {
                        const updated = (policyResult.matches || []).filter((_, idx) => idx !== policyDeleteTarget.index);
                        const updatedResult = { ...policyResult, matches: updated };
                        setPolicyResult(updatedResult);
                        if (expandedPolicyMatch === policyDeleteTarget.index) setExpandedPolicyMatch(null);
                        else if (expandedPolicyMatch !== null && expandedPolicyMatch > policyDeleteTarget.index) setExpandedPolicyMatch(expandedPolicyMatch - 1);
                        // Persist to database
                        updateCase(caseData.id, { policyMatchesJson: updatedResult, policyMatchingResultJson: updatedResult, userId })
                          .then(() => onUpdate())
                          .catch(err => console.error('[DeletePolicySection] updateCase error:', err));
                      }
                      setPolicyDeleteTarget(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Section
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      <hr className="border-black dark:border-gray-500 border-t-2" />

      {/* ─── Decision Support (Recommendations) ─── */}
      {recommendationResult && !comparisonAnalyzing && !policyAnalyzing && !recommendationAnalyzing && (() => {
        // Build per-employee groups (backward compat: fallback to flat list grouped by target)
        const employeeGroups: EmployeeRecommendationGroup[] =
          (recommendationResult.employeeRecommendations || []).length > 0
            ? recommendationResult.employeeRecommendations!
            : (() => {
                const grouped: Record<string, Recommendation[]> = {};
                (recommendationResult.recommendations || []).forEach(r => {
                  const key = r.targetEmployeeNames?.[0] || 'All Employees';
                  (grouped[key] = grouped[key] || []).push(r);
                });
                return Object.entries(grouped).map(([name, recs]) => ({
                  employeeName: name,
                  assessment: '',
                  recommendations: recs,
                  primaryRecommendation: recs[0]?.id || '',
                }));
              })();

        const getTypeColor = (type: string) => {
          switch (type) {
            case 'coaching': return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', ring: 'border-green-300 dark:border-green-700', solid: 'bg-green-600' };
            case 'counseling': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', ring: 'border-blue-300 dark:border-blue-700', solid: 'bg-blue-600' };
            case 'warning': return { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', ring: 'border-orange-300 dark:border-orange-700', solid: 'bg-orange-600' };
            case 'escalate': return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', ring: 'border-red-300 dark:border-red-700', solid: 'bg-red-600' };
            default: return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', ring: 'border-indigo-300 dark:border-indigo-700', solid: 'bg-indigo-600' };
          }
        };
        const getTypeLabel = (type: string) => {
          switch (type) {
            case 'coaching': return 'Coaching';
            case 'counseling': return 'Documented Counseling';
            case 'warning': return 'Written Warning';
            case 'escalate': return 'Escalate to HR';
            default: return type;
          }
        };

        let globalRecIdx = 0;

        return (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Decision Support</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">System-powered action recommendations</p>
              </div>
              {!caseData.isLocked && (
                <button
                  onClick={handleRunRecommendations}
                  disabled={step > 0}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 disabled:opacity-50 transition-all flex items-center gap-1.5 border border-orange-200 dark:border-orange-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Generate
                </button>
              )}
            </div>

            {/* Per-Employee Recommendation Groups */}
            <div className="space-y-5">
              {employeeGroups.map((group, groupIdx) => {
                const startIdx = globalRecIdx;
                return (
                  <div key={group.employeeName} className="space-y-2.5">
                    {/* Employee Header */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10">
                      <div className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-800/50 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{group.employeeName}</p>
                        {group.assessment && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{group.assessment}</p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {group.recommendations.length} option{group.recommendations.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Recommendation Cards */}
                    {group.recommendations.map((rec, recIdx) => {
                      const letter = String.fromCharCode(65 + recIdx);
                      const isSelected = selectedRecommendation === rec.id;
                      const isPrimary = rec.id === group.primaryRecommendation || rec.id === recommendationResult.primaryRecommendation;
                      const isExpanded = expandedRec === rec.id;
                      const conf = Math.round(rec.confidence * 100);
                      const tc = getTypeColor(rec.type);

                      return (
                        <div
                          key={rec.id}
                          className={`rounded-xl border-2 transition-all overflow-hidden ${
                            isSelected
                              ? `${tc.ring} bg-opacity-50 shadow-lg`
                              : isPrimary
                              ? 'border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/20 dark:bg-indigo-900/5'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="p-3.5 cursor-pointer" onClick={() => setExpandedRec(isExpanded ? null : rec.id)}>
                            <div className="flex items-center gap-3">
                              {/* Letter Badge (type-colored) */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${tc.bg} ${tc.text}`}>
                                {letter}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{rec.title}</h4>
                                  {isPrimary && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white">Recommended</span>
                                  )}
                                  {isSelected && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Selected</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{getTypeLabel(rec.type)}</p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRiskBgColor(rec.riskLevel)} ${getRiskColor(rec.riskLevel)}`}>
                                  {rec.riskLevel === 'low' ? 'Low Risk' : rec.riskLevel === 'moderate' ? 'Moderate Risk' : rec.riskLevel === 'high' ? 'High Risk' : 'Critical Risk'}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                              {/* Description */}
                              <p className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>

                              {/* Why This Option? */}
                              <div>
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">Why This Option?</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{rec.rationale}</p>
                              </div>

                              {/* Risk Explanation Box */}
                              {rec.riskExplanation && (
                                <div className={`p-3 rounded-lg flex items-start gap-2 ${getRiskBgColor(rec.riskLevel)}`}>
                                  <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getRiskColor(rec.riskLevel)}`} />
                                  <p className="text-xs text-gray-700 dark:text-gray-300">{rec.riskExplanation}</p>
                                </div>
                              )}

                              {/* Next Steps */}
                              {(rec.nextSteps || []).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">Next Steps</p>
                                  <div className="space-y-1.5">
                                    {rec.nextSteps.map((s, si) => (
                                      <div key={si} className="flex items-start gap-2">
                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 w-4 flex-shrink-0 mt-0.5">{si + 1}.</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{s}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Timeframe & Confidence */}
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                {rec.timeframe && (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {rec.timeframe}</span>
                                )}
                                <span className={`font-medium ${tc.text}`}>{conf > 80 ? 'High' : conf > 50 ? 'Moderate' : 'Low'} Confidence</span>
                              </div>

                              {/* Select Button */}
                              {!caseData.isLocked && !isSelected && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectRecommendation(rec); }}
                                  className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white ${tc.solid} hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg`}
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Select This Option
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Supervisor Guidance (inside Decision Support card) */}
            {recommendationResult.supervisorGuidance && (
              <div className="mt-5 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Supervisor Guidance</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{recommendationResult.supervisorGuidance}</p>
              </div>
            )}

            {/* Action Generation Card */}
            {(() => {
              // Find the selected recommendation for display
              const selectedRec = selectedRecommendation
                ? employeeGroups.flatMap(g => g.recommendations).find(r => r.id === selectedRecommendation)
                : null;
              const targetName = selectedRec?.targetEmployeeNames?.[0] || '';

              if (docGenerating) return (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Generating Document...</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">This may take a moment. Please wait.</p>
                    </div>
                  </div>
                </div>
              );

              if (generatedDoc && selectedRec) return (
                <div className="mt-5 rounded-xl bg-orange-50/50 dark:bg-orange-900/5 border border-orange-200 dark:border-orange-800/50 p-5 space-y-4">
                  {/* Action Generation Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Action Generation</p>
                      {targetName && <p className="text-xs text-orange-600 dark:text-orange-400">for {targetName}</p>}
                    </div>
                  </div>

                  {/* Selected Action */}
                  <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Selected Action</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedRec.title}</p>
                      </div>
                      {!caseData.isLocked && (
                        <button
                          onClick={() => { setSelectedRecommendation(null); setGeneratedDoc(null); setDocPhase('none'); setDocEdits([]); }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );

              // Default: no document yet
              return null;
            })()}
          </div>
        );
      })()}

      </>)}

      {/* ─── Run Recommendations Button (when policy done but no recommendations yet) ─── */}
      {policyResult && !recommendationResult && !recommendationAnalyzing && !policyAnalyzing && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Get Recommendations</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Generate AI-powered recommendations for corrective actions based on the complaint analysis and matched policies.
          </p>
          <button
            onClick={handleRunRecommendations}
            disabled={step > 0}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 mx-auto"
          >
            {step > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Get Recommendations
          </button>
        </div>
      )}

      {/* ─── Decision Support Loading Overlay ─── */}
      {recommendationAnalyzing && (
        <div ref={recommendationOverlayRef} className="relative rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ minHeight: 360 }}>
          <div className="absolute inset-0 z-20 flex items-center justify-center animate-processing-overlay-in">
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl" style={{ borderRadius: 'inherit' }} />
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-400/20 dark:bg-emerald-500/15 rounded-full blur-3xl animate-blob" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-teal-400/20 dark:bg-teal-500/15 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-6 animate-processing-bounce-in">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full animate-processing-glow" />
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200/60 dark:text-gray-700/60" />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none" strokeWidth="6" strokeLinecap="round"
                    className="text-emerald-500 dark:text-emerald-400 animate-processing-arc"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 52}`,
                      strokeDashoffset: `${2 * Math.PI * 52 * (1 - ((recommendationAnalysisStep + 1) / RECOMMENDATION_ANALYSIS_STEPS.length))}`,
                      stroke: 'url(#recommendation-gradient)',
                      transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  <defs>
                    <linearGradient id="recommendation-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl animate-processing-icon-pop" key={recommendationAnalysisStep}>
                    {RECOMMENDATION_ANALYSIS_STEPS[recommendationAnalysisStep]?.icon}
                  </span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-100 animate-processing-text-in" key={`rec-label-${recommendationAnalysisStep}`}>
                  {RECOMMENDATION_ANALYSIS_STEPS[recommendationAnalysisStep]?.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step {recommendationAnalysisStep + 1} of {RECOMMENDATION_ANALYSIS_STEPS.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {RECOMMENDATION_ANALYSIS_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < recommendationAnalysisStep
                        ? 'w-6 bg-emerald-500 dark:bg-emerald-400'
                        : i === recommendationAnalysisStep
                        ? 'w-8 bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse'
                        : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Generating recommendations • Please wait
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirmation Modal ─── */}
      {confirmRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-processing-bounce-in">
            {/* Icon */}
            <div className="flex justify-between items-start mb-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                confirmRec.type === 'coaching' ? 'bg-green-100 dark:bg-green-900/30' :
                confirmRec.type === 'counseling' ? 'bg-blue-100 dark:bg-blue-900/30' :
                confirmRec.type === 'warning' ? 'bg-orange-100 dark:bg-orange-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                <AlertTriangle className={`w-7 h-7 ${
                  confirmRec.type === 'coaching' ? 'text-green-600' :
                  confirmRec.type === 'counseling' ? 'text-blue-600' :
                  confirmRec.type === 'warning' ? 'text-orange-600' :
                  'text-red-600'
                }`} />
              </div>
              <button onClick={() => setConfirmRec(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Confirm Selection</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">You selected: {confirmRec.title}</p>

            {/* Summary Card */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 mb-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Action Type</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {confirmRec.type === 'coaching' ? 'Coaching' : confirmRec.type === 'counseling' ? 'Documented Counseling' : confirmRec.type === 'warning' ? 'Written Warning' : 'Escalate to HR'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Risk Level</span>
                <span className={`font-semibold capitalize ${getRiskColor(confirmRec.riskLevel)}`}>{confirmRec.riskLevel} Risk</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Timeframe</span>
                <span className="font-semibold text-gray-900 dark:text-white">{confirmRec.timeframe || 'N/A'}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">This will proceed to the next step where you can review and edit the generated document.</p>

            {/* Action Buttons */}
            <button
              onClick={handleConfirmSelection}
              className={`w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                confirmRec.type === 'coaching' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/25' :
                confirmRec.type === 'counseling' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25' :
                confirmRec.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25' :
                'bg-red-600 hover:bg-red-700 shadow-red-600/25'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm &amp; Continue
            </button>
            <button
              onClick={() => setConfirmRec(null)}
              className="w-full py-2.5 mt-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* ─── Generated Document Card (inline) ─── */}
      {generatedDoc && !showReviewModal && !docGenerating && !comparisonAnalyzing && !policyAnalyzing && !recommendationAnalyzing && (() => {
        const actionTypeLabels: Record<string, string> = { coaching: 'Coaching Guide', counseling: 'Counseling Document', warning: 'Written Warning', escalate: 'Escalation Package' };
        const actionTypeColors: Record<string, { bg: string; text: string; icon: string }> = {
          coaching: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: 'text-green-600' },
          counseling: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-600' },
          warning: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: 'text-orange-600' },
          escalate: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: 'text-red-600' },
        };
        const tc = actionTypeColors[generatedDoc.actionType] || actionTypeColors.coaching;
        const sections = getDocSections(generatedDoc);

        return (
          <>
          <hr className="border-black dark:border-gray-500 border-t-2" />
          <div className="p-6">
            {/* Title Row */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${tc.bg} flex items-center justify-center flex-shrink-0`}>
                <AlertTriangle className={`w-5 h-5 ${tc.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{getDocTitle(generatedDoc) || actionTypeLabels[generatedDoc.actionType]}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Generated {formatDateTime(getDocDate(generatedDoc))}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${tc.bg} ${tc.text}`}>
                {actionTypeLabels[generatedDoc.actionType]}
              </span>
            </div>

            {/* Info row */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {caseData.caseNumber}</span>
              <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> {sections.length} sections</span>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Document Generated</p>
                <p className="text-xs text-green-600 dark:text-green-400">Tap below to review and edit sections</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setSelectedRecommendation(null); setGeneratedDoc(null); setDocPhase('none'); setDocEdits([]); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all flex items-center gap-1.5 border border-blue-200 dark:border-blue-800"
              >
                <Clock className="w-3.5 h-3.5" /> Decide Later
              </button>
              <button
                onClick={handleDeleteDocument}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all flex items-center gap-1.5 border border-red-200 dark:border-red-800"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={handleOpenReviewModal}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-1.5 shadow-lg shadow-green-600/25"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Continue to Review
              </button>
            </div>
          </div>
          </>
        );
      })()}
      </div>
      )}
      </>)}

      {/* ─── Document Generation Modal (iOS-style full-screen, portalled to body) ─── */}
      {docGenerating && typeof document !== 'undefined' && createPortal(
        (() => {
          const actionTypeLabelsGen: Record<string, string> = { coaching: 'coaching guide', counseling: 'documented counseling document', warning: 'written warning', escalate: 'escalation package' };
          const genTitle = generatingRec?.title || 'Action Document';
          const genTypeLabel = actionTypeLabelsGen[generatingRec?.type || ''] || 'document';
          return (
            <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-100 dark:bg-gray-900" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
              {/* Top Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {}}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400"
                >
                  Back
                </button>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Generated Document</h2>
                <div className="w-10" />
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {/* Document Info Card */}
                <div className="w-full max-w-md mb-8">
                  <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{genTitle}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Case {caseData.caseNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Progress Area */}
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center">
                  {/* Circular Progress */}
                  <div className="relative w-20 h-20 mb-5">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-gray-700" />
                      <circle
                        cx="40" cy="40" r="34"
                        fill="none" strokeWidth="4" strokeLinecap="round"
                        className="text-blue-500"
                        style={{
                          strokeDasharray: `${2 * Math.PI * 34}`,
                          strokeDashoffset: `${2 * Math.PI * 34 * (1 - ((docGenStep + 1) / DOC_GEN_STEPS.length))}`,
                          transition: 'stroke-dashoffset 1s ease-out',
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-blue-500" />
                    </div>
                  </div>

                  <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">Generating Document...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">Our System is creating your {genTypeLabel}</p>

                  {/* Step Checklist */}
                  <div className="space-y-3 w-full">
                    {DOC_GEN_STEPS.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {i < docGenStep ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : i === docGenStep ? (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${i < docGenStep ? 'text-gray-800 dark:text-gray-200 font-medium' : i === docGenStep ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* ─── Review Document (full content area view, matches iOS SupervisorReviewView) ─── */}
      {showReviewModal && !showDocPreview && generatedDoc && (() => {
        const actionTypeLabels: Record<string, string> = { coaching: 'Coaching Guide', counseling: 'Counseling Document', warning: 'Written Warning', escalate: 'Escalation Package' };
        const actionTypeColors: Record<string, { bg: string; text: string; border: string }> = {
          coaching: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
          counseling: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
          warning: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
          escalate: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
        };
        const tc = actionTypeColors[generatedDoc.actionType] || actionTypeColors.coaching;
        const sections = getDocSections(generatedDoc);
        const openComments = reviewComments.filter(c => !c.isResolved);

        return (
          <div className="space-y-4">
            {/* ── Top Bar ── */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <button onClick={() => { setShowReviewModal(false); setEditingSectionId(null); setCommentSectionId(null); }} className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Review Document</h2>
              <button onClick={handleRegenerateDocument} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Regenerate">
                <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* ── Scrollable Content ── */}
              <div className="space-y-4">

                {/* Combined Status + Document Info + Quick Actions Card */}
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                  {/* Status Row */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">In Review</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last updated: {formatDateTime(getDocDate(generatedDoc))}</p>
                    </div>
                    {docEdits.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">{docEdits.length} edit{docEdits.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-700" />

                  {/* Document Info Row */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg ${tc.bg} flex items-center justify-center flex-shrink-0`}>
                        <AlertTriangle className={`w-5 h-5 ${tc.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{getDocTitle(generatedDoc) || actionTypeLabels[generatedDoc.actionType]}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Generated {formatDateTime(getDocDate(generatedDoc))}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${tc.bg} ${tc.text}`}>{actionTypeLabels[generatedDoc.actionType]}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {caseData.caseNumber}</span>
                      <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> {sections.length} sections</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-700" />

                  {/* Quick Actions Row */}
                  <div className="flex items-center justify-around">
                    <button
                      onClick={() => {
                        const first = sections.find(s => s.editable);
                        if (first) { setEditingSectionId(first.id); setEditingSectionContent(docEdits.find(e => e.sectionId === first.id)?.newContent || first.content); }
                      }}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Edit All</span>
                    </button>
                    <button
                      onClick={() => setCommentSectionId(commentSectionId ? null : 'general')}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors relative"
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Comment</span>
                      {openComments.length > 0 && (
                        <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">{openComments.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setShowDocPreview(true)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Preview</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-50 cursor-not-allowed">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">History</span>
                    </button>
                  </div>
                </div>

                {/* 4. Document Sections */}
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Document Sections</h4>
                  <div className="space-y-3">
                    {sections.map(section => {
                      const isEditing = editingSectionId === section.id;
                      const editedVersion = docEdits.find(e => e.sectionId === section.id);
                      const displayContent = editedVersion ? editedVersion.newContent : section.content;
                      const sectionComments = reviewComments.filter(c => c.section === section.id && !c.isResolved);

                      return (
                        <div key={section.id} className={`rounded-xl border p-4 transition-all ${editedVersion ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/5' : 'border-gray-200 dark:border-gray-700'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-semibold ${section.editable ? tc.text : 'text-gray-900 dark:text-white'}`}>{section.title}</h5>
                              {editedVersion && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">Modified</span>}
                              {sectionComments.length > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                            </div>
                            {section.editable && !isEditing && (
                              <button
                                onClick={() => { setEditingSectionId(section.id); setEditingSectionContent(displayContent); }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                title={`Edit ${section.title}`}
                              >
                                <Pencil className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingSectionContent}
                                onChange={e => setEditingSectionContent(e.target.value)}
                                rows={8}
                                placeholder="Edit section content..."
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-y"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => { setEditingSectionId(null); setEditingSectionContent(''); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveSection(section.id, section.title, section.content, editingSectionContent)}
                                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] text-gray-600 dark:text-gray-400 whitespace-pre-line line-clamp-4 leading-relaxed">{displayContent}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Review Comments Section */}
                {reviewComments.length > 0 && (
                  <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Review Comments</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">{openComments.length} open</span>
                    </div>
                    <div className="space-y-3">
                      {reviewComments.map(comment => (
                        <div key={comment.id} className={`rounded-xl border p-3 ${comment.isResolved ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/5' : 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/5'}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${comment.isResolved ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                              <MessageSquare className={`w-4 h-4 ${comment.isResolved ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">{sections.find(s => s.id === comment.section)?.title || comment.section}</span>
                                <span className="text-[10px] text-gray-400">{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{comment.comment}</p>
                              {!comment.isResolved && (
                                <button onClick={() => handleResolveComment(comment.id)} className="mt-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">Mark Resolved</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Add Comment Inline */}
                {commentSectionId && (
                  <div className="rounded-2xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 p-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Add Comment</h4>
                    <select
                      value={commentSectionId}
                      onChange={e => setCommentSectionId(e.target.value)}
                      title="Select section to comment on"
                      className="w-full mb-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="general">General</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      rows={3}
                      placeholder="Write a comment..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end mt-2">
                      <button onClick={() => { setCommentSectionId(null); setCommentText(''); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                      <button
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || addingComment}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {addingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Add Comment
                      </button>
                    </div>
                  </div>
                )}

              </div>

            {/* ── Action Buttons ── */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <button
                onClick={() => { setShowReviewModal(false); setDocPhase('approval'); }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
              >
                <ShieldCheck className="w-4 h-4" /> Approve Document
              </button>
              {openComments.length > 0 && (
                <button className="w-full py-2.5 rounded-xl text-sm font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-all flex items-center justify-center gap-2 border border-orange-200 dark:border-orange-800">
                  <AlertCircle className="w-4 h-4" /> Request Changes ({openComments.length})
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Document Preview Modal ─── */}
      {showDocPreview && generatedDoc && (() => {
        const d = getDocData(generatedDoc);
        const at = (generatedDoc.actionType || '').toLowerCase();
        const docTitle = getDocTitle(generatedDoc);
        const docDate = getDocDate(generatedDoc);
        const sections = getDocSections(generatedDoc);
        const targetEmployee = employees.find(e => e.name && d.employeeNames?.some((n: string) => n.toLowerCase().includes(e.name.toLowerCase()))) || (d.employeeNames?.length ? null : employees[0]);
        const incidentDate = caseData.incidentDate ? new Date(caseData.incidentDate) : new Date();
        const todayDate = new Date(docDate);
        const dayOfWeek = (dt: Date) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];

        const fmt = (v: any): string => {
          if (!v) return '';
          if (typeof v === 'string') return v;
          if (Array.isArray(v)) return v.map(item => typeof item === 'object' ? (item.area ? `${item.area}: ${item.description || ''}` : item.section ? `${item.section}: ${item.relevance || ''}` : JSON.stringify(item)) : String(item)).join('\n');
          if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${typeof val === 'object' ? JSON.stringify(val) : val}`).join('\n');
          return String(v);
        };

        // Theme colors per type
        const themes: Record<string, { accent: string; bg: string; title: string; subtitle: string }> = {
          warning: { accent: '#ea580c', bg: '#fff7ed', title: 'WARNING NOTICE / AVISO DISCIPLINARIO', subtitle: '' },
          counseling: { accent: '#2563eb', bg: '#eff6ff', title: 'DOCUMENTED COUNSELING', subtitle: 'CONSEJERÍA DOCUMENTADA' },
          coaching: { accent: '#16a34a', bg: '#f0fdf4', title: 'COACHING SESSION GUIDE', subtitle: 'GUÍA DE SESIÓN DE COACHING' },
          escalate: { accent: '#dc2626', bg: '#fef2f2', title: 'HR ESCALATION REQUEST', subtitle: 'SOLICITUD DE ESCALACIÓN A RRHH' },
        };
        const theme = themes[at] || themes.warning;

        return (
          <div className="space-y-4">
            {/* Hidden file input for logo upload */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {/* Top Bar */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <button onClick={() => setShowDocPreview(false)} className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Document Preview</h2>
              <button
                onClick={() => downloadDocx({
                  actionType: at,
                  documentData: d,
                  sections,
                  docEdits,
                  employee: targetEmployee || null,
                  caseNumber: caseData.caseNumber,
                  department: caseData.department || '',
                  location: caseData.location || '',
                  incidentDate,
                  todayDate,
                  companyLogoUrl,
                })}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Download Word Document"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
            </div>

            {/* Document Body */}
            <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 md:p-8">
              <div className="max-w-3xl mx-auto bg-white shadow-lg border border-gray-300" style={{ fontFamily: "'Times New Roman', Times, serif" }}>

                {/* ── Warning Notice Template ── */}
                {at === 'warning' && (
                  <div className="text-gray-900">
                    {/* Company Logo Area */}
                    <div className="flex items-center justify-center py-6 border-b border-gray-400">
                      {companyLogoUrl ? (
                        <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                          <img src={companyLogoUrl} alt="Company Logo" className="h-20 max-w-[200px] object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : (
                            <span className="text-[10px] text-gray-400 text-center leading-tight">Click to Add<br/>Company Logo</span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Title */}
                    <div className="text-center py-4 border-b border-gray-400 px-6">
                      <h1 className="text-xl font-bold tracking-wide">{theme.title}</h1>
                    </div>

                    {/* Intention Statement */}
                    <div className="px-6 py-3 border-b border-gray-400 text-xs leading-relaxed">
                      <p>The intention of this action is to enable the employee to understand what is expected. Therefore, it is meant to be a pro-active step to clarify a situation and avoid further occurrences.</p>
                      <p className="italic text-gray-600 mt-1">La intención de esta acción es hacerle entender al empleado lo que se espera de él/ella. Esta acción es un paso pro-activo para clarificar situaciones y evitar ocurrencias futuras.</p>
                    </div>

                    {/* Date Line */}
                    <div className="px-6 py-3 border-b border-gray-400 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <span><strong>Today&apos;s Date:</strong> <span className="underline">{todayDate.toLocaleDateString('en-US')}</span></span>
                      <span><strong>Day of the Week:</strong> <span className="underline">{dayOfWeek(todayDate)}</span></span>
                      <span><strong>Date of the Incident:</strong> <span className="underline">{incidentDate.toLocaleDateString('en-US')}</span></span>
                    </div>

                    {/* Warning Type Checkboxes */}
                    <div className="px-6 py-3 border-b border-gray-400 flex flex-wrap gap-4 text-xs">
                      {['Verbal', 'Written', 'Suspension', 'Termination', 'Other'].map(typ => (
                        <label key={typ} className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 border border-gray-500 flex items-center justify-center text-[10px] font-bold ${(d.warningLevel || '').toLowerCase().includes(typ.toLowerCase()) ? 'bg-gray-900 text-white' : ''}`}>
                            {(d.warningLevel || '').toLowerCase().includes(typ.toLowerCase()) ? 'X' : ''}
                          </span>
                          <span>{typ}</span>
                        </label>
                      ))}
                    </div>

                    {/* Employee Info Table */}
                    <div className="border-b border-gray-400">
                      <div className="grid grid-cols-2 border-b border-gray-300">
                        <div className="px-4 py-2 border-r border-gray-300 text-xs">
                          <span className="text-gray-500">Name:</span><br/>
                          <span className="font-semibold">{d.employeeNames?.join(', ') || targetEmployee?.name || '—'}</span>
                        </div>
                        <div className="px-4 py-2 text-xs">
                          <span className="text-gray-500">Prior Warnings:</span><br/>
                          <span>{d.priorActions || 'None documented'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3">
                        <div className="px-4 py-2 border-r border-gray-300 text-xs">
                          <span className="text-gray-500">Title:</span><br/>
                          <span className="font-semibold">{targetEmployee?.role || 'N/A'}</span>
                        </div>
                        <div className="px-4 py-2 border-r border-gray-300 text-xs">
                          <span className="text-gray-500">Department:</span><br/>
                          <span className="font-semibold">{targetEmployee?.department || caseData.department || 'N/A'}</span>
                        </div>
                        <div className="px-4 py-2 text-xs">
                          <span className="text-gray-500">File No.</span><br/>
                          <span className="font-semibold">{targetEmployee?.employeeFileNo || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Document Sections */}
                    {/* Company Rules Violated */}
                    {(d.companyRulesViolated || d.policyViolations) && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>📋</span>
                          <h3 className="text-sm font-bold">Company rules violated</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{fmt(d.companyRulesViolated || d.policyViolations)}</div>
                      </div>
                    )}

                    {/* Describe in Detail */}
                    {(d.describeInDetail || d.incidentDescription) && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>📝</span>
                          <h3 className="text-sm font-bold">Describe in detail what happened</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{d.describeInDetail || d.incidentDescription}</div>
                      </div>
                    )}

                    {/* Conduct Deficiency */}
                    {d.conductDeficiency && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>⚠️</span>
                          <h3 className="text-sm font-bold">Conduct Deficiency:</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{d.conductDeficiency}</div>
                      </div>
                    )}

                    {/* Required Corrective Action */}
                    {(d.requiredCorrectiveAction || d.improvementRequired) && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: '#16a34a' }}>🟢</span>
                          <h3 className="text-sm font-bold">Required Corrective Action:</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{fmt(d.requiredCorrectiveAction || d.improvementRequired)}</div>
                      </div>
                    )}

                    {/* Consequences */}
                    {(d.consequencesOfNotPerforming || d.consequences) && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: '#dc2626' }}>🔴</span>
                          <h3 className="text-sm font-bold">Consequences of not performing:</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{d.consequencesOfNotPerforming || d.consequences}</div>
                      </div>
                    )}

                    {/* Signature Section */}
                    <div className="px-6 py-4 border-b border-gray-400">
                      <div className="grid grid-cols-4 gap-0">
                        {['Supervisor', 'Date', 'Manager', 'Date'].map((lbl, i) => (
                          <div key={`sig1-${i}`} className={`py-4 text-center ${i < 3 ? 'border-r border-gray-300' : ''}`}>
                            <div className="border-b border-gray-400 mx-3 mb-1 h-8" />
                            <span className="text-[10px] text-gray-500">{lbl}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-0 border-t border-gray-300">
                        {['H.R. Department', 'Date', 'Employee Signature', 'Date'].map((lbl, i) => (
                          <div key={`sig2-${i}`} className={`py-4 text-center ${i < 3 ? 'border-r border-gray-300' : ''}`}>
                            <div className="border-b border-gray-400 mx-3 mb-1 h-8" />
                            <span className="text-[10px] text-gray-500">{lbl}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Certification Statement */}
                    <div className="px-6 py-4">
                      <p className="text-xs font-bold leading-relaxed">I, the undersigned, hereby certify that the situation has been explained to me. I understand the consequences if the infraction is not remedied. I certify that I have received a copy of this notice.</p>
                      <p className="text-xs italic text-gray-600 mt-2 leading-relaxed">Yo doy a conocer que se me ha explicado la situación presente. Yo entiendo las consecuencias futuras si no cumplo con las reglas. Yo certifico que he recibido una copia de este documento siempre y cuando la firme.</p>
                    </div>
                  </div>
                )}

                {/* ── Counseling Template ── */}
                {at === 'counseling' && (
                  <div className="text-gray-900">
                    {/* Company Logo */}
                    <div className="flex items-center justify-center py-6 border-b border-gray-400">
                      {companyLogoUrl ? (
                        <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                          <img src={companyLogoUrl} alt="Company Logo" className="h-20 max-w-[200px] object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : (
                            <span className="text-[10px] text-gray-400 text-center leading-tight">Click to Add<br/>Company Logo</span>
                          )}
                        </button>
                      )}
                    </div>
                    {/* Title */}
                    <div className="text-center py-4 border-b border-gray-400 px-6" style={{ backgroundColor: theme.bg }}>
                      <h1 className="text-xl font-bold tracking-wide" style={{ color: theme.accent }}>{theme.title}</h1>
                      {theme.subtitle && <p className="text-sm italic text-gray-500 mt-0.5">{theme.subtitle}</p>}
                    </div>
                    {/* Info Statement */}
                    <div className="px-6 py-3 border-b border-gray-400 text-xs leading-relaxed">
                      <p>This document serves as a formal record of a counseling discussion regarding workplace conduct, performance, or policy compliance.</p>
                    </div>
                    {/* Date / Case Info */}
                    <div className="px-6 py-3 border-b border-gray-400 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <span><strong>Date:</strong> <span className="underline">{todayDate.toLocaleDateString('en-US')}</span></span>
                      <span><strong>Case:</strong> <span className="underline">{caseData.caseNumber}</span></span>
                      <span><strong>Incident Date:</strong> <span className="underline">{incidentDate.toLocaleDateString('en-US')}</span></span>
                    </div>
                    {/* Employee Info */}
                    <div className="border-b border-gray-400">
                      <div className="grid grid-cols-2 border-b border-gray-300">
                        <div className="px-4 py-2 border-r border-gray-300 text-xs"><span className="text-gray-500">Name:</span><br/><span className="font-semibold">{d.employeeNames?.join(', ') || targetEmployee?.name || '—'}</span></div>
                        <div className="px-4 py-2 text-xs"><span className="text-gray-500">Employee ID:</span><br/><span className="font-semibold">{targetEmployee?.employeeFileNo || 'N/A'}</span></div>
                      </div>
                      <div className="grid grid-cols-2">
                        <div className="px-4 py-2 border-r border-gray-300 text-xs"><span className="text-gray-500">Position:</span><br/><span className="font-semibold">{targetEmployee?.role || 'N/A'}</span></div>
                        <div className="px-4 py-2 text-xs"><span className="text-gray-500">Department:</span><br/><span className="font-semibold">{targetEmployee?.department || caseData.department || 'N/A'}</span></div>
                      </div>
                    </div>
                    {/* Sections */}
                    {sections.map(section => (
                      <div key={section.id} className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>•</span>
                          <h3 className="text-sm font-bold">{section.title}</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{docEdits.find(e => e.sectionId === section.id)?.newContent || section.content}</div>
                      </div>
                    ))}
                    {/* Acknowledgment */}
                    <div className="px-6 py-4 border-b border-gray-400">
                      <p className="text-xs font-bold leading-relaxed">Employee Acknowledgment: I acknowledge that I have received and reviewed this documented counseling. My signature indicates that I understand the expectations described above.</p>
                    </div>
                    {/* Signatures */}
                    <div className="px-6 py-4">
                      {['Employee', 'Supervisor', 'Manager'].map(role => (
                        <div key={role} className="grid grid-cols-2 gap-4 mb-4">
                          <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">{role}</span></div>
                          <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">Date</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Coaching Template ── */}
                {at === 'coaching' && (
                  <div className="text-gray-900">
                    {/* Company Logo */}
                    <div className="flex items-center justify-center py-6 border-b border-gray-400">
                      {companyLogoUrl ? (
                        <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                          <img src={companyLogoUrl} alt="Company Logo" className="h-20 max-w-[200px] object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : (
                            <span className="text-[10px] text-gray-400 text-center leading-tight">Click to Add<br/>Company Logo</span>
                          )}
                        </button>
                      )}
                    </div>
                    {/* Title */}
                    <div className="text-center py-4 border-b border-gray-400 px-6" style={{ backgroundColor: theme.bg }}>
                      <h1 className="text-xl font-bold tracking-wide" style={{ color: theme.accent }}>{theme.title}</h1>
                      {theme.subtitle && <p className="text-sm italic text-gray-500 mt-0.5">{theme.subtitle}</p>}
                    </div>
                    {/* Info Statement */}
                    <div className="px-6 py-3 border-b border-gray-400 text-xs leading-relaxed">
                      <p>This coaching session guide is designed to support a constructive conversation focused on growth, development, and maintaining positive workplace standards.</p>
                    </div>
                    {/* Date / Case / Employee Info */}
                    <div className="px-6 py-3 border-b border-gray-400 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <span><strong>Date:</strong> <span className="underline">{todayDate.toLocaleDateString('en-US')}</span></span>
                      <span><strong>Case:</strong> <span className="underline">{caseData.caseNumber}</span></span>
                    </div>
                    {/* Employee Info */}
                    <div className="border-b border-gray-400 grid grid-cols-4">
                      <div className="px-4 py-2 border-r border-gray-300 text-xs"><span className="text-gray-500">Name:</span><br/><span className="font-semibold">{d.employeeNames?.join(', ') || targetEmployee?.name || '—'}</span></div>
                      <div className="px-4 py-2 border-r border-gray-300 text-xs"><span className="text-gray-500">File No:</span><br/><span className="font-semibold">{targetEmployee?.employeeFileNo || 'N/A'}</span></div>
                      <div className="px-4 py-2 border-r border-gray-300 text-xs"><span className="text-gray-500">Position:</span><br/><span className="font-semibold">{targetEmployee?.role || 'N/A'}</span></div>
                      <div className="px-4 py-2 text-xs"><span className="text-gray-500">Department:</span><br/><span className="font-semibold">{targetEmployee?.department || caseData.department || 'N/A'}</span></div>
                    </div>
                    {/* Sections */}
                    {sections.map(section => (
                      <div key={section.id} className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>•</span>
                          <h3 className="text-sm font-bold">{section.title}</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{docEdits.find(e => e.sectionId === section.id)?.newContent || section.content}</div>
                      </div>
                    ))}
                    {/* Session Notes */}
                    <div className="px-6 py-4 border-b border-gray-400">
                      <h3 className="text-sm font-bold mb-2">Session Notes:</h3>
                      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="border-b border-gray-300 h-6" />)}</div>
                    </div>
                    {/* Signatures */}
                    <div className="px-6 py-4">
                      {['Supervisor', 'Employee'].map(role => (
                        <div key={role} className="grid grid-cols-2 gap-4 mb-4">
                          <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">{role}</span></div>
                          <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">Date</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Escalation Template ── */}
                {at === 'escalate' && (
                  <div className="text-gray-900">
                    {/* Company Logo */}
                    <div className="flex items-center justify-center py-6 border-b border-gray-400">
                      {companyLogoUrl ? (
                        <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                          <img src={companyLogoUrl} alt="Company Logo" className="h-20 max-w-[200px] object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : (
                            <span className="text-[10px] text-gray-400 text-center leading-tight">Click to Add<br/>Company Logo</span>
                          )}
                        </button>
                      )}
                    </div>
                    {/* Title */}
                    <div className="text-center py-4 border-b border-gray-400 px-6" style={{ backgroundColor: theme.bg }}>
                      <h1 className="text-xl font-bold tracking-wide" style={{ color: theme.accent }}>{theme.title}</h1>
                      {theme.subtitle && <p className="text-sm italic text-gray-500 mt-0.5">{theme.subtitle}</p>}
                    </div>
                    {/* Confidential Banner */}
                    <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-700 bg-red-50 border-b border-gray-400">
                      <span>🔒</span> CONFIDENTIAL <span>🔒</span>
                    </div>
                    {/* Routing Info */}
                    <div className="px-6 py-3 border-b border-gray-400">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Date Submitted:</span> <span className="font-semibold underline">{todayDate.toLocaleDateString('en-US')}</span></div>
                        <div><span className="text-gray-500">Submitted By:</span> <span className="font-semibold underline">{d.preparedBy || 'Supervisor'}</span></div>
                        <div><span className="text-gray-500">Department:</span> <span className="font-semibold underline">{caseData.department || 'N/A'}</span></div>
                        <div><span className="text-gray-500">Location:</span> <span className="font-semibold underline">{caseData.location || 'N/A'}</span></div>
                      </div>
                    </div>
                    {/* Case Summary */}
                    {d.caseSummary && (
                      <div className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>📋</span>
                          <h3 className="text-sm font-bold">Case Summary</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{fmt(d.caseSummary)}</div>
                      </div>
                    )}
                    {/* Remaining Sections */}
                    {sections.filter(s => s.id !== 'caseSummary').map(section => (
                      <div key={section.id} className="px-6 py-4 border-b border-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>•</span>
                          <h3 className="text-sm font-bold">{section.title}</h3>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{docEdits.find(e => e.sectionId === section.id)?.newContent || section.content}</div>
                      </div>
                    ))}
                    {/* Urgency Level */}
                    {d.urgencyLevel && (
                      <div className="px-6 py-3 border-b border-gray-400">
                        <h3 className="text-sm font-bold mb-2">Urgency Level:</h3>
                        <div className="flex gap-4 text-xs">
                          {['Standard', 'High', 'Critical'].map(lvl => (
                            <label key={lvl} className="flex items-center gap-1.5">
                              <span className={`w-4 h-4 border border-gray-500 flex items-center justify-center text-[10px] font-bold ${d.urgencyLevel?.toLowerCase().includes(lvl.toLowerCase()) ? 'bg-red-600 text-white' : ''}`}>
                                {d.urgencyLevel?.toLowerCase().includes(lvl.toLowerCase()) ? 'X' : ''}
                              </span>
                              <span>{lvl}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Approval / HR Response */}
                    <div className="px-6 py-4 border-b border-gray-400">
                      <h3 className="text-sm font-bold mb-3">Approval:</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">Supervisor Signature</span></div>
                        <div><div className="border-b border-gray-400 h-8 mb-1" /><span className="text-[10px] text-gray-500">Date</span></div>
                      </div>
                    </div>
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-bold mb-3">HR Response:</h3>
                      <div className="space-y-2 text-xs">
                        <div><span className="text-gray-500">Received By:</span> <span className="border-b border-gray-400 inline-block w-48">&nbsp;</span></div>
                        <div><span className="text-gray-500">Date Received:</span> <span className="border-b border-gray-400 inline-block w-48">&nbsp;</span></div>
                        <div><span className="text-gray-500">Priority Assigned:</span> <span className="border-b border-gray-400 inline-block w-48">&nbsp;</span></div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Approval Modal ─── */}
      {docPhase === 'approval' && generatedDoc && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-processing-bounce-in">
            <div className="flex flex-col items-center mb-5">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Approve Document</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">{getDocTitle(generatedDoc) || 'Generated Document'}</p>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Edits Made</span><span className="font-semibold text-gray-900 dark:text-white">{docEdits.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Status</span><span className="font-semibold text-gray-900 dark:text-white">Ready for Finalization</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Next Step</span><span className="font-semibold text-gray-900 dark:text-white">Case Finalization</span></div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Approval Notes (Optional)</label>
              <textarea value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} rows={3} placeholder="Add any notes about this approval..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            <label className="flex items-start gap-3 mb-5 cursor-pointer">
              <input type="checkbox" checked={approvalConfirmed} onChange={e => setApprovalConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">I have reviewed this document and confirm it is ready for finalization.</span>
            </label>

            <button onClick={handleApproveDocument} disabled={!approvalConfirmed} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
              <CheckCircle2 className="w-4 h-4" /> Approve &amp; Continue
            </button>
            <button onClick={() => { setDocPhase('none'); setApprovalNotes(''); setApprovalConfirmed(false); }} className="w-full py-2.5 mt-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Document Upload Modal (Prior History) ─── */}
      {showDocUpload && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div
            ref={duDragRef}
            className="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden pointer-events-auto"
            style={duIsMaximized
              ? { top: duBounds.top, left: duBounds.left, width: duBounds.width, height: duBounds.height, opacity: duReady ? 1 : 0, transition: 'opacity 0.15s' }
              : { top: duPos.y, left: duPos.x, width: duSize.w, height: duSize.h, opacity: duReady ? 1 : 0, transition: 'opacity 0.15s' }
            }
          >
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
              onMouseDown={onDuDragStart}
            >
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Add {docUploadTypeLabels[docUploadType] || 'Document'}</h4>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setDuIsMaximized(!duIsMaximized)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title={duIsMaximized ? 'Restore' : 'Maximize'}>
                  {duIsMaximized ? <Minimize2 className="w-4 h-4 text-gray-500" /> : <Maximize2 className="w-4 h-4 text-gray-500" />}
                </button>
                <button onClick={closeDocUpload} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" title="Close">
                  <X className="w-4 h-4 text-gray-500 hover:text-red-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Document type badge */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {docUploadTypeLabels[docUploadType] || docUploadType}
                </span>
              </div>

              {/* Mode Selection */}
              {!docUploadMode && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">How would you like to add this document?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDocUploadMode('file')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Upload File</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, JPG, PNG</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setDocUploadMode('manual')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all"
                    >
                      <PenTool className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Type Manually</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter text directly</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* File Upload Mode */}
              {docUploadMode === 'file' && (
                <div className="space-y-4">
                  {/* Language selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Source Language</label>
                    <select
                      value={docUploadLanguage}
                      onChange={e => setDocUploadLanguage(e.target.value)}
                      title="Source Language"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    >
                      <option>English</option>
                      <option>Arabic</option>
                      <option>French</option>
                      <option>Spanish</option>
                      <option>Hindi</option>
                      <option>Urdu</option>
                    </select>
                  </div>

                  {/* File drop area */}
                  <label className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors">
                    <FileUp className="w-10 h-10 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, JPG, PNG (max 10MB)</p>
                    </div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={handleDocFileSelect} className="hidden" />
                  </label>

                  {/* File loading indicator */}
                  {docUploadFileLoading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Reading file...
                    </div>
                  )}

                  {/* Uploaded images preview */}
                  {docUploadImageNames.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{docUploadImageNames.length} page(s) loaded</p>
                      <div className="flex flex-wrap gap-2">
                        {docUploadImageNames.map((name, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">
                            <Image className="w-3.5 h-3.5" /> {name}
                            <button onClick={() => { setDocUploadImages(prev => prev.filter((_, j) => j !== i)); setDocUploadImageNames(prev => prev.filter((_, j) => j !== i)); }} className="ml-1 text-gray-400 hover:text-red-500" title="Remove">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Process / OCR Result */}
                  {docUploadImages.length > 0 && !docUploadOcrResult && (
                    <button
                      onClick={handleDocProcess}
                      disabled={docUploadProcessing}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {docUploadProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing OCR...</> : <><Eye className="w-4 h-4" /> Process Document</>}
                    </button>
                  )}

                  {/* OCR Result Preview */}
                  {docUploadOcrResult && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-400">OCR Complete</span>
                        {docUploadOcrResult.detectedLanguage && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            <Globe className="w-3 h-3 inline mr-1" />{docUploadOcrResult.detectedLanguage}
                          </span>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {docUploadOcrResult.cleanedText || docUploadOcrResult.originalText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Text Mode */}
              {docUploadMode === 'manual' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Document Text</label>
                  <textarea
                    value={docUploadText}
                    onChange={e => setDocUploadText(e.target.value)}
                    rows={10}
                    placeholder="Enter or paste the document text here..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            {docUploadMode && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex-shrink-0">
                <button
                  onClick={() => { setDocUploadMode(null); setDocUploadImages([]); setDocUploadImageNames([]); setDocUploadOcrResult(null); setDocUploadText(''); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleDocSave}
                  disabled={docUploadSaving || (docUploadMode === 'file' && !docUploadOcrResult) || (docUploadMode === 'manual' && !docUploadText.trim())}
                  className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {docUploadSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Document</>}
                </button>
              </div>
            )}

            {/* Resize handle (non-maximized) */}
            {!duIsMaximized && (
              <div
                ref={duResizeRef}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                onMouseDown={onDuResizeStart}
              >
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" viewBox="0 0 16 16"><path d="M14 14L8 14L14 8Z" fill="currentColor" /></svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Review Active Policy Modal (portalled, movable) ─── */}
      {showPolicyReviewModal && typeof document !== 'undefined' && createPortal(
        (() => {
          const activePolicy = policies.find(p => p.status === 'ACTIVE') || policies[0];
          const hasSections = activePolicy && activePolicy.sections && (Array.isArray(activePolicy.sections) ? activePolicy.sections.length > 0 : typeof activePolicy.sections === 'object' && Object.keys(activePolicy.sections).length > 0);
          if (!activePolicy || !hasSections) {
            return (
              <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-sm text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">No active policy with sections found.</p>
                  <button onClick={() => setShowPolicyReviewModal(false)} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700">Close</button>
                </div>
              </div>
            );
          }

          const rawSections = activePolicy.sections;
          const sectionsArray: PolicySection[] = Array.isArray(rawSections)
            ? rawSections
            : rawSections && typeof rawSections === 'object'
            ? Object.values(rawSections) as PolicySection[]
            : [];

          const matchedSectionIds = new Set((policyResult?.matches || []).map(m => m.sectionId));
          const matchedSectionNumbers = new Set((policyResult?.matches || []).map(m => m.sectionNumber));
          // Build confidence lookup by sectionId and sectionNumber
          const matchConfidenceById = new Map<string, number>();
          const matchConfidenceByNumber = new Map<string, number>();
          (policyResult?.matches || []).forEach(m => {
            matchConfidenceById.set(m.sectionId, m.matchConfidence);
            matchConfidenceByNumber.set(m.sectionNumber, m.matchConfidence);
          });
          const getMatchLevel = (sectionId: string, sectionNumber: string): 'high' | 'moderate' | 'low' | null => {
            const conf = matchConfidenceById.get(sectionId) ?? matchConfidenceByNumber.get(sectionNumber) ?? null;
            if (conf === null) return null;
            if (conf >= 0.8) return 'high';
            if (conf >= 0.65) return 'moderate';
            return 'low';
          };
          // Keep legacy sets for backward compat
          const highRelevanceSectionIds = new Set(
            (policyResult?.matches || []).filter(m => m.matchConfidence >= 0.8).map(m => m.sectionId)
          );
          const highRelevanceSectionNumbers = new Set(
            (policyResult?.matches || []).filter(m => m.matchConfidence >= 0.8).map(m => m.sectionNumber)
          );

          const searchLower = policyReviewSearch.toLowerCase();
          const filteredSections = sectionsArray.filter(s => {
            if (!searchLower) return true;
            return (
              s.sectionNumber.toLowerCase().includes(searchLower) ||
              s.title.toLowerCase().includes(searchLower) ||
              s.content.toLowerCase().includes(searchLower) ||
              (s.firstProgression || '').toLowerCase().includes(searchLower) ||
              (s.secondProgression || '').toLowerCase().includes(searchLower) ||
              (s.thirdProgression || '').toLowerCase().includes(searchLower) ||
              (s.fourthProgression || '').toLowerCase().includes(searchLower)
            );
          });

          const toggleSection = (sectionId: string) => {
            setPolicyReviewSelected(prev => {
              const next = new Set(prev);
              if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
              return next;
            });
          };

          const handleAddSelectedViolations = async () => {
            if (!policyResult || policyReviewSelected.size === 0) return;

            // Gather selected sections
            const selectedSections = sectionsArray.filter(s => policyReviewSelected.has(s.id));
            if (selectedSections.length === 0) return;

            // Start AI validation progress
            setPrValidating(true);
            setPrValidationStep(0);
            setPrShowResults(false);
            setPrValidationResults(null);
            prValidationStepRef.current = 0;
            prValidationTimerRef.current = setInterval(() => {
              prValidationStepRef.current++;
              if (prValidationStepRef.current < PR_VALIDATION_STEPS.length) {
                setPrValidationStep(prValidationStepRef.current);
              } else if (prValidationTimerRef.current) {
                clearInterval(prValidationTimerRef.current);
              }
            }, 3000);

            try {
              const result = await runPolicyMatching({
                caseDetails: {
                  caseType: caseData.type,
                  incidentDate: caseData.incidentDate || '',
                  location: caseData.location || '',
                  department: caseData.department || '',
                },
                complaintA: {
                  employeeName: complainantA?.name || 'Party A',
                  text: complaintA?.cleanedText || complaintA?.originalText || '',
                },
                complaintB: {
                  employeeName: complainantB?.name || 'Party B',
                  text: complaintB?.cleanedText || complaintB?.originalText || '',
                },
                analysisResult: comparisonResult
                  ? { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary }
                  : undefined,
                witnessStatements: witnessDocs.map(w => {
                  const matchedEmp = witnessEmployees.find(e => e.id === w.employeeId);
                  return { witnessName: matchedEmp?.name || 'Witness', text: w.cleanedText || w.originalText || '' };
                }),
                policySections: selectedSections,
              });

              // Map results: only keep matches for sections that were actually selected
              const selectedIds = new Set(selectedSections.map(s => s.id));
              const selectedNumbers = new Set(selectedSections.map(s => s.sectionNumber));
              const aiMatches = (result.matches || [])
                .filter(m => selectedIds.has(m.sectionId) || selectedNumbers.has(m.sectionNumber))
                .map(m => ({
                  ...m,
                  // Use section content for display, not the type/category
                  sectionTitle: sectionsArray.find(s => s.id === m.sectionId)?.content || m.sectionTitle,
                }));

              // For sections AI didn't return (below threshold), create low-confidence entries
              const returnedIds = new Set(aiMatches.map(m => m.sectionId));
              const returnedNumbers = new Set(aiMatches.map(m => m.sectionNumber));
              selectedSections.forEach(s => {
                if (!returnedIds.has(s.id) && !returnedNumbers.has(s.sectionNumber)) {
                  aiMatches.push({
                    sectionId: s.id,
                    sectionNumber: s.sectionNumber,
                    sectionTitle: s.content,
                    relevanceExplanation: 'This section does not appear to be directly relevant to the behaviors described in the complaint statements or witness accounts for this case.',
                    matchConfidence: 0.2,
                    keyPhrases: [],
                  });
                }
              });

              setPrValidationResults(aiMatches);
            } catch (err: any) {
              // On error, create fallback entries so user can still decide
              const fallbackMatches: PolicyMatch[] = selectedSections.map(s => ({
                sectionId: s.id,
                sectionNumber: s.sectionNumber,
                sectionTitle: s.content,
                relevanceExplanation: 'AI analysis could not be completed. You may still add this section based on your professional judgment.',
                matchConfidence: 0.5,
                keyPhrases: [],
              }));
              setPrValidationResults(fallbackMatches);
            } finally {
              // Finish animation steps
              if (prValidationTimerRef.current) clearInterval(prValidationTimerRef.current);
              let s = prValidationStepRef.current;
              const fastForward = () => {
                s++;
                if (s < PR_VALIDATION_STEPS.length) {
                  prValidationStepRef.current = s;
                  setPrValidationStep(s);
                  setTimeout(fastForward, 300);
                } else {
                  prValidationStepRef.current = PR_VALIDATION_STEPS.length - 1;
                  setPrValidationStep(PR_VALIDATION_STEPS.length - 1);
                  setTimeout(() => {
                    setPrValidating(false);
                    setPrShowResults(true);
                  }, 500);
                }
              };
              fastForward();
            }
          };

          const handleAcceptValidatedSections = () => {
            if (!policyResult || !prValidationResults) return;
            const existingIds = new Set((policyResult.matches || []).map(m => m.sectionId));
            const newMatches = prValidationResults.filter(m => !existingIds.has(m.sectionId));
            if (newMatches.length > 0) {
              const updatedResult = {
                ...policyResult,
                matches: [...(policyResult.matches || []), ...newMatches],
              };
              setPolicyResult(updatedResult);
              // Persist to database
              updateCase(caseData.id, { policyMatchesJson: updatedResult, policyMatchingResultJson: updatedResult, userId })
                .then(() => onUpdate())
                .catch(err => console.error('[AcceptValidatedSections] updateCase error:', err));
            }
            setPolicyReviewSelected(new Set());
            setPrShowResults(false);
            setPrValidationResults(null);
            setShowPolicyReviewModal(false);
          };

          const handleDeclineValidatedSections = () => {
            setPrShowResults(false);
            setPrValidationResults(null);
            // Keep modal open so user can adjust selection
          };

          const onPrDragStart = (e: React.MouseEvent) => {
            e.preventDefault();
            policyReviewDragRef.current = { startX: e.clientX, startY: e.clientY, origX: policyReviewPos.x, origY: policyReviewPos.y };
            const onMove = (ev: MouseEvent) => {
              if (!policyReviewDragRef.current) return;
              const dx = ev.clientX - policyReviewDragRef.current.startX;
              const dy = ev.clientY - policyReviewDragRef.current.startY;
              setPolicyReviewPos({ x: policyReviewDragRef.current.origX + dx, y: policyReviewDragRef.current.origY + dy });
            };
            const onUp = () => { policyReviewDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          };

          return (
            <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'none' }}>
              <div
                className="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                style={{ left: policyReviewPos.x, top: policyReviewPos.y, width: policyReviewSize.w, height: policyReviewSize.h, pointerEvents: 'auto' }}
              >
                {/* Drag Header */}
                <div
                  className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 cursor-move select-none"
                  onMouseDown={onPrDragStart}
                >
                  <div className="flex items-center gap-2">
                    <GripHorizontal className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{activePolicy.name}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">v{activePolicy.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {policyReviewSelected.size > 0 && !prValidating && !prShowResults && (
                      <button
                        onClick={handleAddSelectedViolations}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add ({policyReviewSelected.size})
                      </button>
                    )}
                    <button onClick={() => { if (!prValidating) { setShowPolicyReviewModal(false); setPrShowResults(false); setPrValidationResults(null); } }} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={policyReviewSearch}
                      onChange={e => setPolicyReviewSearch(e.target.value)}
                      placeholder="Search sections, content, violations..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">
                          <input
                            type="checkbox"
                            checked={filteredSections.filter(s => !matchedSectionIds.has(s.id) && !matchedSectionNumbers.has(s.sectionNumber)).length > 0 && filteredSections.filter(s => !matchedSectionIds.has(s.id) && !matchedSectionNumbers.has(s.sectionNumber)).every(s => policyReviewSelected.has(s.id))}
                            onChange={e => {
                              if (e.target.checked) {
                                setPolicyReviewSelected(new Set(filteredSections.filter(s => !matchedSectionIds.has(s.id) && !matchedSectionNumbers.has(s.sectionNumber)).map(s => s.id)));
                              } else {
                                setPolicyReviewSelected(new Set());
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        </th>
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
                      {filteredSections.map(section => {
                        const matchLevel = getMatchLevel(section.id, section.sectionNumber);
                        const isAlreadyMatched = matchedSectionIds.has(section.id) || matchedSectionNumbers.has(section.sectionNumber);
                        const isSelected = policyReviewSelected.has(section.id);
                        // Compact violations left — no empty columns before filled ones
                        const rawViolations = [section.firstProgression, section.secondProgression, section.thirdProgression, section.fourthProgression];
                        const filled = rawViolations.filter(v => v && v.trim());
                        const v1 = filled[0] || '—';
                        const v2 = filled[1] || '—';
                        const v3 = filled[2] || '—';
                        const v4 = filled[3] || '—';
                        // Row colors: already matched rows colored by relevance level, otherwise purple if selected
                        const rowClass = isAlreadyMatched
                          ? matchLevel === 'high'
                            ? 'bg-green-50 dark:bg-green-900/15'
                            : matchLevel === 'moderate'
                            ? 'bg-orange-50 dark:bg-orange-900/10'
                            : 'bg-gray-100 dark:bg-gray-800/60 opacity-60'
                          : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                        return (
                          <tr
                            key={section.id}
                            onClick={() => { if (!isAlreadyMatched) toggleSection(section.id); }}
                            className={`transition-colors ${isAlreadyMatched ? '' : 'cursor-pointer'} ${rowClass}`}
                          >
                            <td className="px-3 py-3">
                              {isAlreadyMatched ? (
                                <div className="w-4 h-4" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSection(section.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold ${isAlreadyMatched && matchLevel === 'low' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>{section.sectionNumber}</span>
                                {isAlreadyMatched && matchLevel === 'high' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-200 text-green-800 dark:bg-green-800/40 dark:text-green-300">HIGH</span>
                                )}
                                {isAlreadyMatched && matchLevel === 'moderate' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-200 text-orange-800 dark:bg-orange-800/40 dark:text-orange-300">MOD</span>
                                )}
                                {isAlreadyMatched && matchLevel === 'low' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">LOW</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white">{section.title}</p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-3">{section.content}</p>
                            </td>
                            <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v1}</td>
                            <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v2}</td>
                            <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v3}</td>
                            <td className="px-3 py-3 text-[11px] text-gray-600 dark:text-gray-400">{v4}</td>
                          </tr>
                        );
                      })}
                      {filteredSections.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No sections match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''} • {policyReviewSelected.size} selected
                  </p>
                  {policyReviewSelected.size > 0 && !prValidating && !prShowResults && (
                    <button
                      onClick={handleAddSelectedViolations}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Selected to Policy Alignment
                    </button>
                  )}
                </div>

                {/* ─── AI Validation Progress Overlay ─── */}
                {prValidating && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center animate-processing-overlay-in">
                    <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-2xl" />
                    <div className="absolute inset-0 overflow-hidden rounded-2xl">
                      <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-400/20 dark:bg-purple-500/15 rounded-full blur-3xl animate-blob" />
                      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-pink-400/20 dark:bg-pink-500/15 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center gap-6 animate-processing-bounce-in">
                      {/* Progress Ring */}
                      <div className="relative w-28 h-28">
                        <div className="absolute inset-0 rounded-full animate-processing-glow" />
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200/60 dark:text-gray-700/60" />
                          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="6" strokeLinecap="round"
                            className="text-purple-500 dark:text-purple-400"
                            style={{
                              strokeDasharray: `${2 * Math.PI * 52}`,
                              strokeDashoffset: `${2 * Math.PI * 52 * (1 - ((prValidationStep + 1) / PR_VALIDATION_STEPS.length))}`,
                              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen className="w-7 h-7 text-purple-500 dark:text-purple-400" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Analyzing Relevance</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Checking {policyReviewSelected.size} section{policyReviewSelected.size !== 1 ? 's' : ''} against case evidence</p>
                      </div>
                      {/* Step Checklist */}
                      <div className="space-y-2.5 w-72">
                        {PR_VALIDATION_STEPS.map((s, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {i < prValidationStep ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : i === prValidationStep ? (
                              <Loader2 className="w-5 h-5 text-purple-500 animate-spin flex-shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${i <= prValidationStep ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                              {s.icon} {s.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── AI Validation Results Overlay ─── */}
                {prShowResults && prValidationResults && (
                  <div className="absolute inset-0 z-30 flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
                    {/* Results Header */}
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Relevance Analysis Complete</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {prValidationResults.filter(m => m.matchConfidence >= 0.5).length} of {prValidationResults.length} section{prValidationResults.length !== 1 ? 's' : ''} found relevant
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Results List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {prValidationResults.map((m, i) => {
                        const conf = m.matchConfidence;
                        const confPercent = Math.round(conf * 100);
                        const isRelevant = conf >= 0.5;
                        const level = conf >= 0.8 ? 'high' : conf >= 0.65 ? 'moderate' : conf >= 0.5 ? 'low' : 'not_relevant';
                        const levelLabel = level === 'high' ? 'High Relevance' : level === 'moderate' ? 'Moderate Relevance' : level === 'low' ? 'Low Relevance' : 'Not Relevant';
                        const badgeColor = level === 'high'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : level === 'moderate'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : level === 'low'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                        const confColor = isRelevant ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
                        const borderColor = !isRelevant ? 'border-red-200 dark:border-red-800/50' : 'border-gray-200 dark:border-gray-700';

                        return (
                          <div key={i} className={`rounded-xl border ${borderColor} bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {!isRelevant && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Section {m.sectionNumber}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeColor}`}>{levelLabel}</span>
                                <span className={`text-xs font-bold ${confColor}`}>{confPercent}%</span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{m.sectionTitle}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{m.relevanceExplanation}</p>
                            {(m.keyPhrases || []).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {m.keyPhrases.map((kp, j) => (
                                  <span key={j} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">{kp}</span>
                                ))}
                              </div>
                            )}
                            {!isRelevant && (
                              <div className="mt-1 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30">
                                <div className="flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">This section may not be relevant to this case</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Results Footer */}
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-2">
                        {prValidationResults.some(m => m.matchConfidence < 0.5) && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">Some sections have low relevance</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeclineValidatedSections}
                          className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={handleAcceptValidatedSections}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accept &amp; Add All
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}

    </div>
  );
}

// ─── ACTIONS TAB ──────────────────────────────────────────────────────────────

function ActionsTab({ caseData, onUpdate, userId, onSwitchTab }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string; onSwitchTab?: (tab: string) => void;
}) {
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedActionDocument | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  useEffect(() => {
    if (caseData.generatedDocument) try { setGeneratedDoc(JSON.parse(caseData.generatedDocument)); } catch {}
    if (caseData.fullGeneratedDocumentResult) try { setGeneratedDoc(JSON.parse(caseData.fullGeneratedDocumentResult)); } catch {}
  }, [caseData]);

  const selectedAction = caseData.selectedAction as ActionType | null;
  const docs = caseData.documents || [];
  const complaintA = docs.find(d => d.type?.toLowerCase() === 'complaint_a');
  const complaintB = docs.find(d => d.type?.toLowerCase() === 'complaint_b');
  const employees = caseData.involvedEmployees || [];
  const complainantA = employees.find(e => e.isComplainant) || employees[0];
  const complainantB = employees.find((e, i) => e.isComplainant && i > 0) || employees[1];

  let recommendations: Recommendation[] = [];
  try { if (caseData.recommendations) recommendations = JSON.parse(caseData.recommendations)?.recommendations || []; } catch {}
  try { if (caseData.recommendationResult) recommendations = JSON.parse(caseData.recommendationResult)?.recommendations || []; } catch {}
  const selectedRec = recommendations.find(r => r.type === selectedAction || r.id === selectedAction);

  // Parse selected target employee IDs
  let selectedTargetNames: string[] = [];
  try {
    if (caseData.selectedTargetEmployeeIds) {
      const ids = JSON.parse(caseData.selectedTargetEmployeeIds);
      selectedTargetNames = ids.map((id: string) => employees.find(e => e.id === id)?.name).filter(Boolean);
    }
  } catch {}
  if (selectedTargetNames.length === 0 && selectedRec?.targetEmployeeNames) {
    selectedTargetNames = selectedRec.targetEmployeeNames;
  }

  let comparisonResult: ComparisonResult | null = null;
  try { if (caseData.comparisonResult) comparisonResult = JSON.parse(caseData.comparisonResult); } catch {}

  let policyMatches: any[] = [];
  try { if (caseData.policyMatches) policyMatches = JSON.parse(caseData.policyMatches)?.matches || []; } catch {}
  try { if (caseData.policyMatchingResult) policyMatches = JSON.parse(caseData.policyMatchingResult)?.matches || []; } catch {}

  const handleGenerate = async () => {
    if (!selectedAction) return;
    setGenerating(true); setError('');
    try {
      const result = await generateActionDocument({
        actionType: selectedAction as ActionType,
        caseDetails: { caseNumber: caseData.caseNumber, caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', text: complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', text: complaintB?.originalText || '' },
        analysisResult: comparisonResult ? { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary } : undefined,
        policyMatches: policyMatches.map((m: any) => ({ sectionNumber: m.sectionNumber, sectionTitle: m.sectionTitle, relevanceExplanation: m.relevanceExplanation })),
        recommendationRationale: selectedRec?.rationale,
        supervisorName: supervisorName || undefined,
        targetEmployeeNames: selectedTargetNames,
      });
      setGeneratedDoc(result);
      await updateCase(caseData.id, { generatedActionDocJson: result, fullGeneratedDocumentResultJson: result, status: 'pending_review', userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const actionLabels: Record<string, string> = {
    coaching: 'Coaching Guide',
    counseling: 'Counseling Document',
    warning: 'Written Warning',
    escalate: 'Escalation Package',
  };

  return (
    <div className="space-y-6">
      {!selectedAction ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Gavel className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">No Action Selected</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Go to the Analysis tab and select a recommendation to proceed.</p>
        </div>
      ) : (
        <>
          {/* Action Info */}
          <SectionCard title="Generate Action Document" icon={Gavel}>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {actionLabels[selectedAction] || selectedAction}
                    </p>
                    {selectedTargetNames.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">For: {selectedTargetNames.join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>

              {!generatedDoc && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Supervisor Name (optional)
                    </label>
                    <input
                      type="text"
                      value={supervisorName}
                      onChange={e => setSupervisorName(e.target.value)}
                      placeholder="Enter supervisor name..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || caseData.isLocked}
                    className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/25"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Generate {actionLabels[selectedAction] || 'Document'}
                  </button>
                </>
              )}
            </div>
          </SectionCard>

          {/* Generated Document */}
          {generatedDoc && (() => {
            const actionTypeColors: Record<string, { bg: string; text: string; icon: string }> = {
              coaching: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: 'text-green-600' },
              counseling: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-600' },
              warning: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: 'text-orange-600' },
              escalate: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: 'text-red-600' },
            };
            const tc = actionTypeColors[generatedDoc.actionType] || actionTypeColors.coaching;

            // Build sections for Word download
            const getActionsDocSections = (): { id: string; title: string; content: string }[] => {
              if (!generatedDoc?.document) return [];
              let d = typeof generatedDoc.document === 'string' ? (() => { try { return JSON.parse(generatedDoc.document as string); } catch { return null; } })() : generatedDoc.document;
              if (!d || typeof d !== 'object') return [];
              const at = (generatedDoc.actionType || '').toLowerCase();
              if (at && d[at] && typeof d[at] === 'object' && !Array.isArray(d[at])) {
                d = { ...d[at], ...(d.title ? { title: d.title } : {}), ...(d.documentDate ? { documentDate: d.documentDate } : {}) };
              }
              return Object.entries(d).filter(([k]) => k !== 'title' && k !== 'documentDate').map(([k, v]) => ({
                id: k,
                title: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
                content: typeof v === 'string' ? v : Array.isArray(v) ? v.map(i => typeof i === 'object' ? JSON.stringify(i) : String(i)).join('\n• ') : typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
              }));
            };
            const docSections = getActionsDocSections();
            const targetEmployee = selectedTargetNames.length > 0
              ? employees.find(e => selectedTargetNames.includes(e.name)) || null
              : employees[0] || null;
            const incidentDate = caseData.incidentDate ? new Date(caseData.incidentDate) : new Date();
            let docData = typeof generatedDoc.document === 'string' ? (() => { try { return JSON.parse(generatedDoc.document as string); } catch { return {}; } })() : (generatedDoc.document || {});
            const at = (generatedDoc.actionType || '').toLowerCase();
            if (at && docData[at] && typeof docData[at] === 'object') docData = { ...docData[at], ...docData };

            return (
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg ${tc.bg} flex items-center justify-center flex-shrink-0`}>
                    <FileText className={`w-5 h-5 ${tc.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{actionLabels[generatedDoc.actionType] || 'Document'}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Case {caseData.caseNumber}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${tc.bg} ${tc.text}`}>
                    {actionLabels[generatedDoc.actionType]}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Document Generated</p>
                    <p className="text-xs text-green-600 dark:text-green-400">View, edit, download, or add comments</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    onClick={() => onSwitchTab?.('analysis')}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/25"
                  >
                    <ArrowRight className="w-4 h-4" /> Continue to Review
                  </button>
                  <button
                    onClick={() => downloadDocx({
                      actionType: generatedDoc.actionType,
                      documentData: docData,
                      sections: docSections,
                      docEdits: [],
                      employee: targetEmployee ? { name: targetEmployee.name, role: targetEmployee.role, department: targetEmployee.department, employeeFileNo: targetEmployee.employeeFileNo } : null,
                      caseNumber: caseData.caseNumber,
                      department: caseData.department || '',
                      location: caseData.location || '',
                      incidentDate,
                      todayDate: new Date(),
                      companyLogoUrl: caseData.companyLogoUrl || null,
                    })}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
                  >
                    <Download className="w-4 h-4" /> Download Word Document
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSwitchTab?.('comments')}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Comments
                    </button>
                    <button
                      onClick={() => onSwitchTab?.('history')}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700"
                    >
                      <Clock className="w-3.5 h-3.5" /> History
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ─── GENERATED DOCUMENT DISPLAY ───────────────────────────────────────────────

function GeneratedDocumentDisplay({ document: genDoc }: { document: GeneratedActionDocument }) {
  const doc = genDoc.document;
  if (!doc) return <p className="text-gray-400">No document content</p>;

  const renderSection = (label: string, content: any) => {
    if (!content) return null;
    if (typeof content === 'string') {
      return (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{label}</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{content}</p>
        </div>
      );
    }
    if (Array.isArray(content)) {
      return (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{label}</h4>
          <ul className="space-y-1">
            {content.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (typeof content === 'object') {
      return (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{label}</h4>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 space-y-2">
            {Object.entries(content).map(([k, v]) => (
              <div key={k}>
                {renderSection(k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), v)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {doc.title && <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">{doc.title}</h3>}
      {Object.entries(doc).filter(([k]) => k !== 'title').map(([key, value]) => (
        <div key={key}>
          {renderSection(key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), value)}
        </div>
      ))}
    </div>
  );
}

// ─── REVIEW TAB ───────────────────────────────────────────────────────────────

function ReviewTab({ caseData, onUpdate, userId, userName }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string; userName: string;
}) {
  const [supervisorNotes, setSupervisorNotes] = useState(caseData.supervisorNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateCase(caseData.id, { supervisorNotes, userId });
      onUpdate();
    } catch {} finally { setSavingNotes(false); }
  };

  return (
    <div className="space-y-6">
      {/* Supervisor Notes */}
      <SectionCard title="Supervisor Notes" icon={Edit3}>
        <textarea
          value={supervisorNotes}
          onChange={e => setSupervisorNotes(e.target.value)}
          disabled={caseData.isLocked}
          rows={4}
          placeholder="Add supervisor notes, observations, or instructions..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition-colors resize-none disabled:opacity-50"
        />
        {!caseData.isLocked && (
          <button onClick={handleSaveNotes} disabled={savingNotes} className="mt-3 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Notes
          </button>
        )}
      </SectionCard>

      {/* Case Actions */}
      {!caseData.isLocked && (
        <SectionCard title="Case Actions" icon={Gavel}>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg shadow-green-600/25"
            >
              <Lock className="w-4 h-4" /> Close & Lock Case
            </button>
          </div>
        </SectionCard>
      )}

      {/* Close Case Modal */}
      {showCloseModal && <CloseCaseModal caseData={caseData} userId={userId} onClose={() => setShowCloseModal(false)} onClosed={onUpdate} />}
    </div>
  );
}

// ─── CLOSE CASE MODAL ─────────────────────────────────────────────────────────

function CloseCaseModal({ caseData, userId, onClose, onClosed }: {
  caseData: ConflictCase; userId: string; onClose: () => void; onClosed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [closing, setClosing] = useState(false);

  const reasons = [
    { value: 'RESOLVED', label: 'Issue Resolved', description: 'The matter has been addressed and resolved', icon: '✅' },
    { value: 'NO_FURTHER_ACTION', label: 'No Further Action Required', description: 'Investigation complete, no disciplinary action warranted', icon: '📋' },
    { value: 'EMPLOYEE_SEPARATION', label: 'Employee Separation', description: 'Employee has left the organization', icon: '👋' },
    { value: 'WITHDRAWN', label: 'Complaint Withdrawn', description: 'Complainant has withdrawn the complaint', icon: '↩️' },
    { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient Evidence', description: 'Unable to substantiate claims with available evidence', icon: '🔍' },
    { value: 'OTHER', label: 'Other', description: 'Other reason (specify in summary)', icon: '📝' },
  ];

  const handleClose = async () => {
    if (!reason) return;
    setClosing(true);
    try {
      await closeCase(caseData.id, { closureReason: reason, closedBy: userId, closureSummary: summary || undefined });
      onClosed();
      onClose();
    } catch (err) { console.error(err); }
    finally { setClosing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
              <Lock className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Close & Lock Case</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{caseData.caseNumber}</p>
            </div>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          {/* Warning */}
          <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400"><span className="font-semibold">Permanent —</span> The case will be locked. Documents and audit trail are preserved but uneditable.</p>
          </div>

          {/* Closure Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Closure Reason <span className="text-red-500">*</span></label>
            <div className="space-y-1.5">
              {reasons.map(r => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                    reason === r.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-tight ${reason === r.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>{r.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{r.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      reason === r.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {reason === r.value && <CheckCircle2 className="w-3 h-3 text-white -mt-[1px] -ml-[1px]" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Closure Summary */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Closure Summary</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} placeholder="Summarize the resolution and any follow-up actions taken..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition-colors resize-none text-sm" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleClose} disabled={!reason || closing} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-red-600/25">
            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Close & Lock Case
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GENERATE REPORT MODAL ───────────────────────────────────────────────────

function GenerateReportModal({ caseData, onClose }: {
  caseData: ConflictCase; onClose: () => void;
}) {
  const deduplicateEmployees = (employees: any[]) => {
    const seen = new Set<string>();
    return employees.filter(e => {
      const key = e.employeeFileNo || `${e.name}-${e.role}-${e.department}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const [config, setConfig] = useState<ReportConfig>(getDefaultConfig('comprehensive'));
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate>('comprehensive');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  // Progress tracking
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
  // Phase: 'config' | 'generating' | 'success'
  const [phase, setPhase] = useState<'config' | 'generating' | 'success'>('config');
  // Store generated report for deferred download
  const reportBlobRef = useRef<{ blob: Blob; filename: string; sectionCount: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Dragging
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const allGenerationSteps: { label: string; icon: typeof Zap; duration: number; configKey?: keyof ReportConfig }[] = [
    { label: 'Initializing report engine', icon: Zap, duration: 1500 },
    { label: 'Loading case data & documents', icon: FileText, duration: 2200 },
    { label: 'Building executive summary', icon: Award, duration: 2000, configKey: 'includeExecutiveSummary' },
    { label: 'Compiling case details', icon: ClipboardList, duration: 1800, configKey: 'includeCaseDetails' },
    { label: 'Processing involved parties', icon: Users, duration: 1600, configKey: 'includeInvolvedParties' },
    { label: 'Processing document images', icon: Image, duration: 3500, configKey: 'includeDocumentSummary' },
    { label: 'Embedding scanned documents', icon: Upload, duration: 4000, configKey: 'includeDocumentSummary' },
    { label: 'Running AI analysis', icon: Brain, duration: 3000, configKey: 'includeAIAnalysis' },
    { label: 'Matching policy sections', icon: BookOpen, duration: 2200, configKey: 'includePolicyMatches' },
    { label: 'Generating recommendations', icon: Lightbulb, duration: 2000, configKey: 'includeRecommendations' },
    { label: 'Processing selected action', icon: Target, duration: 1500, configKey: 'includeSelectedAction' },
    { label: 'Compiling audit trail', icon: Clock, duration: 1800, configKey: 'includeAuditTrail' },
    { label: 'Rendering signatures', icon: PenTool, duration: 2800, configKey: 'includeSignatureBlocks' },
    { label: 'Applying branding & formatting', icon: Sparkles, duration: 2200 },
    { label: 'Generating DOCX file', icon: FileDown, duration: 1800 },
    { label: 'Finalizing report', icon: CheckCircle2, duration: 1200 },
  ];

  // Active steps are computed at generation time and stored in state
  const [activeSteps, setActiveSteps] = useState<typeof allGenerationSteps>([]);

  const templates: { id: ReportTemplate; label: string; description: string; icon: string; color: string }[] = [
    { id: 'comprehensive', label: 'Comprehensive', description: 'Full detailed report', icon: '📋', color: 'blue' },
    { id: 'executive', label: 'Executive', description: 'High-level overview', icon: '👔', color: 'purple' },
    { id: 'summary', label: 'Summary', description: 'Condensed key points', icon: '📝', color: 'green' },
    { id: 'hrReview', label: 'HR Review', description: 'HR-focused review', icon: '👥', color: 'orange' },
    { id: 'legal', label: 'Legal', description: 'Legal documentation', icon: '⚖️', color: 'red' },
  ];

  const confidentialityLevels: { value: ConfidentialityLevel; label: string; color: string }[] = [
    { value: 'CONFIDENTIAL', label: 'Confidential', color: 'text-red-600' },
    { value: 'RESTRICTED', label: 'Restricted', color: 'text-orange-600' },
    { value: 'INTERNAL_ONLY', label: 'Internal Only', color: 'text-yellow-600' },
    { value: 'HR_ONLY', label: 'HR Only', color: 'text-purple-600' },
  ];

  const reportSections = [
    { key: 'includeExecutiveSummary' as const, label: 'Executive Summary', description: 'High-level case overview and key findings', icon: FileText },
    { key: 'includeCaseDetails' as const, label: 'Case Details', description: 'Full case information, dates, and location', icon: ClipboardList },
    { key: 'includeInvolvedParties' as const, label: 'Involved Parties', description: 'All employees involved in the case', icon: Users },
    { key: 'includeDocumentSummary' as const, label: 'Document Summary', description: 'List of all uploaded documents', icon: FileText },
    { key: 'includeAIAnalysis' as const, label: 'AI Analysis', description: 'AI-generated comparison and insights', icon: Brain, disabled: !caseData.comparisonResult },
    { key: 'includePolicyMatches' as const, label: 'Policy Matches', description: 'Relevant policy sections identified', icon: BookOpen, disabled: !caseData.policyMatches },
    { key: 'includeRecommendations' as const, label: 'Recommendations', description: 'AI-generated action recommendations', icon: Lightbulb, disabled: !caseData.recommendations },
    { key: 'includeSelectedAction' as const, label: 'Selected Action', description: 'Final action and resolution details', icon: CheckCircle2, disabled: !caseData.selectedAction },
    { key: 'includeAuditTrail' as const, label: 'Audit Trail', description: 'Complete history of case actions', icon: Clock, disabled: !(caseData.auditLog || []).length },
    { key: 'includeSignatureBlocks' as const, label: 'Signature Blocks', description: 'Sign-off sections for approvals', icon: PenTool },
  ];

  const applyTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    const newConfig = getDefaultConfig(template);
    newConfig.preparedBy = config.preparedBy;
    newConfig.preparedFor = config.preparedFor;
    setConfig(newConfig);
  };

  const selectAll = () => {
    setConfig(prev => ({
      ...prev,
      includeExecutiveSummary: true,
      includeCaseDetails: true,
      includeInvolvedParties: true,
      includeDocumentSummary: true,
      includeAIAnalysis: !!caseData.comparisonResult,
      includePolicyMatches: !!caseData.policyMatches,
      includeRecommendations: !!caseData.recommendations,
      includeSelectedAction: !!caseData.selectedAction,
      includeAuditTrail: !!(caseData.auditLog || []).length,
      includeSignatureBlocks: true,
    }));
  };

  const deselectAll = () => {
    setConfig(prev => ({
      ...prev,
      includeExecutiveSummary: false,
      includeCaseDetails: false,
      includeInvolvedParties: false,
      includeDocumentSummary: false,
      includeAIAnalysis: false,
      includePolicyMatches: false,
      includeRecommendations: false,
      includeSelectedAction: false,
      includeAuditTrail: false,
      includeSignatureBlocks: false,
    }));
  };

  const selectedCount = reportSections.filter(s => !s.disabled && config[s.key]).length;
  const availableCount = reportSections.filter(s => !s.disabled).length;

  const toggleSection = (key: keyof ReportConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Simulate progress steps during actual generation
  const simulateProgress = useCallback((steps: typeof allGenerationSteps) => {
    const count = steps.length;
    const completed: boolean[] = new Array(count).fill(false);
    setCompletedSteps(completed);
    setCurrentStep(0);
    setProgress(0);

    const durations = steps.map(s => s.duration);
    const totalTime = durations.reduce((a, b) => a + b, 0);
    let totalDuration = 0;

    durations.forEach((dur, i) => {
      const startDelay = totalDuration;
      const endDelay = totalDuration + dur;

      setTimeout(() => {
        setCurrentStep(i);
        setProgress(Math.round((startDelay / totalTime) * 100));
      }, startDelay);

      // Incremental progress within each step
      const ticks = 4;
      for (let t = 1; t <= ticks; t++) {
        setTimeout(() => {
          setProgress(Math.round(((startDelay + (dur * t / ticks)) / totalTime) * 100));
        }, startDelay + (dur * t / ticks));
      }

      setTimeout(() => {
        setCompletedSteps(prev => { const n = [...prev]; n[i] = true; return n; });
      }, endDelay - 100);

      totalDuration += dur;
    });

    // Final 100%
    setTimeout(() => {
      setProgress(100);
      setCurrentStep(count);
    }, totalDuration);

    return totalTime;
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setPhase('generating');
    setError('');

    // Filter steps based on selected config sections
    const steps = allGenerationSteps.filter(s => !s.configKey || config[s.configKey]);
    setActiveSteps(steps);

    const genStart = Date.now();
    const animationTotal = simulateProgress(steps);

    try {
      let comparison: ComparisonResult | null = null;
      let policyResult: PolicyMatchResult | null = null;
      let recommendationResult: RecommendationResult | null = null;

      if (caseData.comparisonResult) {
        try { comparison = typeof caseData.comparisonResult === 'string' ? JSON.parse(caseData.comparisonResult) : caseData.comparisonResult; } catch {}
      }
      if (caseData.policyMatches) {
        try { policyResult = typeof caseData.policyMatches === 'string' ? JSON.parse(caseData.policyMatches) : caseData.policyMatches; } catch {}
      }
      if (caseData.recommendations || caseData.recommendationResult) {
        try {
          const raw = caseData.recommendationResult || caseData.recommendations;
          recommendationResult = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {}
      }

      const input: ReportGenerationInput = {
        caseData,
        config,
        comparison,
        policyResult,
        recommendationResult,
        auditLog: caseData.auditLog || [],
      };

      // Generate but DON'T download yet — store the blob
      const result = await generateCaseReport(input);
      reportBlobRef.current = result;

      // Wait for the full animation to complete before showing success
      const elapsed = Date.now() - genStart;
      const remaining = Math.max(animationTotal - elapsed + 800, 0);
      setTimeout(() => {
        setProgress(100);
        setCurrentStep(steps.length);
        setCompletedSteps(new Array(steps.length).fill(true));
        setGenerating(false);
        setPhase('success');
      }, remaining);
    } catch (err: any) {
      console.error('Report generation failed:', err);
      setError(err.message || 'Failed to generate report');
      setGenerating(false);
      setPhase('config');
      setCurrentStep(-1);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!reportBlobRef.current) return;
    setDownloading(true);
    const { blob, filename } = reportBlobRef.current;
    saveAs(blob, filename);
    setTimeout(() => setDownloading(false), 1000);
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!modalRef.current) return;
    isDragging.current = true;
    const rect = modalRef.current.getBoundingClientRect();
    dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setModalPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const templateColorMap: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-blue-500',
    purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-purple-500',
    green: 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-green-500',
    orange: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-orange-500',
    red: 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-red-500',
  };

  const modalStyle: React.CSSProperties = modalPos ? {
    position: 'fixed',
    left: modalPos.x,
    top: modalPos.y,
    transform: 'none',
    margin: 0,
  } : {};

  // ── Success Modal (bouncing, separate from main modal) ──
  if (phase === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-modal-bounce">
          {/* Success Header */}
          <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
            {/* Decorative background circles */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-green-400/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full translate-x-1/2 translate-y-1/2" />
            
            {/* Animated checkmark */}
            <div className="relative mx-auto w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5">Report Ready!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your case investigation report has been generated successfully.
            </p>
          </div>

          {/* Report Info */}
          <div className="mx-6 mb-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Case</span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{caseData.caseNumber}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Sections</span>
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{reportBlobRef.current?.sectionCount ?? 0} included</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Format</span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Word Document (.docx)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 space-y-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-green-600/25 active:scale-[0.98]"
            >
              {downloading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
              ) : (
                <><Download className="w-5 h-5" /> Download Report</>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main (Config + Generating) Modal ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        ref={modalRef}
        style={modalStyle}
        className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
      >
        {/* Drag handle + Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-1" />
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generate Report</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Case Investigation Report</p>
            </div>
          </div>
          {!generating && (
            <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
          )}
        </div>

        {/* Generation Progress View */}
        {generating && (
          <div className="px-6 py-6 space-y-5">
            {/* Progress header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Generating Report...</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Processing case #{caseData.caseNumber}</p>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Progress</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 transition-all duration-500 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>
            </div>

            {/* Step checklist */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
              {activeSteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = completedSteps[idx];
                const isActive = currentStep === idx;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                      isActive ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                      isCompleted ? 'bg-green-50/50 dark:bg-green-900/10' :
                      'opacity-40'
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-500 text-white' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </div>
                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium transition-colors ${
                        isCompleted ? 'text-green-700 dark:text-green-400' :
                        isActive ? 'text-blue-700 dark:text-blue-300' :
                        'text-gray-400 dark:text-gray-500'
                      }`}>{step.label}</p>
                    </div>
                    {/* Step type icon */}
                    <StepIcon className={`w-4 h-4 flex-shrink-0 ${
                      isCompleted ? 'text-green-500' :
                      isActive ? 'text-blue-500' :
                      'text-gray-300 dark:text-gray-600'
                    }`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Configuration View (hidden during generation) */}
        {!generating && phase === 'config' && (
          <div className="px-6 py-5 space-y-6">
            {/* Case Info Card */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Case Number</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{caseData.caseNumber}</p>
                </div>
                <Badge className={getStatusColor(caseData.status)}>{getStatusLabel(caseData.status)}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {caseData.department || '—'}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(caseData.incidentDate)}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {deduplicateEmployees(caseData.involvedEmployees || []).length} parties</span>
              </div>
            </div>

            {/* Report Template */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><FileCheck className="w-4 h-4 text-blue-500" /> Report Template</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all min-w-[100px] ${
                      selectedTemplate === t.id ? templateColorMap[t.color] : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{t.label}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight text-center">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Include in Report */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-green-500" /> Include in Report
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">({selectedCount}/{availableCount})</span>
                </h3>
                <div className="flex items-center gap-3">
                  <button onClick={deselectAll} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 hover:underline transition-colors">Deselect All</button>
                  <button onClick={selectAll} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {reportSections.map(section => (
                  <div
                    key={section.key}
                    onClick={() => { if (!section.disabled) toggleSection(section.key); }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      section.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } ${config[section.key] ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className={`p-1.5 rounded-lg ${config[section.key] ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <section.icon className={`w-3.5 h-3.5 ${config[section.key] ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{section.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{section.description}</p>
                    </div>
                    {section.disabled ? (
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">N/A</span>
                    ) : (
                      <div
                        onClick={e => { e.stopPropagation(); toggleSection(section.key); }}
                        className={`w-10 h-[22px] rounded-full flex items-center transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                          config[section.key] ? 'bg-blue-600 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'
                        }`}
                      >
                        <div className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200`} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Report Metadata */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-orange-500" /> Report Metadata</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confidentiality Level</label>
                  <select
                    value={config.confidentialityLevel}
                    onChange={e => setConfig(prev => ({ ...prev, confidentialityLevel: e.target.value as ConfidentialityLevel }))}
                    title="Confidentiality level"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {confidentialityLevels.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={config.preparedBy}
                    onChange={e => setConfig(prev => ({ ...prev, preparedBy: e.target.value }))}
                    placeholder="Your name or title"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prepared For</label>
                  <input
                    type="text"
                    value={config.preparedFor}
                    onChange={e => setConfig(prev => ({ ...prev, preparedFor: e.target.value }))}
                    placeholder="Recipient name or department"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer (config phase only) */}
        {!generating && phase === 'config' && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl sticky bottom-0">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/25"
            >
              <FileDown className="w-4 h-4" /> Generate Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMMENTS TAB ─────────────────────────────────────────────────────────────

function CommentsTab({ caseData, userId, userName }: {
  caseData: ConflictCase; userId: string; userName: string;
}) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSection, setNewSection] = useState('');
  const [newComment, setNewComment] = useState('');
  const [adding, setAdding] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReviewComments(caseData.id);
      setComments(res.data || []);
    } catch {} finally { setLoading(false); }
  }, [caseData.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleAddComment = async () => {
    if (!newSection.trim() || !newComment.trim()) return;
    setAdding(true);
    try {
      await addReviewComment(caseData.id, { section: newSection.trim(), comment: newComment.trim(), createdBy: userName || userId });
      loadComments();
      setNewSection(''); setNewComment('');
    } catch {} finally { setAdding(false); }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await resolveReviewComment(caseData.id, commentId);
      loadComments();
    } catch {}
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteReviewComment(caseData.id, commentId);
      loadComments();
    } catch {}
  };

  const openCount = comments.filter(c => !c.isResolved).length;
  const resolvedCount = comments.filter(c => c.isResolved).length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{comments.length} Total</span>
        </div>
        {openCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{openCount} Open</span>
          </div>
        )}
        {resolvedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">{resolvedCount} Resolved</span>
          </div>
        )}
      </div>

      {/* Add Comment */}
      {!caseData.isLocked && (
        <SectionCard title="Add Comment" icon={Plus}>
          <div className="grid md:grid-cols-3 gap-3">
            <input type="text" value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="Section (e.g. Summary, Evidence)" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
            <div className="md:col-span-2 flex gap-2">
              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }} />
              <button onClick={handleAddComment} disabled={!newSection.trim() || !newComment.trim() || adding} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Comments List */}
      <SectionCard title={`Comments (${comments.length})`} icon={MessageSquare}>
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No comments yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add a comment to start a discussion</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className={`p-4 rounded-xl border transition-colors ${c.isResolved ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/30'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.section}</Badge>
                      {c.isResolved && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3" /> Resolved</Badge>}
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{c.comment}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.createdBy}</span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(c.createdAt)}</span>
                    </div>
                  </div>
                  {!caseData.isLocked && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!c.isResolved && (
                        <button onClick={() => handleResolveComment(c.id)} className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors" title="Mark as resolved">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteComment(c.id)} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" title="Delete comment">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────

function HistoryTab({ caseData }: { caseData: ConflictCase }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAudit(caseData.id);
        setAudit(data || []);
      } catch (err) { console.error('Failed to fetch audit trail:', err); } finally { setLoading(false); }
    })();
  }, [caseData.id]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <SectionCard title={`Audit Trail (${audit.length})`} icon={Clock}>
      {audit.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No audit entries</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4">
            {audit.map((entry, i) => (
              <div key={entry.id} className="relative">
                <div className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 border-blue-500 bg-white dark:bg-gray-800" />
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{entry.action.replace(/_/g, ' ')}</p>
                      {entry.details && (() => {
                        try {
                          const parsed = JSON.parse(entry.details);
                          const parts: string[] = [];
                          if (parsed.reason) parts.push(parsed.reason);
                          if (parsed.closureReason) parts.push(`Reason: ${parsed.closureReason.replace(/_/g, ' ').toLowerCase()}`);
                          if (parsed.closureSummary) parts.push(parsed.closureSummary);
                          if (parsed.previousStatus) parts.push(`Previous status: ${parsed.previousStatus.replace(/_/g, ' ').toLowerCase()}`);
                          if (parsed.verifiedViaEmail) parts.push('Verified via email');
                          if (parsed.documentCount !== undefined) parts.push(`${parsed.documentCount} document(s)`);
                          if (parsed.involvedEmployeesCount !== undefined) parts.push(`${parsed.involvedEmployeesCount} involved employee(s)`);
                          return parts.length > 0
                            ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{parts.join(' · ')}</p>
                            : null;
                        } catch {
                          return <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{entry.details}</p>;
                        }
                      })()}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatDateTime(entry.timestamp)}</span>
                  </div>
                  {(entry.userName || entry.user) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {entry.userName || (entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── MAIN CASE DETAIL CONTENT ─────────────────────────────────────────────────

function CaseDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<ConflictCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'analysis' | 'timeline'>('overview');
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCloseCaseModal, setShowCloseCaseModal] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await fetchCase(caseId);
      setCaseData(data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [caseId]);

  // Lazy-load full document content when Documents tab is opened
  const loadDocuments = useCallback(async () => {
    if (!caseId || docsLoaded) return;
    try {
      const docs = await fetchCaseDocuments(caseId);
      setCaseData(prev => prev ? { ...prev, documents: docs } : prev);
      setDocsLoaded(true);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, [caseId, docsLoaded]);

  useEffect(() => { loadCase(); }, [loadCase]);

  // Auto-open modal from query param (e.g. ?action=report or ?action=close)
  // Runs once when case data loads, then clears the param to prevent re-triggering
  useEffect(() => {
    if (!caseData || loading) return;
    const action = searchParams.get('action');
    if (!action) return;
    if (action === 'report') {
      setShowReportModal(true);
      setActiveTab('analysis');
    } else if (action === 'close') {
      setShowCloseCaseModal(true);
    }
    // Clear the query param so it doesn't re-trigger on re-renders
    router.replace(`/hr/case/${caseId}`, { scroll: false });
  }, [caseData, loading, searchParams, router, caseId]);

  // Load documents when Documents tab is selected
  useEffect(() => {
    if (activeTab === 'documents') {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  const handleDeleteCase = async () => {
    if (!caseData || caseData.isLocked) return;
    if (!confirm(`Are you sure you want to delete case ${caseData.caseNumber}? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteCase(caseData.id);
      router.push('/hr');
    } catch (err) {
      console.error('Failed to delete case:', err);
      alert('Failed to delete case. It may contain locked data.');
    } finally { setDeleting(false); }
  };

  const handleReopenCase = async () => {
    if (!caseData || !user) return;
    setSendingCode(true);
    setVerifyError('');
    try {
      const { maskedEmail: email } = await sendReopenCode(caseData.id, user.id || user.uid);
      setMaskedEmail(email);
      setCodeSentAt(Date.now());
      setVerifyCode(['', '', '', '', '', '']);
      setShowVerifyModal(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to send verification code.';
      alert(msg);
    } finally { setSendingCode(false); }
  };

  const handleVerifyAndReopen = async () => {
    if (!caseData || !user) return;
    const code = verifyCode.join('');
    if (code.length !== 6) {
      setVerifyError('Please enter the full 6-digit code.');
      return;
    }
    setVerifyLoading(true);
    setVerifyError('');
    try {
      await verifyReopenCode(caseData.id, {
        userId: user.id || user.uid,
        code,
        reason: 'Case re-opened via email verification',
      });
      setShowVerifyModal(false);
      loadCase();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Verification failed.';
      setVerifyError(msg);
    } finally { setVerifyLoading(false); }
  };

  const handleResendCode = async () => {
    if (!caseData || !user) return;
    setSendingCode(true);
    setVerifyError('');
    try {
      const { maskedEmail: email } = await sendReopenCode(caseData.id, user.id || user.uid);
      setMaskedEmail(email);
      setCodeSentAt(Date.now());
      setVerifyCode(['', '', '', '', '', '']);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to resend code.';
      setVerifyError(msg);
    } finally { setSendingCode(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading case...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">Case Not Found</h2>
          <button onClick={() => router.push('/hr')} className="mt-3 text-sm text-blue-600 hover:underline">Go to HR</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Eye },
    { id: 'documents' as const, label: 'Documents', icon: FileText, count: (caseData.documents || []).length },
    { id: 'analysis' as const, label: 'Analysis', icon: Brain },
    { id: 'timeline' as const, label: 'Timeline', icon: Clock },
  ];

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  return (
    <div className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900">

      {/* Case Closed — full page overlay */}
      {caseData.isLocked && caseData.status === 'CLOSED' ? (
        <div className="flex-1 flex items-center justify-center px-6 lg:px-8 py-4 relative">
          {/* Floating back button */}
          <button
            onClick={() => router.push('/hr')}
            className="absolute top-6 left-6 lg:left-8 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm z-10"
            title="Back to cases"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden w-full max-w-lg">
            <div className="flex flex-col items-center text-center py-8 px-6">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Case Closed</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                This case has been closed and locked. All documents, analysis results, and audit trail are preserved but cannot be modified.
              </p>
              <div className="w-full max-w-sm space-y-2 mb-6">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Case Number</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{caseData.caseNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{getCaseTypeLabel(caseData.type)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Closed & Locked</span>
                </div>
                {caseData.closureReason && (
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Closure Reason</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{caseData.closureReason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </div>
                )}
                {caseData.closedAt && (
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Closed On</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(caseData.closedAt)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <button
                  onClick={handleReopenCase}
                  disabled={sendingCode}
                  className="w-full px-6 py-3 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
                >
                  {sendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />} Re-Open Case
                </button>
                <button
                  onClick={() => router.push('/hr')}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Go Back to Cases
                </button>
              </div>
            </div>
          </div>

          {/* Email Verification Modal */}
          {showVerifyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-4">
                    <Shield className="w-7 h-7 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Verify Your Identity</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    We sent a 6-digit code to <span className="font-semibold text-gray-700 dark:text-gray-300">{maskedEmail}</span>
                  </p>

                  {/* 6 digit input boxes */}
                  <div className="flex gap-2 mb-4">
                    {verifyCode.map((digit, i) => (
                      <input
                        key={i}
                        id={`reopen-code-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        autoFocus={i === 0}
                        className="w-11 h-13 text-center text-xl font-bold rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (!val && !digit) return;
                          const newCode = [...verifyCode];
                          newCode[i] = val;
                          setVerifyCode(newCode);
                          setVerifyError('');
                          if (val && i < 5) {
                            document.getElementById(`reopen-code-${i + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !digit && i > 0) {
                            const newCode = [...verifyCode];
                            newCode[i - 1] = '';
                            setVerifyCode(newCode);
                            document.getElementById(`reopen-code-${i - 1}`)?.focus();
                          }
                          if (e.key === 'Enter' && verifyCode.join('').length === 6) {
                            handleVerifyAndReopen();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (!pasted) return;
                          const newCode = [...verifyCode];
                          for (let j = 0; j < 6; j++) {
                            newCode[j] = pasted[j] || '';
                          }
                          setVerifyCode(newCode);
                          const focusIdx = Math.min(pasted.length, 5);
                          document.getElementById(`reopen-code-${focusIdx}`)?.focus();
                        }}
                      />
                    ))}
                  </div>

                  {verifyError && (
                    <p className="text-sm text-red-500 mb-3">{verifyError}</p>
                  )}

                  <button
                    onClick={handleVerifyAndReopen}
                    disabled={verifyLoading || verifyCode.join('').length !== 6}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-3"
                  >
                    {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    Verify & Re-Open Case
                  </button>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Didn&apos;t receive the code?</span>
                    <button
                      onClick={handleResendCode}
                      disabled={sendingCode}
                      className="text-orange-500 hover:text-orange-600 font-semibold disabled:opacity-50"
                    >
                      {sendingCode ? 'Sending...' : 'Resend'}
                    </button>
                  </div>

                  <button
                    onClick={() => { setShowVerifyModal(false); setVerifyError(''); }}
                    className="mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
      <>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
        <div className="w-full px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/hr')}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Back to cases"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{caseData.caseNumber}</h1>
                <Badge className={getStatusColor(caseData.status)}>{getStatusLabel(caseData.status)}</Badge>
                <Badge className={getCaseTypeColor(caseData.type)}>{getCaseTypeLabel(caseData.type)}</Badge>
                {caseData.isLocked && <Badge className="bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"><Lock className="w-3 h-3" /> Locked</Badge>}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {caseData.department && `${caseData.department} • `}
                {caseData.location && `${caseData.location} • `}
                Created {formatDate(caseData.createdAt)}
              </p>
            </div>
            {!caseData.isLocked && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {activeTab === 'analysis' && (
                  <>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400"
                      title="Generate Report"
                    >
                      <FileDown className="w-4 h-4" /> Generate Report
                    </button>
                    <button
                      onClick={() => setShowCloseCaseModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400"
                      title="Close Case"
                    >
                      <Lock className="w-4 h-4" /> Close Case
                    </button>
                  </>
                )}
              </div>
            )}
            {caseData.isLocked && activeTab === 'analysis' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400"
                  title="Generate Report"
                >
                  <FileDown className="w-4 h-4" /> Generate Report
                </button>
              </div>
            )}
          </div>

          {/* Escalation Warning */}
          {caseData.status === 'ESCALATED' && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Case Escalated</p>
                <p className="text-xs text-red-600 dark:text-red-500">This case has been escalated and requires immediate attention from senior management.</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-5 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`w-full px-6 lg:px-8 ${activeTab === 'documents' ? 'flex-1 min-h-0 flex flex-col py-4' : 'py-8'}`}>
        {activeTab === 'overview' && <OverviewTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'documents' && <DocumentsTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} userName={userName} />}
        {activeTab === 'analysis' && <AnalysisTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'timeline' && <HistoryTab caseData={caseData} />}
      </div>

      {/* Modals */}
      {showCloseCaseModal && <CloseCaseModal caseData={caseData} userId={user?.id || ''} onClose={() => setShowCloseCaseModal(false)} onClosed={loadCase} />}
      {showReportModal && <GenerateReportModal caseData={caseData} onClose={() => setShowReportModal(false)} />}
      </>
      )}
    </div>
  );
}

// ─── PAGE EXPORT ──────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN']}>
      <CaseDetailContent />
    </ProtectedRoute>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
} from 'lucide-react';
import {
  ConflictCase,
  InvolvedEmployee,
  CaseDocument,
  AuditEntry,
  WorkplacePolicy,
  ComparisonResult,
  PolicyMatchResult,
  RecommendationResult,
  Recommendation,
  GeneratedActionDocument,
  DocumentEdit,
  ReviewComment,
  CaseStatus,
  ActionType,
  DocumentType,
  fetchCase,
  updateCase,
  deleteCase,
  closeCase,
  addEmployee,
  updateEmployee,
  removeEmployee,
  addDocument,
  removeDocument,
  fetchAudit,
  fetchPolicies,
  saveDocumentEdit,
  fetchDocumentEdits,
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${className}`}>{children}</span>;
}

function SectionCard({ title, icon: Icon, children, actions, collapsible, defaultOpen = true }: {
  title: string; icon?: any; children: React.ReactNode; actions?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
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
      {(!collapsible || open) && <div className="p-6">{children}</div>}
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

function DocumentsTab({ caseData, onUpdate, userId }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string;
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('complaint_a');
  const [docContent, setDocContent] = useState('');
  const [docName, setDocName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CaseDocument | null>(null);

  const docTypeLabels: Record<DocumentType, string> = {
    complaint_a: 'Complaint A',
    complaint_b: 'Complaint B',
    witness_statement: 'Witness Statement',
    prior_record: 'Prior Record',
    counseling_record: 'Counseling Record',
    warning_document: 'Warning Document',
    evidence: 'Evidence',
    other: 'Other',
  };

  const handleUpload = async () => {
    if (!docContent.trim()) return;
    setSaving(true);
    try {
      await addDocument(caseData.id, {
        type: docType,
        content: docContent.trim(),
        name: docName || docTypeLabels[docType],
        userId,
      });
      onUpdate();
      setShowUpload(false);
      setDocContent(''); setDocName('');
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setDocContent(text);
      setDocName(file.name);
    };
    reader.readAsText(file);
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
      const key = docTypeLabels[d.type] || d.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return groups;
  }, [docs]);

  return (
    <div className="space-y-6">
      <SectionCard
        title={`Documents (${docs.length})`}
        icon={FileText}
        actions={
          !caseData.isLocked && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Document List */}
            <div className="lg:col-span-1 space-y-2">
              {Object.entries(groupedDocs).map(([group, groupDocs]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{group}</p>
                  {groupDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
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
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(doc.createdAt)}</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Document Preview */}
            <div className="lg:col-span-2">
              {selectedDoc ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{selectedDoc.type.replace(/_/g, ' ')}</h4>
                    <span className="text-xs text-gray-400">{formatDateTime(selectedDoc.createdAt)}</span>
                  </div>
                  {selectedDoc.detectedLanguage && (
                    <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 mb-3">
                      Language: {selectedDoc.detectedLanguage}
                    </Badge>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                      {selectedDoc.originalText || selectedDoc.cleanedText || 'No text content'}
                    </pre>
                  </div>
                  {selectedDoc.translatedText && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Translated Version</p>
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                        {selectedDoc.translatedText}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-400 dark:text-gray-500">Select a document to preview</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Form */}
        {showUpload && (
          <div className="mt-4 p-5 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Upload Document</h4>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as DocumentType)}
                title="Document type"
                className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(docTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.doc,.docx,.pdf,.md"
                  onChange={handleFileUpload}
                  title="Upload file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-400 cursor-pointer hover:border-blue-400 transition-colors">
                  <FileUp className="w-4 h-4" />
                  <span>{docName || 'Choose file (txt/doc)...'}</span>
                </div>
              </div>
            </div>
            <textarea
              value={docContent}
              onChange={e => setDocContent(e.target.value)}
              rows={6}
              placeholder="Paste or type document content here..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => { setShowUpload(false); setDocContent(''); setDocName(''); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleUpload} disabled={!docContent.trim() || saving} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
              </button>
            </div>
          </div>
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
  const [step, setStep] = useState(0); // 0=ready, 1=comparing, 2=matching, 3=recommending
  const [error, setError] = useState('');
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);

  // Load saved results
  useEffect(() => {
    if (caseData.comparisonResult) try { setComparisonResult(JSON.parse(caseData.comparisonResult)); } catch {}
    if (caseData.policyMatchingResult) try { setPolicyResult(JSON.parse(caseData.policyMatchingResult)); } catch {}
    if (caseData.policyMatches) try { setPolicyResult(JSON.parse(caseData.policyMatches)); } catch {}
    if (caseData.recommendationResult) try { setRecommendationResult(JSON.parse(caseData.recommendationResult)); } catch {}
    if (caseData.recommendations) try { setRecommendationResult(JSON.parse(caseData.recommendations)); } catch {}
    if (caseData.selectedAction) setSelectedRecommendation(caseData.selectedAction);
  }, [caseData]);

  const docs = caseData.documents || [];
  const complaintA = docs.find(d => d.type === 'complaint_a');
  const complaintB = docs.find(d => d.type === 'complaint_b');
  const witnesses = docs.filter(d => d.type === 'witness_statement');
  const priorDocs = docs.filter(d => ['prior_record', 'counseling_record', 'warning_document'].includes(d.type));
  const employees = caseData.involvedEmployees || [];
  const complainantA = employees.find(e => e.isComplainant) || employees[0];
  const complainantB = employees.find((e, i) => e.isComplainant && i > 0) || employees[1];
  const canAnalyze = complaintA && complaintB;

  const loadPolicies = useCallback(async () => {
    if (!caseData.organizationId) return;
    try {
      const data = await fetchPolicies({ organizationId: caseData.organizationId });
      setPolicies(Array.isArray(data) ? data : []);
    } catch {}
  }, [caseData.organizationId]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const handleRunComparison = async () => {
    if (!complaintA || !complaintB) return;
    setStep(1); setError('');
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
        witnessStatements: witnesses.map(w => ({ witnessName: 'Witness', text: w.originalText || w.cleanedText || '' })),
        priorHistory: priorDocs.map(p => ({ type: p.type, summary: p.originalText || p.cleanedText || '' })),
      });
      setComparisonResult(result);
      await updateCase(caseData.id, { aiComparisonResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Analysis failed');
    } finally { setStep(0); }
  };

  const handleRunPolicyMatching = async () => {
    if (!comparisonResult) return;
    setStep(2); setError('');
    try {
      const allSections: any[] = [];
      policies.forEach(p => {
        if (p.sections && Array.isArray(p.sections)) {
          allSections.push(...p.sections);
        } else if (p.originalText) {
          allSections.push({ id: p.id, sectionNumber: '1', title: p.name, content: p.originalText, type: 'general', keywords: [] });
        }
      });
      if (allSections.length === 0) { setError('No policy sections available. Please add policies first.'); setStep(0); return; }
      const result = await runPolicyMatching({
        caseDetails: { caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', text: complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', text: complaintB?.originalText || '' },
        analysisResult: { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary },
        policySections: allSections,
      });
      setPolicyResult(result);
      await updateCase(caseData.id, { policyMatchesJson: result, policyMatchingResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Policy matching failed');
    } finally { setStep(0); }
  };

  const handleRunRecommendations = async () => {
    setStep(3); setError('');
    try {
      const result = await runDecisionSupport({
        caseDetails: { caseType: caseData.type, incidentDate: caseData.incidentDate || '', location: caseData.location || '', department: caseData.department || '' },
        complaintA: { employeeName: complainantA?.name || 'Party A', employeeId: complainantA?.employeeFileNo || undefined, text: complaintA?.originalText || '' },
        complaintB: { employeeName: complainantB?.name || 'Party B', employeeId: complainantB?.employeeFileNo || undefined, text: complaintB?.originalText || '' },
        analysisResult: comparisonResult ? { contradictions: comparisonResult.contradictions, agreementPoints: comparisonResult.agreementPoints, neutralSummary: comparisonResult.neutralSummary, emotionalLanguage: comparisonResult.emotionalLanguage } : undefined,
        policyMatches: policyResult?.matches?.map(m => ({ sectionTitle: m.sectionTitle, relevanceExplanation: m.relevanceExplanation, matchConfidence: m.matchConfidence })),
        priorHistory: priorDocs.length > 0 ? { hasPriorComplaints: priorDocs.some(d => d.type === 'prior_record'), hasPriorCounseling: priorDocs.some(d => d.type === 'counseling_record'), hasPriorWarnings: priorDocs.some(d => d.type === 'warning_document') } : undefined,
      });
      setRecommendationResult(result);
      await updateCase(caseData.id, { aiRecommendationsJson: result, recommendationResultJson: result, userId });
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Recommendation generation failed');
    } finally { setStep(0); }
  };

  const handleSelectRecommendation = async (rec: Recommendation) => {
    setSelectedRecommendation(rec.id);
    try {
      const targetIds = rec.targetEmployeeNames?.map(name => {
        const emp = employees.find(e => e.name.toLowerCase().includes(name.toLowerCase()));
        return emp?.id;
      }).filter(Boolean) || [];
      await updateCase(caseData.id, {
        selectedActionType: rec.type,
        selectedTargetEmployeeIdsJson: targetIds,
        status: 'awaiting_action',
        userId,
      });
      onUpdate();
    } catch (err) { console.error(err); }
  };

  const pipelineSteps = [
    { num: 1, label: 'Compare Complaints', icon: Brain, done: !!comparisonResult, active: step === 1 },
    { num: 2, label: 'Match Policies', icon: Shield, done: !!policyResult, active: step === 2 },
    { num: 3, label: 'Get Recommendations', icon: Target, done: !!recommendationResult, active: step === 3 },
  ];

  return (
    <div className="space-y-6">
      {/* Pipeline Progress */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" /> AI Analysis Pipeline
        </h3>
        <div className="flex items-center gap-2">
          {pipelineSteps.map((ps, i) => (
            <div key={ps.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-3 flex-1 p-3 rounded-xl transition-all ${
                ps.active ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' :
                ps.done ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' :
                'bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600'
              }`}>
                <div className={`p-2 rounded-lg ${
                  ps.active ? 'bg-blue-100 dark:bg-blue-900/30' :
                  ps.done ? 'bg-green-100 dark:bg-green-900/30' :
                  'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {ps.active ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> :
                   ps.done ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                   <ps.icon className="w-4 h-4 text-gray-400" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Step {ps.num}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ps.label}</p>
                </div>
              </div>
              {i < pipelineSteps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {!canAnalyze && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Upload both Complaint A and Complaint B documents to begin analysis.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </p>
          </div>
        )}

        {canAnalyze && !caseData.isLocked && (
          <div className="flex items-center gap-3 mt-4">
            {!comparisonResult && (
              <button onClick={handleRunComparison} disabled={step > 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/25">
                {step === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} Run Comparison
              </button>
            )}
            {comparisonResult && !policyResult && policies.length > 0 && (
              <button onClick={handleRunPolicyMatching} disabled={step > 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-purple-600/25">
                {step === 2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Match Policies
              </button>
            )}
            {comparisonResult && !recommendationResult && (
              <button onClick={handleRunRecommendations} disabled={step > 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25">
                {step === 3 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} Get Recommendations
              </button>
            )}
            {(comparisonResult || policyResult || recommendationResult) && (
              <button
                onClick={() => { setComparisonResult(null); setPolicyResult(null); setRecommendationResult(null); setSelectedRecommendation(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Re-run All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <SectionCard title="Complaint Comparison" icon={Brain} collapsible>
          <div className="space-y-5">
            {/* Summary */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">Neutral Summary</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{comparisonResult.neutralSummary}</p>
            </div>

            {/* Side by Side */}
            {(comparisonResult.sideBySideComparison || []).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Side-by-Side Comparison</h4>
                <div className="space-y-2">
                  {(comparisonResult.sideBySideComparison || []).map((item, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                        item.status === 'agreement' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        item.status === 'contradiction' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                        item.status === 'partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {item.topic} — {item.status}
                      </div>
                      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
                        <div className="p-4">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{comparisonResult.partyAName || 'Party A'}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{item.partyAVersion}</p>
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{comparisonResult.partyBName || 'Party B'}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{item.partyBVersion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Findings Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {(comparisonResult.agreementPoints || []).length > 0 && (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Agreement Points</h4>
                  <ul className="space-y-1">{(comparisonResult.agreementPoints || []).map((p, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-green-500 mt-1">•</span>{p}</li>)}</ul>
                </div>
              )}
              {(comparisonResult.contradictions || []).length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Contradictions</h4>
                  <ul className="space-y-1">{(comparisonResult.contradictions || []).map((p, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-red-500 mt-1">•</span>{p}</li>)}</ul>
                </div>
              )}
              {(comparisonResult.timelineDifferences || []).length > 0 && (
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                  <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Timeline Differences</h4>
                  <ul className="space-y-1">{(comparisonResult.timelineDifferences || []).map((p, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-orange-500 mt-1">•</span>{p}</li>)}</ul>
                </div>
              )}
              {(comparisonResult.missingDetails || []).length > 0 && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Missing Details</h4>
                  <ul className="space-y-1">{(comparisonResult.missingDetails || []).map((p, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-gray-500 mt-1">•</span>{p}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Policy Match Results */}
      {policyResult && (
        <SectionCard title="Policy Alignment" icon={Shield} collapsible>
          <div className="space-y-4">
            {policyResult.overallGuidance && (
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">Overall Guidance</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{policyResult.overallGuidance}</p>
              </div>
            )}
            {(policyResult.matches || []).map((m, i) => (
              <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.sectionNumber}. {m.sectionTitle}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{m.relevanceExplanation}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${m.matchConfidence * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{Math.round(m.matchConfidence * 100)}%</span>
                  </div>
                </div>
                {(m.keyPhrases || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(m.keyPhrases || []).map((kp, j) => <Badge key={j} className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{kp}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recommendations */}
      {recommendationResult && (
        <SectionCard title="AI Recommendations" icon={Target} collapsible>
          <div className="space-y-4">
            {recommendationResult.supervisorGuidance && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Supervisor Guidance</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{recommendationResult.supervisorGuidance}</p>
              </div>
            )}
            <div className="grid gap-4">
              {(recommendationResult.recommendations || []).map(rec => (
                <div
                  key={rec.id}
                  className={`p-5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedRecommendation === rec.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 shadow-lg'
                      : rec.id === recommendationResult.primaryRecommendation
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => !caseData.isLocked && handleSelectRecommendation(rec)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{rec.title}</h4>
                        {rec.id === recommendationResult.primaryRecommendation && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Award className="w-3 h-3" /> Recommended</Badge>
                        )}
                        {selectedRecommendation === rec.id && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><CheckCircle2 className="w-3 h-3" /> Selected</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.description}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getRiskBgColor(rec.riskLevel)} ${getRiskColor(rec.riskLevel)}`}>
                      {rec.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Rationale</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{rec.rationale}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Next Steps</p>
                      <ul className="space-y-0.5">{(rec.nextSteps || []).map((s, i) => <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">•</span>{s}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Details</p>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <p>Type: <span className="font-medium capitalize">{rec.type}</span></p>
                        <p>Timeframe: <span className="font-medium">{rec.timeframe}</span></p>
                        <p>Confidence: <span className="font-medium">{Math.round(rec.confidence * 100)}%</span></p>
                        {(rec.targetEmployeeNames || []).length > 0 && <p>Target: <span className="font-medium">{(rec.targetEmployeeNames || []).join(', ')}</span></p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── ACTIONS TAB ──────────────────────────────────────────────────────────────

function ActionsTab({ caseData, onUpdate, userId }: {
  caseData: ConflictCase; onUpdate: () => void; userId: string;
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
  const complaintA = docs.find(d => d.type === 'complaint_a');
  const complaintB = docs.find(d => d.type === 'complaint_b');
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
          {generatedDoc && (
            <SectionCard title={`Generated ${actionLabels[generatedDoc.actionType] || 'Document'}`} icon={FileText} collapsible>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <GeneratedDocumentDisplay document={generatedDoc} />
              </div>
            </SectionCard>
          )}
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
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSection, setNewSection] = useState('');
  const [newComment, setNewComment] = useState('');
  const [adding, setAdding] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState(caseData.supervisorNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

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

      {/* Review Comments */}
      <SectionCard title={`Review Comments (${comments.length})`} icon={MessageSquare}>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className={`p-4 rounded-xl border ${c.isResolved ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{c.section}</Badge>
                      {c.isResolved && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3" /> Resolved</Badge>}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{c.comment}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.createdBy} — {formatDateTime(c.createdAt)}</p>
                  </div>
                  {!caseData.isLocked && (
                    <div className="flex items-center gap-1">
                      {!c.isResolved && (
                        <button onClick={() => handleResolveComment(c.id)} className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors" title="Resolve">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteComment(c.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No review comments yet</p>}
          </div>
        )}

        {/* Add Comment */}
        {!caseData.isLocked && (
          <div className="mt-4 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/20">
            <div className="grid md:grid-cols-3 gap-3">
              <input type="text" value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="Section (e.g. Summary, Evidence)" className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              <div className="md:col-span-2 flex gap-2">
                <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }} />
                <button onClick={handleAddComment} disabled={!newSection.trim() || !newComment.trim() || adding} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
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
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient Evidence' },
    { value: 'WITHDRAWN', label: 'Withdrawn' },
    { value: 'ESCALATED', label: 'Escalated' },
    { value: 'MEDIATED', label: 'Mediated' },
    { value: 'OTHER', label: 'Other' },
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
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Lock className="w-5 h-5 text-red-500" /> Close & Lock Case</h2>
          <button onClick={onClose} title="Close" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This action is permanent. The case will be locked and cannot be edited.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Closure Reason <span className="text-red-500">*</span></label>
            <select value={reason} onChange={e => setReason(e.target.value)} title="Closure reason" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors">
              <option value="">Select reason...</option>
              {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Closure Summary</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Summary of resolution..." className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition-colors resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleClose} disabled={!reason || closing} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Close Case
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE TAB ─────────────────────────────────────────────────────────────

function TimelineTab({ caseData }: { caseData: ConflictCase }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAudit(caseData.id);
        setAudit(data || []);
      } catch {} finally { setLoading(false); }
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
                      {entry.details && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{entry.details}</p>}
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
  const { user } = useAuth();
  const caseId = params?.id as string;

  const [caseData, setCaseData] = useState<ConflictCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'analysis' | 'actions' | 'review' | 'timeline'>('overview');
  const [deleting, setDeleting] = useState(false);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await fetchCase(caseId);
      setCaseData(data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { loadCase(); }, [loadCase]);

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
    { id: 'actions' as const, label: 'Actions', icon: Gavel },
    { id: 'review' as const, label: 'Review', icon: ClipboardCheck },
    { id: 'timeline' as const, label: 'Timeline', icon: Clock },
  ];

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
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
              <button
                onClick={handleDeleteCase}
                disabled={deleting}
                className="p-2.5 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                title="Delete case"
              >
                {deleting ? <Loader2 className="w-4 h-4 text-red-500 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-500" />}
              </button>
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

          {/* Status Progress Stepper */}
          {(() => {
            const statusSteps = [
              { key: 'DRAFT', label: 'Draft', icon: Edit3 },
              { key: 'IN_PROGRESS', label: 'In Progress', icon: Clock },
              { key: 'PENDING_REVIEW', label: 'Review', icon: Eye },
              { key: 'AWAITING_ACTION', label: 'Action', icon: Gavel },
              { key: 'CLOSED', label: 'Closed', icon: Lock },
            ];
            const statusOrder = statusSteps.map(s => s.key);
            const currentIdx = statusOrder.indexOf(caseData.status);
            const isEscalated = caseData.status === 'ESCALATED';
            return (
              <div className="mt-4 flex items-center gap-1">
                {statusSteps.map((step, i) => {
                  const isCurrent = step.key === caseData.status;
                  const isPast = !isEscalated && currentIdx >= 0 && i < currentIdx;
                  const StepIcon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center gap-1 flex-1">
                      <div className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg transition-all ${
                        isCurrent
                          ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                          : isPast
                          ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-700/20 border border-gray-200 dark:border-gray-700'
                      }`}>
                        <div className={`p-1 rounded-md ${
                          isCurrent ? 'bg-blue-200 dark:bg-blue-800/50' :
                          isPast ? 'bg-green-200 dark:bg-green-800/50' :
                          'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          {isPast ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <StepIcon className={`w-3 h-3 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                          )}
                        </div>
                        <span className={`text-xs font-medium truncate ${
                          isCurrent ? 'text-blue-700 dark:text-blue-400' :
                          isPast ? 'text-green-700 dark:text-green-400' :
                          'text-gray-400 dark:text-gray-500'
                        }`}>{step.label}</span>
                      </div>
                      {i < statusSteps.length - 1 && (
                        <ChevronRight className={`w-3 h-3 flex-shrink-0 ${isPast ? 'text-green-400' : 'text-gray-300 dark:text-gray-600'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
      <div className="w-full px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'documents' && <DocumentsTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'analysis' && <AnalysisTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'actions' && <ActionsTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} />}
        {activeTab === 'review' && <ReviewTab caseData={caseData} onUpdate={loadCase} userId={user?.id || ''} userName={userName} />}
        {activeTab === 'timeline' && <TimelineTab caseData={caseData} />}
      </div>
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

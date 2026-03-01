// HR Conflict Resolution API Library
// Interfaces + API functions for the HR module

import api from './api';
import { apiWithExtendedTimeout } from './api';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type CaseType = 'CONFLICT' | 'CONDUCT' | 'SAFETY' | 'OTHER';
export type CaseStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'AWAITING_ACTION' | 'CLOSED' | 'ESCALATED';
export type DocumentType = 'complaint_a' | 'complaint_b' | 'witness_statement' | 'prior_record' | 'counseling_record' | 'warning_document' | 'evidence' | 'other';
export type ActionType = 'coaching' | 'counseling' | 'warning' | 'escalate';
export type ComparisonStatus = 'agreement' | 'contradiction' | 'partial' | 'unclear';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type ClosureReason = 'RESOLVED' | 'INSUFFICIENT_EVIDENCE' | 'WITHDRAWN' | 'ESCALATED' | 'MEDIATED' | 'OTHER';

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface ConflictCase {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  incidentDate: string | null;
  location: string | null;
  department: string | null;
  shift: string | null;
  comparisonResult: string | null;
  recommendations: string | null;
  selectedAction: string | null;
  generatedDocument: string | null;
  fullGeneratedDocumentResult: string | null;
  policyMatches: string | null;
  supervisorNotes: string | null;
  activePolicyId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closureReason: string | null;
  closureSummary: string | null;
  isLocked: boolean;
  createdBy: string;
  organizationId: string;
  facilityId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; firstName: string; lastName: string; email: string };
  organization?: { id: string; name: string };
  facility?: { id: string; name: string } | null;
  involvedEmployees?: InvolvedEmployee[];
  documents?: CaseDocument[];
  auditLog?: AuditEntry[];
  recommendationResult?: string | null;
  policyMatchingResult?: string | null;
  selectedTargetEmployeeIds?: string | null;
}

export interface InvolvedEmployee {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  employeeFileNo: string | null;
  isComplainant: boolean;
  statement?: string | null;
}

export interface CaseDocument {
  id: string;
  type: DocumentType;
  originalText: string | null;
  cleanedText: string | null;
  translatedText: string | null;
  originalImageUrls: string | null;
  processedImageUrls: string | null;
  detectedLanguage: string | null;
  isHandwritten: boolean;
  pageCount: number;
  employeeId: string | null;
  submittedBy: string | null;
  signatureImageData: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  caseId: string;
  action: string;
  details: string | null;
  userId: string | null;
  userName: string | null;
  timestamp: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

export interface WorkplacePolicy {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string | null;
  effectiveDate: string | null;
  documentFileName: string | null;
  documentFileUrl: string | null;
  documentFileType: string | null;
  documentPageCount: number | null;
  originalText: string | null;
  sections: PolicySection[] | null;
  createdBy: string;
  organizationId: string;
  facilityId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; firstName: string; lastName: string; email: string };
  organization?: { id: string; name: string };
}

export interface PolicySection {
  id: string;
  sectionNumber: string;
  title: string;
  content: string;
  type: string;
  keywords: string[];
}

export interface DocumentEdit {
  id: string;
  caseId: string;
  sectionId: string;
  sectionTitle: string;
  originalContent: string;
  newContent: string;
  editedBy: string;
  createdAt: string;
}

export interface ReviewComment {
  id: string;
  caseId: string;
  section: string;
  comment: string;
  createdBy: string;
  isResolved: boolean;
  createdAt: string;
}

// ─── AI Analysis Models ───────────────────────────────────────────────────────

export interface SideBySideComparison {
  topic: string;
  partyAVersion: string;
  partyBVersion: string;
  status: ComparisonStatus;
}

export interface ComparisonResult {
  timelineDifferences: string[];
  agreementPoints: string[];
  contradictions: string[];
  emotionalLanguage: string[];
  missingDetails: string[];
  neutralSummary: string;
  sideBySideComparison: SideBySideComparison[];
  witnessAnalysis?: string[];
  priorHistoryAnalysis?: string[];
  generatedAt: string;
  partyAName: string;
  partyBName: string;
}

export interface PolicyMatch {
  sectionId: string;
  sectionNumber: string;
  sectionTitle: string;
  relevanceExplanation: string;
  matchConfidence: number;
  keyPhrases: string[];
}

export interface PolicyMatchResult {
  matches: PolicyMatch[];
  overallGuidance: string;
  generatedAt: string;
}

export interface Recommendation {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  rationale: string;
  riskLevel: RiskLevel;
  riskExplanation: string;
  nextSteps: string[];
  timeframe: string;
  confidence: number;
  targetEmployeeNames: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  primaryRecommendation: string;
  supervisorGuidance: string;
  generatedAt: string;
  employeeNames: { complaintA: string; complaintB: string };
}

export interface GeneratedActionDocument {
  actionType: ActionType;
  document: any; // Varies by action type
  generatedAt: string;
  isEditable: boolean;
}

// ─── Analytics Models ─────────────────────────────────────────────────────────

export interface CaseAnalytics {
  summary: {
    totalCases: number;
    activeCases: number;
    closedCases: number;
    escalatedCases: number;
    resolutionRate: number;
  };
  resolutionMetrics: {
    averageDays: number;
    minDays: number;
    maxDays: number;
    totalResolved: number;
  };
  statusBreakdown: { status: string; count: number }[];
  typeBreakdown: { type: string; count: number }[];
  closureReasonBreakdown: { reason: string; count: number }[];
  actionTypeBreakdown: { actionType: string; count: number }[];
  monthlyTrends: { month: string; created: number; closed: number }[];
  departmentBreakdown: { department: string; total: number; active: number; closed: number }[];
  generatedAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ─── API Functions ────────────────────────────────────────────────────────────

// --- Conflict Cases ---

export async function fetchCases(params: {
  organizationId: string;
  createdBy?: string;
  status?: string;
  caseType?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ConflictCase>> {
  const { data } = await api.get('/conflict-cases', { params });
  return data;
}

export async function fetchCase(id: string): Promise<ConflictCase> {
  const { data } = await api.get(`/conflict-cases/${id}`);
  return data.data;
}

export async function createCase(payload: {
  caseNumber: string;
  creatorId: string;
  organizationId: string;
  caseType?: string;
  incidentDate?: string;
  location?: string;
  department?: string;
  shift?: string;
  description?: string;
  employeesJson?: any[];
  documentsJson?: any[];
  facilityId?: string;
}): Promise<ConflictCase> {
  const { data } = await api.post('/conflict-cases', payload);
  return data.data;
}

export async function updateCase(id: string, payload: Record<string, any>): Promise<ConflictCase> {
  const { data } = await api.patch(`/conflict-cases/${id}`, payload);
  return data.data;
}

export async function deleteCase(id: string): Promise<void> {
  await api.delete(`/conflict-cases/${id}`);
}

export async function closeCase(id: string, payload: {
  closureReason: string;
  closedBy: string;
  closureSummary?: string;
  supervisorNotes?: string;
  includeAuditTrail?: boolean;
  includeAllDocuments?: boolean;
}): Promise<ConflictCase> {
  const { data } = await api.post(`/conflict-cases/${id}/close`, payload);
  return data.data;
}

// --- Involved Employees ---

export async function addEmployee(caseId: string, payload: {
  name: string;
  role?: string;
  department?: string;
  employeeId?: string;
  isComplainant?: boolean;
  statement?: string;
  userId?: string;
}): Promise<InvolvedEmployee> {
  const { data } = await api.post(`/conflict-cases/${caseId}/employees`, payload);
  return data.data;
}

export async function updateEmployee(caseId: string, employeeId: string, payload: Record<string, any>): Promise<InvolvedEmployee> {
  const { data } = await api.patch(`/conflict-cases/${caseId}/employees/${employeeId}`, payload);
  return data.data;
}

export async function removeEmployee(caseId: string, employeeId: string, userId?: string): Promise<void> {
  await api.delete(`/conflict-cases/${caseId}/employees/${employeeId}`, { params: { userId } });
}

// --- Documents ---

export async function addDocument(caseId: string, payload: {
  name?: string;
  type: DocumentType;
  content?: string;
  extractedText?: string;
  originalText?: string;
  cleanedText?: string;
  translatedText?: string;
  originalImageUrls?: string[];
  processedImageUrls?: string[];
  detectedLanguage?: string;
  isHandwritten?: boolean;
  pageCount?: number;
  employeeId?: string;
  submittedBy?: string;
  userId?: string;
}): Promise<CaseDocument> {
  const { data } = await api.post(`/conflict-cases/${caseId}/documents`, payload);
  return data.data;
}

export async function removeDocument(caseId: string, documentId: string, userId?: string): Promise<void> {
  await api.delete(`/conflict-cases/${caseId}/documents/${documentId}`, { params: { userId } });
}

// --- Audit ---

export async function fetchAudit(caseId: string): Promise<AuditEntry[]> {
  const { data } = await api.get(`/conflict-cases/${caseId}/audit`);
  return data.data;
}

// --- Document Edits ---

export async function saveDocumentEdit(caseId: string, payload: {
  sectionId: string;
  sectionTitle: string;
  originalContent: string;
  newContent: string;
  editedBy: string;
}): Promise<DocumentEdit> {
  const { data } = await api.post(`/conflict-cases/${caseId}/document-edits`, payload);
  return data.data;
}

export async function fetchDocumentEdits(caseId: string): Promise<{ data: DocumentEdit[]; count: number }> {
  const { data } = await api.get(`/conflict-cases/${caseId}/document-edits`);
  return data;
}

export async function deleteDocumentEdit(caseId: string, editId: string): Promise<void> {
  await api.delete(`/conflict-cases/${caseId}/document-edits/${editId}`);
}

// --- Review Comments ---

export async function addReviewComment(caseId: string, payload: {
  section: string;
  comment: string;
  createdBy: string;
}): Promise<ReviewComment> {
  const { data } = await api.post(`/conflict-cases/${caseId}/review-comments`, payload);
  return data.data;
}

export async function fetchReviewComments(caseId: string): Promise<{ data: ReviewComment[]; count: number }> {
  const { data } = await api.get(`/conflict-cases/${caseId}/review-comments`);
  return data;
}

export async function resolveReviewComment(caseId: string, commentId: string): Promise<ReviewComment> {
  const { data } = await api.patch(`/conflict-cases/${caseId}/review-comments/${commentId}/resolve`);
  return data.data;
}

export async function deleteReviewComment(caseId: string, commentId: string): Promise<void> {
  await api.delete(`/conflict-cases/${caseId}/review-comments/${commentId}`);
}

// --- Analytics ---

export async function fetchAnalytics(params: {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  facilityId?: string;
}): Promise<CaseAnalytics> {
  const { data } = await api.get('/conflict-cases/analytics', { params });
  return data.data;
}

// --- Workplace Policies ---

export async function fetchPolicies(params: {
  organizationId: string;
  status?: string;
}): Promise<WorkplacePolicy[]> {
  const { data } = await api.get('/conflict-cases/workplace-policies', { params });
  return data.data;
}

export async function fetchPolicy(id: string): Promise<WorkplacePolicy> {
  const { data } = await api.get(`/conflict-cases/workplace-policies/${id}`);
  return data.data;
}

export async function createPolicy(payload: {
  name: string;
  version: string;
  createdBy: string;
  organizationId: string;
  effectiveDate?: string;
  status?: string;
  description?: string;
  documentFileName?: string;
  documentFileUrl?: string;
  documentFileType?: string;
  documentPageCount?: number;
  originalText?: string;
  sections?: any;
  facilityId?: string;
}): Promise<WorkplacePolicy> {
  const { data } = await api.post('/conflict-cases/workplace-policies', payload);
  return data.data;
}

export async function updatePolicy(id: string, payload: Record<string, any>): Promise<WorkplacePolicy> {
  const { data } = await api.patch(`/conflict-cases/workplace-policies/${id}`, payload);
  return data.data;
}

export async function deletePolicy(id: string): Promise<void> {
  await api.delete(`/conflict-cases/workplace-policies/${id}`);
}

// ─── AI Analysis Functions ────────────────────────────────────────────────────

export async function runComparison(payload: {
  complaintA: { employeeName: string; originalText: string; translatedText?: string; cleanedText?: string };
  complaintB: { employeeName: string; originalText: string; translatedText?: string; cleanedText?: string };
  caseDetails: { incidentDate: string; location: string; department: string };
  witnessStatements?: { witnessName: string; text: string }[];
  priorHistory?: { type: string; documentDate?: string; summary: string; employeeName?: string }[];
}): Promise<ComparisonResult> {
  const result = await apiWithExtendedTimeout<{ success: boolean; data: ComparisonResult }>({
    method: 'POST',
    url: '/conflict-analysis/compare',
    data: payload,
  }, 180000);
  return result.data;
}

export async function runPolicyMatching(payload: {
  caseDetails: { caseType: string; incidentDate: string; location: string; department: string };
  complaintA: { employeeName: string; text: string };
  complaintB: { employeeName: string; text: string };
  analysisResult?: { contradictions: string[]; agreementPoints: string[]; neutralSummary: string };
  witnessStatements?: { witnessName: string; text: string }[];
  policySections: PolicySection[];
}): Promise<PolicyMatchResult> {
  const result = await apiWithExtendedTimeout<{ success: boolean; data: PolicyMatchResult }>({
    method: 'POST',
    url: '/policy-matching/match',
    data: payload,
  }, 180000);
  return result.data;
}

export async function runDecisionSupport(payload: {
  caseDetails: { caseType: string; incidentDate: string; location: string; department: string };
  complaintA: { employeeName: string; employeeId?: string; text: string };
  complaintB: { employeeName: string; employeeId?: string; text: string };
  analysisResult?: { contradictions: string[]; agreementPoints: string[]; neutralSummary: string; emotionalLanguage?: string[] };
  policyMatches?: { sectionTitle: string; relevanceExplanation: string; matchConfidence: number }[];
  witnessStatements?: { witnessName: string; text: string }[];
  priorHistory?: { hasPriorComplaints: boolean; hasPriorCounseling: boolean; hasPriorWarnings: boolean; notes?: string };
}): Promise<RecommendationResult> {
  const result = await apiWithExtendedTimeout<{ success: boolean; data: RecommendationResult }>({
    method: 'POST',
    url: '/decision-support/recommendations',
    data: payload,
  }, 180000);
  return result.data;
}

export async function generateActionDocument(payload: {
  actionType: ActionType;
  caseDetails: { caseNumber: string; caseType: string; incidentDate: string; location: string; department: string };
  complaintA: { employeeName: string; text: string };
  complaintB: { employeeName: string; text: string };
  analysisResult?: { contradictions: string[]; agreementPoints: string[]; neutralSummary: string };
  policyMatches?: { sectionNumber: string; sectionTitle: string; relevanceExplanation: string }[];
  recommendationRationale?: string;
  supervisorName?: string;
  targetEmployeeNames?: string[];
}): Promise<GeneratedActionDocument> {
  const result = await apiWithExtendedTimeout<{ success: boolean; data: GeneratedActionDocument }>({
    method: 'POST',
    url: '/action-generation/generate',
    data: payload,
  }, 180000);
  return result.data;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function generateCaseNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HR-${y}${m}${d}-${rnd}`;
}

export function getStatusColor(status: CaseStatus): string {
  const map: Record<CaseStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    AWAITING_ACTION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    CLOSED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ESCALATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] || map.DRAFT;
}

export function getStatusLabel(status: CaseStatus): string {
  const map: Record<CaseStatus, string> = {
    DRAFT: 'Draft',
    IN_PROGRESS: 'In Progress',
    PENDING_REVIEW: 'Pending Review',
    AWAITING_ACTION: 'Awaiting Action',
    CLOSED: 'Closed',
    ESCALATED: 'Escalated',
  };
  return map[status] || status;
}

export function getCaseTypeLabel(type: CaseType): string {
  const map: Record<CaseType, string> = {
    CONFLICT: 'Workplace Conflict',
    CONDUCT: 'Conduct Issue',
    SAFETY: 'Safety Concern',
    OTHER: 'Other',
  };
  return map[type] || type;
}

export function getCaseTypeColor(type: CaseType): string {
  const map: Record<CaseType, string> = {
    CONFLICT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    CONDUCT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    SAFETY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
  return map[type] || map.OTHER;
}

export function getRiskColor(risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: 'text-green-600 dark:text-green-400',
    moderate: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-600 dark:text-red-400',
  };
  return map[risk] || map.low;
}

export function getRiskBgColor(risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: 'bg-green-100 dark:bg-green-900/30',
    moderate: 'bg-yellow-100 dark:bg-yellow-900/30',
    high: 'bg-orange-100 dark:bg-orange-900/30',
    critical: 'bg-red-100 dark:bg-red-900/30',
  };
  return map[risk] || map.low;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

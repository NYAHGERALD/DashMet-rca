/**
 * Vacation Hub API Service
 * All CRUD operations for the Vacation Management page.
 */
import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VacationEmployee {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string | null;
  department: string | null;
  shift: string | null;
  workline: string | null;
  workarea: string | null;
  allocatedVacationHours: number;
  annualAllocation: number | null;
  maxAccumulatedHours: number | null;
  vacationScheduleYears: number[];
  vacationScheduleHours: number[];
}

export interface VacationRequest {
  id: number;
  employeeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  returnToWork: string | null;
  reason: string;
  coveragePlan: string | null;
  emergencyPhone: string | null;
  emergencyEmail: string | null;
  autoApprove: boolean;
  status: string;
  departmentSnapshot: string | null;
  roleSnapshot: string | null;
  shiftSnapshot: string | null;
  worklineSnapshot: string | null;
  workareaSnapshot: string | null;
  statusHistory: any;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  Employee?: { firstName: string; lastName: string; email?: string; role?: string; allocatedVacationHours?: number };
  ApprovedByUser?: { firstName: string; lastName: string } | null;
  RequestedByUser?: { firstName: string; lastName: string } | null;
}

export interface VacationStats {
  total_requests: number;
  pending: number;
  approved: number;
  denied: number;
  cancelled: number;
  days_used_ytd: number;
  total_employees: number;
}

export interface VacationSettings {
  id?: number;
  standardAllocationDays: number;
  minimumNoticeDays: number;
  maxConsecutiveDays: number;
  minTeamCoveragePercent: number;
  maxSimultaneousAbsences: number;
  criticalRoleCoverageRequired: boolean;
}

export interface BlackoutPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface VacationConflict {
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  conflicting_requests?: any[];
  details?: Record<string, string>;
  period?: { start: string; end: string };
}

export interface VacationNotification {
  id: number;
  employeeId: number;
  notificationType: string;
  title: string;
  message: string;
  relatedVacationId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  Employee?: { firstName: string; lastName: string };
  RelatedVacation?: { startDate: string; endDate: string; status: string } | null;
}

export interface EmployeeDirectoryEntry {
  id: number;
  firstname: string;
  lastname: string;
  role: string;
  department: string | null;
  shift: string | null;
  workline: string | null;
  workarea: string | null;
  phone: string | null;
  employeeCode: string | null;
  vacation_balance_days: number;
  vacation_days_used: number;
  current_status: 'available' | 'on_vacation';
  return_date: string | null;
  upcoming_vacation: boolean;
  upcoming_start: string | null;
  upcoming_end: string | null;
  upcoming_status: string | null;
}

export interface MyVacationStats {
  total_days: number;
  days_used: number;
  days_remaining: number;
  pending: number;
  approved_count: number;
}

export interface ActivityLogEntry extends VacationRequest {
  activity_type: string;
  activity_timestamp: string;
  approved_by_username: string | null;
  requested_by_username: string | null;
}

export interface FormDropdowns {
  departments: { id: string; name: string; facilityId: string }[];
  shifts: { id: string; name: string; startTime: string; endTime: string; facilityId: string | null }[];
  lines: { id: string; name: string; lineNumber: string | null; areaId: string }[];
  areas: { id: string; name: string; departmentId: string | null }[];
  shiftLines: { shiftId: string; lineId: string }[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

// Get form dropdown options (Department, Shift, Line, Area)
export async function getFormDropdowns(): Promise<FormDropdowns> {
  const res = await api.get('/vacation/dropdowns');
  return res.data.data;
}

// Create vacation request
export async function createVacationRequest(data: {
  employeeId?: number;
  firstName?: string;
  lastName?: string;
  department?: string;
  shift?: string;
  line?: string;
  area?: string;
  phone?: string;
  employeeCode?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  durationHours?: number;
  returnToWork?: string;
  reason?: string;
  coveragePlan?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  autoApprove?: boolean;
}): Promise<VacationRequest> {
  const res = await api.post('/vacation', data);
  return res.data.data;
}

// Get vacation stats
export async function getVacationStats(): Promise<VacationStats> {
  const res = await api.get('/vacation/stats');
  return res.data.data;
}

// Get upcoming vacations
export async function getUpcomingVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/upcoming');
  return res.data.data;
}

// Get pending vacations
export async function getPendingVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/pending');
  return res.data.data;
}

// Get recent vacations
export async function getRecentVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/recent');
  return res.data.data;
}

// Get all requests
export async function getVacationRequests(status?: string): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/requests', { params: { status: status || 'all' } });
  return res.data.data;
}

// Get vacation details
export async function getVacationDetails(id: number): Promise<VacationRequest> {
  const res = await api.get(`/vacation/${id}`);
  return res.data.data;
}

// Update vacation
export async function updateVacation(id: number, data: {
  startDate: string;
  endDate: string;
  leaveType?: string;
  reason?: string;
  durationDays?: number;
}): Promise<VacationRequest> {
  const res = await api.put(`/vacation/${id}`, data);
  return res.data.data;
}

// Approve vacation
export async function approveVacation(id: number, reason?: string): Promise<VacationRequest> {
  const res = await api.post(`/vacation/${id}/approve`, { reason });
  return res.data.data;
}

// Deny vacation
export async function denyVacation(id: number, reason: string): Promise<VacationRequest> {
  const res = await api.post(`/vacation/${id}/deny`, { reason });
  return res.data.data;
}

// Activity Log
export async function getVacationActivityLog(options?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<ActivityLogEntry[]> {
  const res = await api.get('/vacation/activity', { params: options });
  return res.data.data;
}

// Settings
export async function getVacationSettings(): Promise<VacationSettings> {
  const res = await api.get('/vacation/settings');
  return res.data.data;
}

export async function updateVacationSettings(data: Partial<VacationSettings>): Promise<VacationSettings> {
  const res = await api.put('/vacation/settings', data);
  return res.data.data;
}

export async function resetVacationSettings(): Promise<VacationSettings> {
  const res = await api.delete('/vacation/settings/reset');
  return res.data.data;
}

// Blackout Periods
export async function getBlackoutPeriods(): Promise<BlackoutPeriod[]> {
  const res = await api.get('/vacation/blackout-periods');
  return res.data.data;
}

export async function createBlackoutPeriod(data: {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  isActive?: boolean;
}): Promise<BlackoutPeriod> {
  const res = await api.post('/vacation/blackout-periods', data);
  return res.data.data;
}

export async function updateBlackoutPeriod(id: number, data: Partial<{
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  isActive: boolean;
}>): Promise<BlackoutPeriod> {
  const res = await api.put(`/vacation/blackout-periods/${id}`, data);
  return res.data.data;
}

export async function deleteBlackoutPeriod(id: number): Promise<void> {
  await api.delete(`/vacation/blackout-periods/${id}`);
}

// Conflicts
export async function getVacationConflicts(): Promise<VacationConflict[]> {
  const res = await api.get('/vacation/conflicts');
  return res.data.data;
}

// Notifications
export async function getVacationNotifications(options?: {
  limit?: number;
  unread_only?: boolean;
}): Promise<{ notifications: VacationNotification[]; unreadCount: number }> {
  const res = await api.get('/vacation/notifications', { params: options });
  return res.data.data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/vacation/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/vacation/notifications/mark-all-read');
}

export async function deleteVacationNotification(id: number): Promise<void> {
  await api.delete(`/vacation/notifications/${id}`);
}

// Employee Self-Service
export async function getMyVacationStats(): Promise<MyVacationStats> {
  const res = await api.get('/vacation/my-stats');
  return res.data.data;
}

export async function getMyVacationHistory(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/my-history');
  return res.data.data;
}

export async function getMyVacationActivity(): Promise<ActivityLogEntry[]> {
  const res = await api.get('/vacation/my-activity');
  return res.data.data;
}

export async function getMyUpcomingVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/my-upcoming');
  return res.data.data;
}

export async function getMyPendingVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/my-pending');
  return res.data.data;
}

export async function getMyRecentVacations(): Promise<VacationRequest[]> {
  const res = await api.get('/vacation/my-recent');
  return res.data.data;
}

export async function getMyVacationConflicts(): Promise<VacationConflict[]> {
  const res = await api.get('/vacation/my-conflicts');
  return res.data.data;
}

// Employee Directory
export async function getEmployeesDirectory(options?: {
  department?: string;
  status?: string;
}): Promise<EmployeeDirectoryEntry[]> {
  const res = await api.get('/vacation/employees/directory', { params: options });
  return res.data.data;
}

export async function getEmployeeDepartments(): Promise<string[]> {
  const res = await api.get('/vacation/employees/departments');
  return res.data.data;
}


export type SupportRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type SupportCategory =
  | 'GENERAL_INQUIRY'
  | 'TECHNICAL_ISSUE'
  | 'BILLING_QUESTION'
  | 'FEATURE_REQUEST'
  | 'BUG_REPORT'
  | 'ACCOUNT_ASSISTANCE'
  | 'OTHER';

export interface SupportRequest {
  id: string;
  subject: string;
  description: string;
  category: SupportCategory;
  status: SupportRequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  submittedByUserId?: string | null;
  submittedByUserEmail?: string | null;
  submittedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
  } | null;
  organizationId?: string | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  resolvedByUserId?: string | null;
  resolvedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  internalNotes?: string | null;
}

/**
 * Consent Routes
 * 
 * API endpoints for recording consent and compliance
 * GDPR/Legal compliant consent management
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import {
  getCurrentPolicy,
  createPolicy,
  initializeDefaultPolicy,
  recordConsent,
  markAnnouncementPlayed,
  getConsentRecords,
  verifyConsent,
  revokeConsent,
  getAuditLogs,
  getMeetingRecordingSettings,
  updateMeetingRecordingSettings,
  runMeetingRecordingRetentionCleanup
} from '../controllers/consentController';

const router = Router();

// All consent routes require backend session authentication
router.use(authenticate);

// ===========================================
// CONSENT POLICY ROUTES
// ===========================================

// GET /api/consent/policy - Get current active policy
router.get('/policy', getCurrentPolicy);

// POST /api/consent/policy - Create new policy (admin only)
router.post('/policy', requireRoles('ADMIN', 'SYSTEM_ADMIN'), createPolicy);

// POST /api/consent/policy/initialize - Initialize default policy
router.post('/policy/initialize', requireRoles('ADMIN', 'SYSTEM_ADMIN'), initializeDefaultPolicy);

// GET/PUT /api/consent/admin/meeting-recording-settings - Manage recording retention and consent policy
router.get('/admin/meeting-recording-settings', requireRoles('ADMIN', 'SYSTEM_ADMIN'), getMeetingRecordingSettings);
router.put('/admin/meeting-recording-settings', requireRoles('ADMIN', 'SYSTEM_ADMIN'), updateMeetingRecordingSettings);
router.post('/admin/meeting-recording-settings/cleanup', requireRoles('ADMIN', 'SYSTEM_ADMIN'), runMeetingRecordingRetentionCleanup);

// ===========================================
// CONSENT RECORDING ROUTES
// ===========================================

// POST /api/consent/record - Record user consent
router.post('/record', recordConsent);

// POST /api/consent/announcement-played - Mark audio announcement as played
router.post('/announcement-played', markAnnouncementPlayed);

// GET /api/consent/verify - Verify consent exists
router.get('/verify', verifyConsent);

// POST /api/consent/revoke - Revoke consent (soft delete)
router.post('/revoke', revokeConsent);

// ===========================================
// AUDIT ROUTES
// ===========================================

// GET /api/consent/meeting/:meetingId - Get consent records for a meeting
router.get('/meeting/:meetingId', getConsentRecords);

// GET /api/consent/audit - Get all audit logs (admin only)
router.get('/audit', requireRoles('ADMIN', 'SYSTEM_ADMIN'), getAuditLogs);

export default router;

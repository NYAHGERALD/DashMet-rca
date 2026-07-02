import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import preferencesRoutes from './preferencesRoutes';
import organizationRoutes from './organizationRoutes';
import facilityRoutes from './facilityRoutes';
import departmentRoutes from './departmentRoutes';
import categoryRoutes from './categoryRoutes';
import incidentRoutes from './incidentRoutes';
import triageRoutes from './triageRoutes';
import notificationRoutes from './notificationRoutes';
import rcaRoutes from './rcaRoutes';
import capaRoutes from './capaRoutes';
import reportRoutes from './reportRoutes';
import analyticsRoutes from './analyticsRoutes';
import knowledgeRoutes from './knowledgeRoutes';
import adminRoutes from './adminRoutes';
import dropdownOptionsRoutes from './dropdownOptionsRoutes';
import participantRoutes from './participantRoutes';
import chatRoutes from './chatRoutes';
import grammarRoutes from './grammarRoutes';
import policyRoutes from './policyRoutes';
import supportRoutes from './supportRoutes';
import accessCodeRoutes from './accessCodeRoutes';
import workplaceReportRoutes from './workplaceReportRoutes';
import workplaceSafetyRoutes from './workplaceSafetyRoutes';
import workOrderTemplateRoutes from './workOrderTemplateRoutes';
import workOrderRoutes from './workOrderRoutes';
import investigationReportRoutes from './investigationReportRoutes';
import translationRoutes from './translationRoutes';
import powerpointRoutes from './powerpointRoutes';
import systemAdminRoutes from './systemAdminRoutes';
import systemAdminAuthRoutes from './systemAdminAuthRoutes';
import fmirRoutes from './fmirRoutes';
import privilegeRoutes from './privilegeRoutes';
import videoCallRoutes from './videoCallRoutes';
import transcriptRoutes from './transcriptRoutes';
import spotlightRoutes from './spotlight';
import recordingsRoutes from './recordings';
import mobileAuthRoutes from './mobileAuthRoutes';
import mobileSessionRoutes from './mobileSessionRoutes';
import mobilePushRoutes from './mobilePushRoutes';
import taskRoutes from './taskRoutes';
import meetingRoutes from './meetingRoutes';
import consentRoutes from './consentRoutes';
import documentOcrRoutes from './documentOcrRoutes';
import conflictAnalysisRoutes from './conflictAnalysisRoutes';
import policyMatchingRoutes from './policyMatchingRoutes';
import decisionSupportRoutes from './decisionSupportRoutes';
import actionGenerationRoutes from './actionGenerationRoutes';
import policyParsingRoutes from './policyParsingRoutes';
import conflictCaseRoutes from './conflictCaseRoutes';
import dashboardRoutes from './dashboardRoutes';
import { authenticate } from '../middleware/auth';
import { rateLimiter, enumerationRateLimiter, authRateLimiter, aiRateLimiter, systemAdminAuthRateLimiter } from '../middleware/rateLimiter';
import { promptInjectionDetector } from '../middleware/promptInjectionDetector';
import { getIncidentTranscripts } from '../controllers/transcriptController';

const router = Router();

// Phase 0.1: Base routing system

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// API version
router.get('/version', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    apiName: 'DashMet Operations Intelligence API',
  });
});

// Retired web Firebase Authentication routes. Firebase Storage/Admin can still be
// used elsewhere, but web identity now belongs to /auth and invitations.
router.use('/firebase-auth', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Firebase Authentication endpoints have been retired. Use backend authentication.',
  });
});

// Mobile App Authentication routes - rate limited
router.use('/mobile/check-phone', enumerationRateLimiter);
router.use('/mobile/check-email', enumerationRateLimiter);
router.use('/mobile/register', authRateLimiter);
router.use('/mobile/session', authRateLimiter, mobileSessionRoutes);
router.use('/mobile', mobileAuthRoutes);
router.use('/mobile/push', rateLimiter, mobilePushRoutes);

// Mobile App Task routes - Firebase auth required
router.use('/mobile/tasks', authenticate, taskRoutes);

// Mobile App Meeting routes - Firebase auth required
router.use('/mobile/meetings', authenticate, meetingRoutes);

// Consent & Compliance routes - Firebase auth required (enforced in route file)
// Recording consent, policy management, audit logs
router.use('/consent', rateLimiter, consentRoutes);

// Document OCR routes - AI rate limited
router.use('/document-ocr', aiRateLimiter, promptInjectionDetector, documentOcrRoutes);

// Conflict Analysis routes - AI rate limited
router.use('/conflict-analysis', aiRateLimiter, promptInjectionDetector, conflictAnalysisRoutes);

// Policy Matching routes - AI rate limited
router.use('/policy-matching', aiRateLimiter, promptInjectionDetector, policyMatchingRoutes);

// Decision Support routes - AI rate limited
router.use('/decision-support', aiRateLimiter, promptInjectionDetector, decisionSupportRoutes);

// Action Generation routes - AI rate limited
router.use('/action-generation', aiRateLimiter, promptInjectionDetector, actionGenerationRoutes);

// AI-powered policy parsing - AI rate limited
router.use('/policy-parsing', aiRateLimiter, promptInjectionDetector, policyParsingRoutes);

// Conflict Case CRUD routes - Firebase auth required (enforced in route file)
// Full CRUD for conflict cases with encryption
router.use('/conflict-cases', rateLimiter, conflictCaseRoutes);

// Dashboard routes - Firebase auth required (enforced in route file)
// Aggregated dashboard statistics and activity feed
router.use('/mobile/dashboard', rateLimiter, dashboardRoutes);

// Backend-owned web authentication routes
router.use('/auth', authRoutes);

// Phase 1: User management routes
router.use('/users', userRoutes);

// Phase 1.3: User preferences routes
router.use('/preferences', preferencesRoutes);

// AI Writing Assistant routes - AI rate limited
router.use('/grammar', aiRateLimiter, promptInjectionDetector, grammarRoutes);

// Public policy routes (Privacy/Terms/Cookie/Security)
router.use('/policies', rateLimiter, policyRoutes);

// System Admin Authentication - strict rate limiting
router.use('/system-admin-auth', systemAdminAuthRateLimiter, systemAdminAuthRoutes);

// Support request routes
router.use('/support', supportRoutes);

// Invitation-only registration routes
import invitationRoutes from './invitationRoutes';
router.use('/invitations', rateLimiter, invitationRoutes);

// Bakery Metrics routes - authenticated (router.use(authenticate) applied in route file)
// MUST be defined BEFORE root-mounted routes (departmentRoutes/facilityRoutes)
// which use router.use(authenticate) and would intercept all paths
import bakeryMetricsRoutes from './bakeryMetricsRoutes';
router.use('/bakery-metrics', rateLimiter, promptInjectionDetector, bakeryMetricsRoutes);

// Production End of Shift reports - authenticated in route file
import productionEosRoutes from './productionEosRoutes';
router.use('/production-eos', rateLimiter, productionEosRoutes);

// System Admin Dashboard routes (SYSTEM_ADMIN only)
// Defined before root-mounted facility/department routes so retired public
// auth paths return 410 instead of being intercepted as authenticated routes.
router.use('/system-admin', systemAdminRoutes);

// Phase 2.1: Organization routes
router.use('/organizations', organizationRoutes);

// Phase 2.2: Facility, Department, Area, Line, Shift routes
// IMPORTANT: departmentRoutes must come BEFORE facilityRoutes to prevent
// /facilities/:id from matching /facilities/departments
router.use('/', departmentRoutes);
router.use('/', facilityRoutes);

// Phase 2.3: Category routes
router.use('/categories', categoryRoutes);

// Dropdown Options routes (for configurable form fields)
router.use('/dropdown-options', dropdownOptionsRoutes);

// Phase 3: Incident routes
router.use('/incidents', incidentRoutes);

// Phase 4: Triage & Auto-Assignment routes
router.use('/triage', triageRoutes);

// Phase 4.4: Notification routes
router.use('/notifications', notificationRoutes);

// Phase 5-8: RCA routes
router.use('/rca', rcaRoutes);

// Phase 9-10: CAPA routes
router.use('/capa', capaRoutes);

// Phase 11: Reporting & Compliance routes
router.use('/reports', reportRoutes);

// Phase 12: Analytics & Intelligence routes
router.use('/analytics', analyticsRoutes);

// Phase 13: Knowledge Base routes
router.use('/knowledge', knowledgeRoutes);

// Phase 14: Enterprise Hardening - Admin routes
router.use('/admin', adminRoutes);

// Access Code Management (SYSTEM_ADMIN only)
router.use('/access-codes', accessCodeRoutes);

// Team Collaboration routes (participants and chat)
router.use('/participants', participantRoutes);
router.use('/chat', chatRoutes);

// Workplace Safety Report routes (PDF generation)
router.use('/workplace-report', workplaceReportRoutes);

// Workplace Safety Assessment routes (CRUD for assessments)
router.use('/workplace-safety', workplaceSafetyRoutes);

// Work Order Template routes (Admin uploads for users to download)
router.use('/work-order-templates', workOrderTemplateRoutes);

// Work Order routes (In-App and Uploaded work orders)
router.use('/work-orders', workOrderRoutes);

// Team Leader Investigation Report routes (PDF generation)
router.use('/investigation-report', investigationReportRoutes);

// Real-time Translation routes
router.use('/translation', translationRoutes);

// PowerPoint Generation routes (RCA Reports)
router.use('/powerpoint', powerpointRoutes);

// Foreign Material Incident Report routes
router.use('/fmir', fmirRoutes);

// Privilege Management routes (Role-based access control)
router.use('/privileges', privilegeRoutes);

// Video Call routes (Daily.co integration for team collaboration)
router.use('/video-call', videoCallRoutes);

// Meeting Transcript routes (AI transcription & smart summaries)
router.use('/transcripts', aiRateLimiter, promptInjectionDetector, transcriptRoutes);

// Evidence Spotlight routes (present evidence during video calls with annotations)
router.use('/evidence', spotlightRoutes);

// Meeting Recordings routes (record and store meeting videos)
router.use('/recordings', recordingsRoutes);

// Leader Standard Work (LSW) routes - authenticated
import lswRoutes from './lswRoutes';
router.use('/lsw', lswRoutes);

// LSW Notification Preferences routes - authenticated
import lswNotificationRoutes from './lswNotificationRoutes';
router.use('/lsw/notification-preferences', lswNotificationRoutes);

// Equipment Registry routes - authenticated
import equipmentRoutes from './equipmentRoutes';
router.use('/equipment', equipmentRoutes);

// Operations (Machine & Quality Issues) routes - authenticated
import operationsRoutes from './operationsRoutes';
router.use('/operations', operationsRoutes);

// Vacation Hub routes - authenticated
import vacationRoutes from './vacationRoutes';
router.use('/vacation', vacationRoutes);

// Canvas AI — Whiteboard routes - authenticated
import boardRoutes from './boardRoutes';
router.use('/boards', rateLimiter, boardRoutes);

// Get transcripts for a specific incident (nested under incidents for convenience)
router.get('/incidents/:incidentId/transcripts', authenticate, getIncidentTranscripts);

export default router;

import { Router } from 'express';
import authRoutes from './authRoutes';
import firebaseAuthRoutes from './firebaseAuthRoutes';
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
    apiName: 'RCA Engine API',
  });
});

// Phase 1: Authentication routes
// Phase 1.1: Firebase Authentication routes
router.use('/firebase-auth', firebaseAuthRoutes);

// Mobile App Authentication routes - PUBLIC, no auth required
// Used by iOS Meeting Intelligence app for registration
router.use('/mobile', mobileAuthRoutes);

// Mobile App Task routes - PUBLIC for now (will add auth later)
// Used by iOS Meeting Intelligence app for task management
router.use('/mobile/tasks', taskRoutes);

// Mobile App Meeting routes - PUBLIC for now (will add auth later)
// Used by iOS Meeting Intelligence app for meeting management
router.use('/mobile/meetings', meetingRoutes);

// Consent & Compliance routes - PUBLIC for iOS app
// Recording consent, policy management, audit logs
router.use('/consent', consentRoutes);

// Document OCR routes - PUBLIC for iOS app
// Handwritten document scanning with GPT-4 Vision
router.use('/document-ocr', documentOcrRoutes);

// Conflict Analysis routes - PUBLIC for iOS app
// AI-powered comparison of workplace conflict statements
router.use('/conflict-analysis', conflictAnalysisRoutes);

// Policy Matching routes - PUBLIC for iOS app
// AI-powered matching of case details against policy sections
router.use('/policy-matching', policyMatchingRoutes);

// Decision Support routes - PUBLIC for iOS app
// AI-powered recommendations for case resolution
router.use('/decision-support', decisionSupportRoutes);

// Action Generation routes - PUBLIC for iOS app
// Generate documents based on selected action (coaching, counseling, warning, escalate)
router.use('/action-generation', actionGenerationRoutes);

// AI-powered policy parsing - PUBLIC for mobile apps
router.use('/policy-parsing', policyParsingRoutes);

// Conflict Case CRUD routes - PUBLIC for iOS app
// Full CRUD for conflict cases with encryption
router.use('/conflict-cases', conflictCaseRoutes);

// Dashboard routes - PUBLIC for iOS app
// Aggregated dashboard statistics and activity feed
router.use('/mobile/dashboard', dashboardRoutes);

// Phase 1: Legacy JWT Authentication routes (will be deprecated)
router.use('/auth', authRoutes);

// Phase 1: User management routes
router.use('/users', userRoutes);

// Phase 1.3: User preferences routes
router.use('/preferences', preferencesRoutes);

// AI Writing Assistant routes (Grammar & Spelling) - PUBLIC, no auth required
// MUST be defined BEFORE root-mounted routes that use authentication
router.use('/grammar', grammarRoutes);

// Public policy routes (Privacy/Terms/Cookie/Security)
router.use('/policies', policyRoutes);

// System Admin Authentication - PUBLIC, no auth required
// MUST be defined early before any authenticated routes
router.use('/system-admin-auth', systemAdminAuthRoutes);

// Support request routes
router.use('/support', supportRoutes);

// Bakery Metrics routes - PUBLIC, no auth required
// MUST be defined BEFORE root-mounted routes (departmentRoutes/facilityRoutes)
// which use router.use(authenticate) and would intercept all paths
import bakeryMetricsRoutes from './bakeryMetricsRoutes';
router.use('/bakery-metrics', bakeryMetricsRoutes);

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

// System Admin Dashboard routes (SYSTEM_ADMIN only)
router.use('/system-admin', systemAdminRoutes);

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
router.use('/transcripts', transcriptRoutes);

// Evidence Spotlight routes (present evidence during video calls with annotations)
router.use('/evidence', spotlightRoutes);

// Meeting Recordings routes (record and store meeting videos)
router.use('/recordings', recordingsRoutes);

// Leader Standard Work (LSW) routes - authenticated
import lswRoutes from './lswRoutes';
router.use('/lsw', lswRoutes);

// Outlook Calendar integration routes - Connect Outlook for LSW
import outlookRoutes from './outlookRoutes';
router.use('/outlook', outlookRoutes);

// Get transcripts for a specific incident (nested under incidents for convenience)
router.get('/incidents/:incidentId/transcripts', authenticate, getIncidentTranscripts);

export default router;

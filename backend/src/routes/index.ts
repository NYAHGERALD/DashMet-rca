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
import investigationReportRoutes from './investigationReportRoutes';
import translationRoutes from './translationRoutes';
import powerpointRoutes from './powerpointRoutes';
import systemAdminRoutes from './systemAdminRoutes';

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

// Support request routes
router.use('/support', supportRoutes);

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

// Team Leader Investigation Report routes (PDF generation)
router.use('/investigation-report', investigationReportRoutes);

// Real-time Translation routes
router.use('/translation', translationRoutes);

// PowerPoint Generation routes (RCA Reports)
router.use('/powerpoint', powerpointRoutes);

export default router;

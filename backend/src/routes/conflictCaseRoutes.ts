/**
 * Conflict Case Routes for Conflict Resolution Module
 * 
 * Endpoints:
 * - POST   /api/conflict-cases                - Create a new conflict case
 * - GET    /api/conflict-cases                - Get all cases for user's organization
 * - GET    /api/conflict-cases/:id            - Get single case by ID
 * - PATCH  /api/conflict-cases/:id            - Update case details
 * - DELETE /api/conflict-cases/:id            - Delete a case
 * - POST   /api/conflict-cases/:id/employees  - Add employee to case
 * - DELETE /api/conflict-cases/:id/employees/:employeeId - Remove employee
 * - POST   /api/conflict-cases/:id/documents  - Add document to case
 * - DELETE /api/conflict-cases/:id/documents/:documentId - Remove document
 * - POST   /api/conflict-cases/:id/audit      - Add audit entry
 * - GET    /api/conflict-cases/:id/audit      - Get audit trail
 * 
 * Workplace Policies:
 * - POST   /api/workplace-policies            - Create policy document
 * - GET    /api/workplace-policies            - Get all policies
 * - GET    /api/workplace-policies/:id        - Get single policy
 * - PATCH  /api/workplace-policies/:id        - Update policy
 * - DELETE /api/workplace-policies/:id        - Delete policy
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// ENCRYPTION UTILITIES
// Note: In production, use a proper key management service
// ============================================================================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text; // Return original if decryption fails
  }
}

// Decrypt sensitive fields in case response
function decryptCaseData(caseData: any): any {
  if (!caseData) return caseData;
  
  const decrypted = { ...caseData };
  
  // Decrypt sensitive case string fields
  if (decrypted.location) decrypted.location = decrypt(decrypted.location);
  if (decrypted.department) decrypted.department = decrypt(decrypted.department);
  if (decrypted.shift) decrypted.shift = decrypt(decrypted.shift);
  if (decrypted.comparisonResult) decrypted.comparisonResult = decrypt(decrypted.comparisonResult);
  if (decrypted.recommendations) decrypted.recommendations = decrypt(decrypted.recommendations);
  if (decrypted.recommendationResult) decrypted.recommendationResult = decrypt(decrypted.recommendationResult);
  if (decrypted.generatedDocument) decrypted.generatedDocument = decrypt(decrypted.generatedDocument);
  if (decrypted.fullGeneratedDocumentResult) decrypted.fullGeneratedDocumentResult = decrypt(decrypted.fullGeneratedDocumentResult);
  if (decrypted.policyMatches) decrypted.policyMatches = decrypt(decrypted.policyMatches);
  if (decrypted.policyMatchingResult) decrypted.policyMatchingResult = decrypt(decrypted.policyMatchingResult);
  if (decrypted.supervisorNotes) decrypted.supervisorNotes = decrypt(decrypted.supervisorNotes);
  
  // Decrypt case closure fields
  if (decrypted.closureReason) decrypted.closureReason = decrypt(decrypted.closureReason);
  if (decrypted.closureSummary) decrypted.closureSummary = decrypt(decrypted.closureSummary);
  
  // Legacy field names (for backwards compatibility)
  if (decrypted.description) decrypted.description = decrypt(decrypted.description);
  if (decrypted.aiComparisonResultJson) decrypted.aiComparisonResultJson = decrypt(decrypted.aiComparisonResultJson);
  if (decrypted.aiRecommendationsJson) decrypted.aiRecommendationsJson = decrypt(decrypted.aiRecommendationsJson);
  if (decrypted.generatedActionDocJson) decrypted.generatedActionDocJson = decrypt(decrypted.generatedActionDocJson);
  if (decrypted.policyMatchesJson) decrypted.policyMatchesJson = decrypt(decrypted.policyMatchesJson);
  if (decrypted.finalDecision) decrypted.finalDecision = decrypt(decrypted.finalDecision);
  
  // Decrypt employee fields (involvedEmployees from database)
  if (decrypted.involvedEmployees) {
    decrypted.involvedEmployees = decrypted.involvedEmployees.map((emp: any) => ({
      ...emp,
      name: emp.name ? decrypt(emp.name) : emp.name,
      role: emp.role ? decrypt(emp.role) : emp.role,
      department: emp.department ? decrypt(emp.department) : emp.department,
      employeeFileNo: emp.employeeFileNo ? decrypt(emp.employeeFileNo) : emp.employeeFileNo,
    }));
  }
  
  // Legacy employees field
  if (decrypted.employees) {
    decrypted.employees = decrypted.employees.map((emp: any) => ({
      ...emp,
      name: emp.name ? decrypt(emp.name) : emp.name,
      role: emp.role ? decrypt(emp.role) : emp.role,
      department: emp.department ? decrypt(emp.department) : emp.department,
      employeeFileNo: emp.employeeFileNo ? decrypt(emp.employeeFileNo) : emp.employeeFileNo,
      statement: emp.statement ? decrypt(emp.statement) : emp.statement,
    }));
  }
  
  // Decrypt document content
  if (decrypted.documents) {
    decrypted.documents = decrypted.documents.map((doc: any) => ({
      ...doc,
      // Text fields
      originalText: doc.originalText ? decrypt(doc.originalText) : doc.originalText,
      translatedText: doc.translatedText ? decrypt(doc.translatedText) : doc.translatedText,
      cleanedText: doc.cleanedText ? decrypt(doc.cleanedText) : doc.cleanedText,
      content: doc.content ? decrypt(doc.content) : doc.content,
      extractedText: doc.extractedText ? decrypt(doc.extractedText) : doc.extractedText,
      // Image URL arrays (stored as encrypted JSON strings)
      originalImageUrls: doc.originalImageUrls ? decrypt(doc.originalImageUrls) : doc.originalImageUrls,
      processedImageUrls: doc.processedImageUrls ? decrypt(doc.processedImageUrls) : doc.processedImageUrls,
      // Signature data
      signatureImageData: doc.signatureImageData ? decrypt(doc.signatureImageData) : doc.signatureImageData,
      // Reviewer/supervisor info
      reviewerName: doc.reviewerName ? decrypt(doc.reviewerName) : doc.reviewerName,
      reviewerSignature: doc.reviewerSignature ? decrypt(doc.reviewerSignature) : doc.reviewerSignature,
      supervisorComment: doc.supervisorComment ? decrypt(doc.supervisorComment) : doc.supervisorComment,
    }));
  }
  
  // Decrypt audit log entries
  if (decrypted.auditLog) {
    decrypted.auditLog = decrypted.auditLog.map((entry: any) => ({
      ...entry,
      details: entry.details ? decrypt(entry.details) : entry.details,
      userName: entry.userName ? decrypt(entry.userName) : entry.userName,
    }));
  }
  
  return decrypted;
}

// ============================================================================
// POST /api/conflict-cases
// Create a new conflict case
// ============================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      caseNumber,
      caseType,
      status,
      description,
      reportedDate,
      incidentDate,
      location,
      department,
      shift,
      employeesJson,
      documentsJson,
      aiComparisonResultJson,
      comparisonResult,
      aiRecommendationsJson,
      recommendations,
      selectedActionType,
      selectedAction,
      generatedActionDocJson,
      generatedDocument,
      fullGeneratedDocumentResultJson,
      policyMatchesJson,
      policyMatches,
      supervisorNotes,
      finalDecision,
      activePolicyId,
      creatorId,
      organizationId,
      facilityId,
    } = req.body;

    if (!caseNumber || !creatorId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: caseNumber, creatorId, organizationId',
      });
    }

    // Verify creator exists
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found',
      });
    }

    // Map caseType to valid enum values (uppercase)
    const typeMap: Record<string, string> = {
      'conflict': 'CONFLICT',
      'conduct': 'CONDUCT',
      'safety': 'SAFETY',
      'other': 'OTHER',
    };
    const mappedType = typeMap[caseType?.toLowerCase()] || caseType?.toUpperCase() || 'CONFLICT';

    // Map status to valid enum values (uppercase)
    const statusMap: Record<string, string> = {
      'draft': 'DRAFT',
      'in_progress': 'IN_PROGRESS',
      'inprogress': 'IN_PROGRESS',
      'pending_review': 'PENDING_REVIEW',
      'pendingreview': 'PENDING_REVIEW',
      'awaiting_action': 'AWAITING_ACTION',
      'awaitingaction': 'AWAITING_ACTION',
      'closed': 'CLOSED',
      'escalated': 'ESCALATED',
    };
    const mappedStatus = statusMap[status?.toLowerCase()] || status?.toUpperCase() || 'DRAFT';

    // Create case with encrypted sensitive data
    const conflictCase = await prisma.conflictCase.create({
      data: {
        caseNumber,
        type: mappedType as any,
        status: mappedStatus as any,
        incidentDate: incidentDate ? new Date(incidentDate) : (reportedDate ? new Date(reportedDate) : new Date()),
        location: location ? encrypt(location) : encrypt('Not specified'),
        department: department ? encrypt(department) : encrypt('Not specified'),
        shift: shift ? encrypt(shift) : null,
        comparisonResult: (comparisonResult || aiComparisonResultJson) ? encrypt(JSON.stringify(comparisonResult || aiComparisonResultJson)) : null,
        recommendations: (recommendations || aiRecommendationsJson) ? encrypt(JSON.stringify(recommendations || aiRecommendationsJson)) : null,
        selectedAction: (selectedAction || selectedActionType) || null,
        generatedDocument: (generatedDocument || generatedActionDocJson) ? encrypt(JSON.stringify(generatedDocument || generatedActionDocJson)) : null,
        fullGeneratedDocumentResult: fullGeneratedDocumentResultJson ? encrypt(JSON.stringify(fullGeneratedDocumentResultJson)) : null,
        policyMatches: (policyMatches || policyMatchesJson) ? encrypt(JSON.stringify(policyMatches || policyMatchesJson)) : null,
        supervisorNotes: supervisorNotes ? encrypt(supervisorNotes) : null,
        activePolicyId: activePolicyId || null,
        createdBy: creatorId,
        organizationId,
        facilityId: facilityId || null,
      },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        involvedEmployees: true,
        documents: true,
        auditLog: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    // Parse and add employees if provided
    if (employeesJson) {
      const employees = typeof employeesJson === 'string' ? JSON.parse(employeesJson) : employeesJson;
      
      for (const emp of employees) {
        await prisma.conflictInvolvedEmployee.create({
          data: {
            caseId: conflictCase.id,
            name: encrypt(emp.name || 'Unknown'),
            role: encrypt(emp.role || 'Not specified'),
            department: encrypt(emp.department || 'Not specified'),
            employeeFileNo: emp.employeeId ? encrypt(emp.employeeId) : null,
            isComplainant: emp.isComplainant || false,
          },
        });
      }
    }

    // Parse and add documents if provided
    if (documentsJson) {
      const documents = typeof documentsJson === 'string' ? JSON.parse(documentsJson) : documentsJson;
      
      // Map document type to valid enum values
      const docTypeMap: Record<string, string> = {
        'complaint_a': 'COMPLAINT_A',
        'complaint_b': 'COMPLAINT_B',
        'witness_statement': 'WITNESS_STATEMENT',
        'prior_record': 'PRIOR_RECORD',
        'counseling_record': 'COUNSELING_RECORD',
        'warning_document': 'WARNING_DOCUMENT',
        'evidence': 'EVIDENCE',
        'other': 'OTHER',
      };
      
      for (const doc of documents) {
        const mappedDocType = docTypeMap[doc.type?.toLowerCase()] || doc.type?.toUpperCase() || 'OTHER';
        await prisma.conflictCaseDocument.create({
          data: {
            caseId: conflictCase.id,
            type: mappedDocType as any,
            originalText: doc.content ? encrypt(doc.content) : (doc.extractedText ? encrypt(doc.extractedText) : null),
            originalImageUrls: doc.url ? encrypt(JSON.stringify([doc.url])) : null,
          },
        });
      }
    }

    // Add audit entry for creation
    await prisma.conflictCaseAuditEntry.create({
      data: {
        caseId: conflictCase.id,
        action: 'CREATED',
        details: encrypt('Case created'),
        userId: creatorId,
        userName: encrypt(creator.firstName + ' ' + creator.lastName),
      },
    });

    // Fetch complete case with all relations
    const completeCase = await prisma.conflictCase.findUnique({
      where: { id: conflictCase.id },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        involvedEmployees: true,
        documents: true,
        auditLog: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: decryptCaseData(completeCase),
    });
  } catch (error: any) {
    console.error('Error creating conflict case:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'A case with this case number already exists',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create conflict case',
      details: error.message,
    });
  }
});

// ============================================================================
// GET /api/conflict-cases
// Get all cases for user's organization
// ============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, status, caseType, limit = 50, offset = 0 } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required',
      });
    }

    const where: Prisma.ConflictCaseWhereInput = {
      organizationId: organizationId as string,
    };

    if (status) {
      where.status = status as any;
    }

    if (caseType) {
      where.type = caseType as any;  // Database field is 'type' not 'caseType'
    }

    const [cases, total] = await Promise.all([
      prisma.conflictCase.findMany({
        where,
        include: {
          createdByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          facility: {
            select: { id: true, name: true },
          },
          involvedEmployees: true,
          documents: true,  // Include actual documents, not just count
          auditLog: {
            orderBy: { timestamp: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.conflictCase.count({ where }),
    ]);

    res.json({
      success: true,
      data: cases.map(decryptCaseData),
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + cases.length < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching conflict cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conflict cases',
      details: error.message,
    });
  }
});

// Helper to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ============================================================================
// GET /api/conflict-cases/:id
// Get single case by ID
// ============================================================================
router.get('/:id', async (req: Request, res: Response, next) => {
  // Skip to next route if ID is not a valid UUID (allows /workplace-policies to work)
  if (!isValidUUID(req.params.id)) {
    return next();
  }
  
  try {
    const { id } = req.params;

    const conflictCase = await prisma.conflictCase.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        involvedEmployees: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        auditLog: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!conflictCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    const decryptedCase = decryptCaseData(conflictCase);
    console.log('🎯 Returning case - selectedTargetEmployeeIds:', decryptedCase.selectedTargetEmployeeIds);
    
    res.json({
      success: true,
      data: decryptedCase,
    });
  } catch (error: any) {
    console.error('Error fetching conflict case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conflict case',
      details: error.message,
    });
  }
});

// ============================================================================
// PATCH /api/conflict-cases/:id
// Update case details
// ============================================================================
router.patch('/:id', async (req: Request, res: Response, next) => {
  // Skip to next route if ID is not a valid UUID
  if (!isValidUUID(req.params.id)) {
    return next();
  }
  
  try {
    const { id } = req.params;
    const {
      caseType,
      status,
      description,
      aiComparisonResultJson,
      aiRecommendationsJson,
      recommendationResultJson, // Full recommendation result for UI restoration
      selectedActionType,
      selectedTargetEmployeeIdsJson, // Target employee IDs for the selected action
      generatedActionDocJson,
      fullGeneratedDocumentResultJson, // Full generated document result for complete UI display
      policyMatchesJson,
      policyMatchingResultJson, // Full policy matching result for UI restoration
      supervisorNotes,
      finalDecision,
      involvedEmployeesJson, // Array of employees to update
      userId, // For audit trail
    } = req.body;

    // Check if case exists
    const existingCase = await prisma.conflictCase.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    // Build update data with encryption
    const updateData: any = {};
    const changes: any = {};

    if (caseType !== undefined) {
      updateData.type = caseType;
      changes.type = { from: existingCase.type, to: caseType };
    }
    if (status !== undefined) {
      updateData.status = status;
      changes.status = { from: existingCase.status, to: status };
    }
    // Note: 'description' and 'finalDecision' fields don't exist in database schema
    // They are stored locally on iOS only
    
    // Handle involved employees update
    if (involvedEmployeesJson && Array.isArray(involvedEmployeesJson)) {
      for (const emp of involvedEmployeesJson) {
        // Try to find existing employee by ID
        const existingEmployee = await prisma.conflictInvolvedEmployee.findFirst({
          where: { id: emp.id, caseId: id },
        });
        
        if (existingEmployee) {
          // Update existing employee
          const empUpdateData: any = {};
          if (emp.name !== undefined) empUpdateData.name = encrypt(emp.name);
          if (emp.role !== undefined) empUpdateData.role = encrypt(emp.role);
          if (emp.department !== undefined) empUpdateData.department = encrypt(emp.department);
          if (emp.employeeId !== undefined) empUpdateData.employeeFileNo = emp.employeeId ? encrypt(emp.employeeId) : null;
          if (emp.isComplainant !== undefined) empUpdateData.isComplainant = emp.isComplainant;
          
          await prisma.conflictInvolvedEmployee.update({
            where: { id: emp.id },
            data: empUpdateData,
          });
        } else {
          // Create new employee - iOS provides the UUID, we preserve it
          await prisma.conflictInvolvedEmployee.create({
            data: {
              id: emp.id,  // Use the UUID provided by iOS
              caseId: id,
              name: encrypt(emp.name || ''),
              role: encrypt(emp.role || ''),
              department: encrypt(emp.department || ''),
              employeeFileNo: emp.employeeId ? encrypt(emp.employeeId) : null,
              isComplainant: emp.isComplainant ?? false,
            },
          });
        }
      }
      changes.involvedEmployees = 'updated';
    }
    
    if (aiComparisonResultJson !== undefined) {
      updateData.comparisonResult = encrypt(JSON.stringify(aiComparisonResultJson));
      changes.comparisonResult = 'updated';
    }
    if (aiRecommendationsJson !== undefined) {
      updateData.recommendations = encrypt(JSON.stringify(aiRecommendationsJson));
      changes.recommendations = 'updated';
    }
    if (recommendationResultJson !== undefined) {
      updateData.recommendationResult = encrypt(JSON.stringify(recommendationResultJson));
      changes.recommendationResult = 'updated';
    }
    if (selectedActionType !== undefined) {
      updateData.selectedAction = selectedActionType;
      changes.selectedAction = { from: existingCase.selectedAction, to: selectedActionType };
    }
    if (generatedActionDocJson !== undefined) {
      updateData.generatedDocument = encrypt(JSON.stringify(generatedActionDocJson));
      changes.generatedDocument = 'updated';
    }
    if (fullGeneratedDocumentResultJson !== undefined) {
      updateData.fullGeneratedDocumentResult = encrypt(JSON.stringify(fullGeneratedDocumentResultJson));
      changes.fullGeneratedDocumentResult = 'updated';
    }
    if (selectedTargetEmployeeIdsJson !== undefined) {
      console.log('🎯 Saving selectedTargetEmployeeIdsJson:', selectedTargetEmployeeIdsJson);
      updateData.selectedTargetEmployeeIds = JSON.stringify(selectedTargetEmployeeIdsJson);
      console.log('🎯 Saved as:', updateData.selectedTargetEmployeeIds);
      changes.selectedTargetEmployeeIds = 'updated';
    }
    if (policyMatchesJson !== undefined) {
      updateData.policyMatches = encrypt(JSON.stringify(policyMatchesJson));
      changes.policyMatches = 'updated';
    }
    if (policyMatchingResultJson !== undefined) {
      updateData.policyMatchingResult = encrypt(JSON.stringify(policyMatchingResultJson));
      changes.policyMatchingResult = 'updated';
    }
    if (supervisorNotes !== undefined) {
      updateData.supervisorNotes = encrypt(supervisorNotes);
      changes.supervisorNotes = 'updated';
    }
    // Note: 'finalDecision' doesn't exist in database schema, stored locally only

    const updatedCase = await prisma.conflictCase.update({
      where: { id },
      data: updateData,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        involvedEmployees: true,
        documents: true,
        auditLog: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    // Add audit entry
    if (userId && Object.keys(changes).length > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'UPDATED',
          details: encrypt(`Case updated: ${Object.keys(changes).join(', ')}`),
          userId,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    res.json({
      success: true,
      data: decryptCaseData(updatedCase),
    });
  } catch (error: any) {
    console.error('Error updating conflict case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conflict case',
      details: error.message,
    });
  }
});

// ============================================================================
// POST /api/conflict-cases/:id/close
// Close and lock a case - Enterprise-grade case finalization
// ============================================================================
router.post('/:id/close', async (req: Request, res: Response, next) => {
  // Skip to next route if ID is not a valid UUID
  if (!isValidUUID(req.params.id)) {
    return next();
  }
  
  try {
    const { id } = req.params;
    const {
      closureReason,        // Required: The reason for closure (e.g., "RESOLVED", "NO_FURTHER_ACTION", etc.)
      closureSummary,       // Optional: Final summary notes for the case
      supervisorNotes,      // Optional: Additional supervisor notes
      closedBy,            // Required: User ID who is closing the case
      includeAuditTrail,    // Optional: Whether to include audit trail in closure record
      includeAllDocuments,  // Optional: Whether to archive all documents
    } = req.body;

    // Validation
    if (!closureReason) {
      return res.status(400).json({
        success: false,
        error: 'Closure reason is required',
      });
    }

    if (!closedBy) {
      return res.status(400).json({
        success: false,
        error: 'User ID (closedBy) is required to close a case',
      });
    }

    // Check if case exists
    const existingCase = await prisma.conflictCase.findUnique({
      where: { id },
      include: {
        involvedEmployees: true,
        documents: true,
      },
    });

    if (!existingCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    // Check if case is already closed/locked
    if (existingCase.isLocked) {
      return res.status(400).json({
        success: false,
        error: 'Case is already locked and cannot be modified',
      });
    }

    if (existingCase.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        error: 'Case is already closed',
      });
    }

    // Verify the user exists
    const closingUser = await prisma.user.findUnique({
      where: { id: closedBy },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!closingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const closedAt = new Date();
    
    // Update case with closure details
    const closedCase = await prisma.conflictCase.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closureReason: encrypt(closureReason),
        closureSummary: closureSummary ? encrypt(closureSummary) : null,
        supervisorNotes: supervisorNotes ? encrypt(supervisorNotes) : (existingCase.supervisorNotes || null),
        closedBy,
        closedAt,
        isLocked: true, // Permanently lock the case
      },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        closedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        involvedEmployees: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        auditLog: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    // Create audit trail entry for case closure
    const userName = `${closingUser.firstName || ''} ${closingUser.lastName || ''}`.trim() || 'Unknown User';
    await prisma.conflictCaseAuditEntry.create({
      data: {
        caseId: id,
        action: 'CASE_CLOSED',
        details: encrypt(JSON.stringify({
          closureReason,
          closureSummary: closureSummary || null,
          includedAuditTrail: includeAuditTrail || false,
          includedAllDocuments: includeAllDocuments || false,
          documentCount: existingCase.documents.length,
          involvedEmployeesCount: existingCase.involvedEmployees.length,
        })),
        userId: closedBy,
        userName: encrypt(userName),
      },
    });

    // Prepare response with closure details
    const decryptedCase = decryptCaseData(closedCase);
    
    res.json({
      success: true,
      message: 'Case closed and locked successfully',
      data: {
        ...decryptedCase,
        closureDetails: {
          closedAt: closedAt.toISOString(),
          closedBy: {
            id: closingUser.id,
            name: userName,
            email: closingUser.email,
          },
          closureReason,
          closureSummary: closureSummary || null,
          isLocked: true,
        },
      },
    });
  } catch (error: any) {
    console.error('Error closing conflict case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close conflict case',
      details: error.message,
    });
  }
});

// ============================================================================
// DELETE /api/conflict-cases/:id
// Delete a case
// ============================================================================
router.delete('/:id', async (req: Request, res: Response, next) => {
  // Skip to next route if ID is not a valid UUID
  if (!isValidUUID(req.params.id)) {
    return next();
  }
  
  try {
    const { id } = req.params;

    const existingCase = await prisma.conflictCase.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    // Delete related records first (cascade should handle this, but being explicit)
    await prisma.conflictCaseAuditEntry.deleteMany({ where: { caseId: id } });
    await prisma.conflictCaseDocument.deleteMany({ where: { caseId: id } });
    await prisma.conflictInvolvedEmployee.deleteMany({ where: { caseId: id } });

    await prisma.conflictCase.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Case deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting conflict case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conflict case',
      details: error.message,
    });
  }
});

// ============================================================================
// POST /api/conflict-cases/:id/employees
// Add employee to case
// ============================================================================
router.post('/:id/employees', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, department, employeeId, isComplainant, statement, userId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Employee name is required',
      });
    }

    const conflictCase = await prisma.conflictCase.findUnique({
      where: { id },
    });

    if (!conflictCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    const employee = await prisma.conflictInvolvedEmployee.create({
      data: {
        caseId: id,
        name: encrypt(name),
        role: encrypt(role || 'Not specified'),
        department: encrypt(department || 'Not specified'),
        employeeFileNo: employeeId ? encrypt(employeeId) : null,
        isComplainant: isComplainant || false,
      },
    });

    // Add audit entry
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_ADDED',
          details: encrypt(`Employee added: ${name}`),
          userId,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    // Decrypt fields before returning
    const decryptedEmployee = {
      ...employee,
      name: decrypt(employee.name),
      role: decrypt(employee.role),
      department: decrypt(employee.department),
      employeeFileNo: employee.employeeFileNo ? decrypt(employee.employeeFileNo) : null,
    };

    res.status(201).json({
      success: true,
      data: decryptedEmployee,
    });
  } catch (error: any) {
    console.error('Error adding employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add employee',
      details: error.message,
    });
  }
});

// ============================================================================
// PATCH /api/conflict-cases/:id/employees/:employeeId
// Update employee
// ============================================================================
router.patch('/:id/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const { id, employeeId } = req.params;
    const { name, role, department, employeeIdField, isComplainant, userId } = req.body;

    const employee = await prisma.conflictInvolvedEmployee.findFirst({
      where: { id: employeeId, caseId: id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = encrypt(name);
    if (role !== undefined) updateData.role = encrypt(role);
    if (department !== undefined) updateData.department = encrypt(department);
    if (employeeIdField !== undefined) updateData.employeeFileNo = encrypt(employeeIdField);
    if (isComplainant !== undefined) updateData.isComplainant = isComplainant;

    const updatedEmployee = await prisma.conflictInvolvedEmployee.update({
      where: { id: employeeId },
      data: updateData,
    });

    // Add audit entry
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_UPDATED',
          details: encrypt(`Employee updated: ${name || decrypt(employee.name)}`),
          userId,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    const decryptedEmployee = {
      ...updatedEmployee,
      name: decrypt(updatedEmployee.name),
      role: decrypt(updatedEmployee.role),
      department: decrypt(updatedEmployee.department),
      employeeFileNo: updatedEmployee.employeeFileNo ? decrypt(updatedEmployee.employeeFileNo) : null,
    };

    res.json({
      success: true,
      data: decryptedEmployee,
    });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update employee',
      details: error.message,
    });
  }
});

// ============================================================================
// DELETE /api/conflict-cases/:id/employees/:employeeId
// Remove employee from case
// ============================================================================
router.delete('/:id/employees/:employeeId', async (req: Request, res: Response) => {
  try {
    const { id, employeeId } = req.params;
    const { userId } = req.query;

    const employee = await prisma.conflictInvolvedEmployee.findFirst({
      where: { id: employeeId, caseId: id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    await prisma.conflictInvolvedEmployee.delete({
      where: { id: employeeId },
    });

    // Add audit entry
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId as string } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_REMOVED',
          details: encrypt(`Employee removed: ${employee.name}`),
          userId: userId as string,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    res.json({
      success: true,
      message: 'Employee removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove employee',
      details: error.message,
    });
  }
});

// ============================================================================
// POST /api/conflict-cases/:id/documents
// Add document to case
// ============================================================================
router.post('/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      type, 
      url, 
      content, 
      extractedText, 
      originalText,
      cleanedText,
      translatedText,
      originalImageUrls,
      processedImageUrls,
      detectedLanguage,
      isHandwritten,
      pageCount,
      employeeId,
      submittedBy,
      // Signature & audit fields
      signatureImageData,
      employeeReviewTimestamp,
      employeeSignatureTimestamp,
      supervisorCertificationTimestamp,
      supervisorId,
      supervisorName,
      userId 
    } = req.body;

    // Map document type to valid enum values
    const docTypeMap: Record<string, string> = {
      'complaint_a': 'COMPLAINT_A',
      'complaint_b': 'COMPLAINT_B',
      'witness_statement': 'WITNESS_STATEMENT',
      'prior_record': 'PRIOR_RECORD',
      'counseling_record': 'COUNSELING_RECORD',
      'warning_document': 'WARNING_DOCUMENT',
      'evidence': 'EVIDENCE',
      'other': 'OTHER',
    };
    const mappedDocType = docTypeMap[type?.toLowerCase()] || type?.toUpperCase() || 'OTHER';

    const conflictCase = await prisma.conflictCase.findUnique({
      where: { id },
    });

    if (!conflictCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    // Build document data with all fields
    const docData: any = {
      caseId: id,
      type: mappedDocType as any,
      pageCount: pageCount || 1,
    };

    // Text fields (encrypted)
    if (originalText || content || extractedText) {
      docData.originalText = encrypt(originalText || content || extractedText);
    }
    if (cleanedText) {
      docData.cleanedText = encrypt(cleanedText);
    }
    if (translatedText) {
      docData.translatedText = encrypt(translatedText);
    }

    // Image URLs (encrypted JSON arrays)
    if (originalImageUrls && originalImageUrls.length > 0) {
      docData.originalImageUrls = encrypt(JSON.stringify(originalImageUrls));
    } else if (url) {
      docData.originalImageUrls = encrypt(JSON.stringify([url]));
    }
    if (processedImageUrls && processedImageUrls.length > 0) {
      docData.processedImageUrls = encrypt(JSON.stringify(processedImageUrls));
    }

    // Metadata
    if (detectedLanguage) docData.detectedLanguage = detectedLanguage;
    if (isHandwritten !== undefined) docData.isHandwritten = isHandwritten;
    
    // Only set employeeId if it references an existing ConflictInvolvedEmployee
    if (employeeId) {
      const existingEmployee = await prisma.conflictInvolvedEmployee.findUnique({
        where: { id: employeeId }
      });
      if (existingEmployee) {
        docData.employeeId = employeeId;
      }
      // If employee doesn't exist, skip the foreign key - store submittedBy instead
    }
    if (submittedBy) docData.submittedBy = encrypt(submittedBy);

    // Signature & audit fields (encrypted where sensitive)
    if (signatureImageData) docData.signatureImageData = encrypt(signatureImageData);
    if (employeeReviewTimestamp) docData.employeeReviewTimestamp = new Date(employeeReviewTimestamp);
    if (employeeSignatureTimestamp) docData.employeeSignatureTimestamp = new Date(employeeSignatureTimestamp);
    if (supervisorCertificationTimestamp) docData.supervisorCertificationTimestamp = new Date(supervisorCertificationTimestamp);
    if (supervisorId) docData.supervisorId = encrypt(supervisorId);
    if (supervisorName) docData.supervisorName = encrypt(supervisorName);

    const document = await prisma.conflictCaseDocument.create({
      data: docData,
    });

    // Add audit entry
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'DOCUMENT_ADDED',
          details: encrypt(`Document added: ${name || type}`),
          userId,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    // Decrypt for response
    const decryptedDoc = {
      ...document,
      originalText: document.originalText ? decrypt(document.originalText) : null,
      cleanedText: document.cleanedText ? decrypt(document.cleanedText) : null,
      translatedText: document.translatedText ? decrypt(document.translatedText) : null,
      originalImageUrls: document.originalImageUrls ? JSON.parse(decrypt(document.originalImageUrls)) : null,
      processedImageUrls: document.processedImageUrls ? JSON.parse(decrypt(document.processedImageUrls)) : null,
      submittedBy: document.submittedBy ? decrypt(document.submittedBy) : null,
      signatureImageData: document.signatureImageData ? decrypt(document.signatureImageData) : null,
      supervisorId: document.supervisorId ? decrypt(document.supervisorId) : null,
      supervisorName: document.supervisorName ? decrypt(document.supervisorName) : null,
    };

    res.status(201).json({
      success: true,
      data: decryptedDoc,
    });
  } catch (error: any) {
    console.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add document',
      details: error.message,
    });
  }
});

// ============================================================================
// DELETE /api/conflict-cases/:id/documents/:documentId
// Remove document from case
// ============================================================================
router.delete('/:id/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { id, documentId } = req.params;
    const { userId } = req.query;

    const document = await prisma.conflictCaseDocument.findFirst({
      where: { id: documentId, caseId: id },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    await prisma.conflictCaseDocument.delete({
      where: { id: documentId },
    });

    // Add audit entry
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId as string } });
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'DOCUMENT_REMOVED',
          details: encrypt(`Document removed: ${document.type}`),
          userId: userId as string,
          userName: encrypt(user ? `${user.firstName} ${user.lastName}` : 'Unknown User'),
        },
      });
    }

    res.json({
      success: true,
      message: 'Document removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove document',
      details: error.message,
    });
  }
});

// ============================================================================
// GET /api/conflict-cases/:id/audit
// Get audit trail for case
// ============================================================================
router.get('/:id/audit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const auditTrail = await prisma.conflictCaseAuditEntry.findMany({
      where: { caseId: id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    res.json({
      success: true,
      data: auditTrail,
    });
  } catch (error: any) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail',
      details: error.message,
    });
  }
});

// ============================================================================
// WORKPLACE POLICY ROUTES
// ============================================================================

// Helper to decrypt policy data
function decryptPolicyData(policy: any): any {
  if (!policy) return policy;
  return {
    ...policy,
    originalText: policy.originalText ? decrypt(policy.originalText) : null,
    sections: policy.sections ? decrypt(policy.sections) : null,
  };
}

// POST /api/conflict-cases/workplace-policies
// Create a new workplace policy
router.post('/workplace-policies', async (req: Request, res: Response) => {
  try {
    // Debug: log what the backend actually receives
    console.log('[DEBUG] workplace-policies POST - Content-Type:', req.headers['content-type']);
    console.log('[DEBUG] workplace-policies POST - body type:', typeof req.body);
    console.log('[DEBUG] workplace-policies POST - body keys:', Object.keys(req.body || {}));
    console.log('[DEBUG] workplace-policies POST - name:', req.body?.name, '| version:', req.body?.version, '| createdBy:', req.body?.createdBy, '| organizationId:', req.body?.organizationId);

    const {
      name,
      version,
      effectiveDate,
      status,
      description,
      documentFileName,
      documentFileUrl,
      documentFileType,
      documentPageCount,
      originalText,
      sections,
      createdBy,
      organizationId,
      facilityId,
    } = req.body;

    if (!name || !version || !createdBy || !organizationId) {
      console.log('[DEBUG] workplace-policies POST - VALIDATION FAILED. raw body (first 500):', JSON.stringify(req.body).substring(0, 500));
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, version, createdBy, organizationId',
      });
    }

    // Verify creator exists
    const creator = await prisma.user.findUnique({
      where: { id: createdBy },
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found',
      });
    }

    const policy = await prisma.workplacePolicyDoc.create({
      data: {
        name,
        version,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        status: status || 'DRAFT',
        description: description || null,
        documentFileName: documentFileName || null,
        documentFileUrl: documentFileUrl || null,
        documentFileType: documentFileType || null,
        documentPageCount: documentPageCount || null,
        originalText: originalText ? encrypt(originalText) : null,
        sections: sections ? encrypt(JSON.stringify(sections)) : null,
        createdBy,
        organizationId,
        facilityId: facilityId || null,
      },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: decryptPolicyData(policy),
    });
  } catch (error: any) {
    console.error('Error creating workplace policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create workplace policy',
      details: error.message,
    });
  }
});

// GET /api/conflict-cases/workplace-policies
// Get all policies for organization
router.get('/workplace-policies', async (req: Request, res: Response) => {
  try {
    const { organizationId, status } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required',
      });
    }

    const where: any = {
      organizationId: organizationId as string,
    };

    if (status) {
      where.status = status;
    }

    const policies = await prisma.workplacePolicyDoc.findMany({
      where,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const decryptedPolicies = policies.map(decryptPolicyData);

    res.json({
      success: true,
      data: decryptedPolicies,
    });
  } catch (error: any) {
    console.error('Error fetching workplace policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workplace policies',
      details: error.message,
    });
  }
});

// GET /api/conflict-cases/workplace-policies/:id
// Get single policy by ID
router.get('/workplace-policies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const policy = await prisma.workplacePolicyDoc.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
      });
    }

    res.json({
      success: true,
      data: decryptPolicyData(policy),
    });
  } catch (error: any) {
    console.error('Error fetching workplace policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workplace policy',
      details: error.message,
    });
  }
});

// PATCH /api/conflict-cases/workplace-policies/:id
// Update a policy
router.patch('/workplace-policies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      version,
      effectiveDate,
      status,
      description,
      documentFileName,
      documentFileUrl,
      documentFileType,
      documentPageCount,
      originalText,
      sections,
    } = req.body;

    const existing = await prisma.workplacePolicyDoc.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (version !== undefined) updateData.version = version;
    if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate);
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;
    if (documentFileName !== undefined) updateData.documentFileName = documentFileName;
    if (documentFileUrl !== undefined) updateData.documentFileUrl = documentFileUrl;
    if (documentFileType !== undefined) updateData.documentFileType = documentFileType;
    if (documentPageCount !== undefined) updateData.documentPageCount = documentPageCount;
    if (originalText !== undefined) updateData.originalText = encrypt(originalText);
    if (sections !== undefined) updateData.sections = encrypt(JSON.stringify(sections));

    const policy = await prisma.workplacePolicyDoc.update({
      where: { id },
      data: updateData,
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      data: decryptPolicyData(policy),
    });
  } catch (error: any) {
    console.error('Error updating workplace policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update workplace policy',
      details: error.message,
    });
  }
});

// DELETE /api/conflict-cases/workplace-policies/:id
// Delete a policy
router.delete('/workplace-policies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.workplacePolicyDoc.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
      });
    }

    await prisma.workplacePolicyDoc.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Policy deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting workplace policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete workplace policy',
      details: error.message,
    });
  }
});

// ============================================================================
// DOCUMENT EDIT HISTORY ENDPOINTS
// ============================================================================

/**
 * POST /api/conflict-cases/:id/document-edits
 * Save a document edit to the database
 */
router.post('/:id/document-edits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sectionId, sectionTitle, originalContent, newContent, editedBy } = req.body;

    // Validate required fields
    if (!sectionId || !sectionTitle || originalContent === undefined || newContent === undefined || !editedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sectionId, sectionTitle, originalContent, newContent, editedBy',
      });
    }

    // Note: We do NOT check if case exists in DB - cases may only exist locally in the app
    // Edit history is stored by caseId (UUID) which can reference local-only cases

    // Create the document edit with encrypted sensitive fields
    const edit = await prisma.conflictDocumentEdit.create({
      data: {
        caseId: id,
        sectionId,
        sectionTitle: encrypt(sectionTitle),
        originalContent: encrypt(originalContent),
        newContent: encrypt(newContent),
        editedBy: encrypt(editedBy),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: edit.id,
        caseId: edit.caseId,
        sectionId: edit.sectionId,
        sectionTitle,
        originalContent,
        newContent,
        editedBy,
        createdAt: edit.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error saving document edit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save document edit',
      details: error.message,
    });
  }
});

/**
 * GET /api/conflict-cases/:id/document-edits
 * Get all document edits for a case (decrypted)
 */
router.get('/:id/document-edits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Note: We do NOT check if case exists in DB - cases may only exist locally in the app
    // Just query edits by caseId

    // Get all edits for this case, ordered by creation time
    const edits = await prisma.conflictDocumentEdit.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt the sensitive fields
    const decryptedEdits = edits.map(edit => ({
      id: edit.id,
      caseId: edit.caseId,
      sectionId: edit.sectionId,
      sectionTitle: decrypt(edit.sectionTitle),
      originalContent: decrypt(edit.originalContent),
      newContent: decrypt(edit.newContent),
      editedBy: decrypt(edit.editedBy),
      createdAt: edit.createdAt,
    }));

    res.json({
      success: true,
      data: decryptedEdits,
      count: decryptedEdits.length,
    });
  } catch (error: any) {
    console.error('Error fetching document edits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document edits',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/conflict-cases/:id/document-edits/:editId
 * Delete a specific document edit (for undo functionality)
 */
router.delete('/:id/document-edits/:editId', async (req: Request, res: Response) => {
  try {
    const { id, editId } = req.params;

    // Verify edit exists and belongs to this case
    const existingEdit = await prisma.conflictDocumentEdit.findFirst({
      where: { 
        id: editId,
        caseId: id,
      },
    });

    if (!existingEdit) {
      return res.status(404).json({
        success: false,
        error: 'Document edit not found',
      });
    }

    // Delete the edit
    await prisma.conflictDocumentEdit.delete({
      where: { id: editId },
    });

    res.json({
      success: true,
      message: 'Document edit deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting document edit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document edit',
      details: error.message,
    });
  }
});

// ============================================================
// REVIEW COMMENTS ENDPOINTS
// ============================================================

/**
 * POST /api/conflict-cases/:id/review-comments
 * Save a review comment to the database
 */
router.post('/:id/review-comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { section, comment, createdBy } = req.body;

    // Validate required fields
    if (!section || !comment || !createdBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: section, comment, createdBy',
      });
    }

    // Create the review comment with encrypted sensitive fields
    const reviewComment = await prisma.conflictReviewComment.create({
      data: {
        caseId: id,
        section,
        comment: encrypt(comment),
        createdBy: encrypt(createdBy),
        isResolved: false,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: reviewComment.id,
        caseId: reviewComment.caseId,
        section: reviewComment.section,
        comment,
        createdBy,
        isResolved: reviewComment.isResolved,
        createdAt: reviewComment.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error saving review comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save review comment',
      details: error.message,
    });
  }
});

/**
 * GET /api/conflict-cases/:id/review-comments
 * Get all review comments for a case (decrypted)
 */
router.get('/:id/review-comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get all comments for this case, ordered by creation time
    const comments = await prisma.conflictReviewComment.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Decrypt the sensitive fields
    const decryptedComments = comments.map(c => ({
      id: c.id,
      caseId: c.caseId,
      section: c.section,
      comment: decrypt(c.comment),
      createdBy: decrypt(c.createdBy),
      isResolved: c.isResolved,
      createdAt: c.createdAt,
    }));

    res.json({
      success: true,
      data: decryptedComments,
      count: decryptedComments.length,
    });
  } catch (error: any) {
    console.error('Error fetching review comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review comments',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/conflict-cases/:id/review-comments/:commentId/resolve
 * Mark a review comment as resolved
 */
router.patch('/:id/review-comments/:commentId/resolve', async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;

    // Verify comment exists and belongs to this case
    const existingComment = await prisma.conflictReviewComment.findFirst({
      where: { 
        id: commentId,
        caseId: id,
      },
    });

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: 'Review comment not found',
      });
    }

    // Update the comment to resolved
    const updatedComment = await prisma.conflictReviewComment.update({
      where: { id: commentId },
      data: { isResolved: true },
    });

    res.json({
      success: true,
      data: {
        id: updatedComment.id,
        caseId: updatedComment.caseId,
        section: updatedComment.section,
        comment: decrypt(updatedComment.comment),
        createdBy: decrypt(updatedComment.createdBy),
        isResolved: updatedComment.isResolved,
        createdAt: updatedComment.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error resolving review comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve review comment',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/conflict-cases/:id/review-comments/:commentId
 * Delete a specific review comment
 */
router.delete('/:id/review-comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;

    // Verify comment exists and belongs to this case
    const existingComment = await prisma.conflictReviewComment.findFirst({
      where: { 
        id: commentId,
        caseId: id,
      },
    });

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: 'Review comment not found',
      });
    }

    // Delete the comment
    await prisma.conflictReviewComment.delete({
      where: { id: commentId },
    });

    res.json({
      success: true,
      message: 'Review comment deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting review comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review comment',
      details: error.message,
    });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/conflict-cases/analytics
 * Get comprehensive analytics data for conflict resolution cases
 * 
 * Query Parameters:
 * - organizationId (required): Organization to get analytics for
 * - startDate (optional): Start date for date range filter (ISO string)
 * - endDate (optional): End date for date range filter (ISO string)
 * - facilityId (optional): Filter by facility
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { organizationId, startDate, endDate, facilityId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate);
    }

    // Build base where clause
    const whereClause: any = {
      organizationId: organizationId,
    };
    
    if (facilityId && typeof facilityId === 'string') {
      whereClause.facilityId = facilityId;
    }
    
    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter;
    }

    // 1. Get total case counts by status
    const statusCounts = await prisma.conflictCase.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { id: true },
    });

    // 2. Get total case counts by type
    const typeCounts = await prisma.conflictCase.groupBy({
      by: ['type'],
      where: whereClause,
      _count: { id: true },
    });

    // 3. Get closure reason distribution (only for closed cases)
    const closedCasesWhere = { ...whereClause, status: 'CLOSED' as const };
    const closureReasonCounts = await prisma.conflictCase.groupBy({
      by: ['closureReason'],
      where: closedCasesWhere,
      _count: { id: true },
    });

    // 4. Get action type distribution
    const actionTypeCounts = await prisma.conflictCase.groupBy({
      by: ['selectedAction'],
      where: {
        ...whereClause,
        selectedAction: { not: null },
      },
      _count: { id: true },
    });

    // 5. Calculate resolution time metrics (days from creation to closure)
    const closedCases = await prisma.conflictCase.findMany({
      where: closedCasesWhere,
      select: {
        createdAt: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    // Calculate average resolution time in days
    let totalResolutionDays = 0;
    let resolvedCount = 0;
    let minResolutionDays = Infinity;
    let maxResolutionDays = 0;

    for (const caseItem of closedCases) {
      const closeDate = caseItem.closedAt || caseItem.updatedAt;
      const diffTime = closeDate.getTime() - caseItem.createdAt.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0) {
        totalResolutionDays += diffDays;
        resolvedCount++;
        minResolutionDays = Math.min(minResolutionDays, diffDays);
        maxResolutionDays = Math.max(maxResolutionDays, diffDays);
      }
    }

    const avgResolutionDays = resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount * 10) / 10 : 0;

    // 6. Get monthly trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrendCases = await prisma.conflictCase.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: twelveMonthsAgo },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        closedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by month
    const monthlyData: { [key: string]: { created: number; closed: number } } = {};
    
    for (const caseItem of monthlyTrendCases) {
      const monthKey = `${caseItem.createdAt.getFullYear()}-${String(caseItem.createdAt.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { created: 0, closed: 0 };
      }
      monthlyData[monthKey].created++;
      
      // Check if closed in same month
      if (caseItem.closedAt) {
        const closedMonthKey = `${caseItem.closedAt.getFullYear()}-${String(caseItem.closedAt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[closedMonthKey]) {
          monthlyData[closedMonthKey] = { created: 0, closed: 0 };
        }
        monthlyData[closedMonthKey].closed++;
      }
    }

    // Convert to sorted array
    const monthlyTrends = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        created: data.created,
        closed: data.closed,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 7. Get overall totals
    const totalCases = await prisma.conflictCase.count({ where: whereClause });
    const activeCases = await prisma.conflictCase.count({
      where: {
        ...whereClause,
        status: { in: ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'AWAITING_ACTION'] },
      },
    });
    const closedCasesCount = await prisma.conflictCase.count({ where: closedCasesWhere });
    const escalatedCases = await prisma.conflictCase.count({
      where: { ...whereClause, status: 'ESCALATED' },
    });

    // 8. Get department breakdown (decrypt department names)
    const departmentCases = await prisma.conflictCase.findMany({
      where: whereClause,
      select: {
        department: true,
        status: true,
      },
    });

    const departmentStats: { [key: string]: { total: number; active: number; closed: number } } = {};
    const activeStatuses = ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'AWAITING_ACTION', 'ESCALATED'];

    for (const c of departmentCases) {
      const deptName = c.department ? decrypt(c.department) : 'Unknown';
      if (!departmentStats[deptName]) {
        departmentStats[deptName] = { total: 0, active: 0, closed: 0 };
      }
      departmentStats[deptName].total++;
      if (c.status === 'CLOSED') {
        departmentStats[deptName].closed++;
      } else if (activeStatuses.includes(c.status)) {
        departmentStats[deptName].active++;
      }
    }

    const departmentBreakdown = Object.entries(departmentStats)
      .map(([department, stats]) => ({
        department,
        ...stats,
      }))
      .sort((a, b) => b.total - a.total);

    // 9. Decrypt closure reasons for display
    const closureReasonBreakdown = closureReasonCounts.map(item => ({
      reason: item.closureReason ? decrypt(item.closureReason) : 'Not Specified',
      count: item._count.id,
    }));

    // Build response
    const analyticsData = {
      summary: {
        totalCases,
        activeCases,
        closedCases: closedCasesCount,
        escalatedCases,
        resolutionRate: totalCases > 0 ? Math.round((closedCasesCount / totalCases) * 100 * 10) / 10 : 0,
      },
      resolutionMetrics: {
        averageDays: avgResolutionDays,
        minDays: minResolutionDays === Infinity ? 0 : minResolutionDays,
        maxDays: maxResolutionDays,
        totalResolved: resolvedCount,
      },
      statusBreakdown: statusCounts.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
      typeBreakdown: typeCounts.map(item => ({
        type: item.type,
        count: item._count.id,
      })),
      closureReasonBreakdown,
      actionTypeBreakdown: actionTypeCounts.map(item => ({
        actionType: item.selectedAction,
        count: item._count.id,
      })),
      monthlyTrends,
      departmentBreakdown,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: analyticsData,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data',
      details: error.message,
    });
  }
});

export default router;

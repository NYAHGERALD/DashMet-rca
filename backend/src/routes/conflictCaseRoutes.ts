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
  
  // Decrypt sensitive string fields
  if (decrypted.description) decrypted.description = decrypt(decrypted.description);
  if (decrypted.aiComparisonResultJson) decrypted.aiComparisonResultJson = decrypt(decrypted.aiComparisonResultJson);
  if (decrypted.aiRecommendationsJson) decrypted.aiRecommendationsJson = decrypt(decrypted.aiRecommendationsJson);
  if (decrypted.generatedActionDocJson) decrypted.generatedActionDocJson = decrypt(decrypted.generatedActionDocJson);
  if (decrypted.policyMatchesJson) decrypted.policyMatchesJson = decrypt(decrypted.policyMatchesJson);
  if (decrypted.supervisorNotes) decrypted.supervisorNotes = decrypt(decrypted.supervisorNotes);
  if (decrypted.finalDecision) decrypted.finalDecision = decrypt(decrypted.finalDecision);
  
  // Decrypt employee statements
  if (decrypted.employees) {
    decrypted.employees = decrypted.employees.map((emp: any) => ({
      ...emp,
      statement: emp.statement ? decrypt(emp.statement) : emp.statement,
    }));
  }
  
  // Decrypt document content
  if (decrypted.documents) {
    decrypted.documents = decrypted.documents.map((doc: any) => ({
      ...doc,
      content: doc.content ? decrypt(doc.content) : doc.content,
      extractedText: doc.extractedText ? decrypt(doc.extractedText) : doc.extractedText,
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
      employeesJson,
      documentsJson,
      aiComparisonResultJson,
      aiRecommendationsJson,
      selectedActionType,
      generatedActionDocJson,
      policyMatchesJson,
      supervisorNotes,
      finalDecision,
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

    // Create case with encrypted sensitive data
    const conflictCase = await prisma.conflictCase.create({
      data: {
        caseNumber,
        caseType: caseType || 'INTERPERSONAL_CONFLICT',
        status: status || 'DRAFT',
        description: description ? encrypt(description) : null,
        reportedDate: reportedDate ? new Date(reportedDate) : new Date(),
        aiComparisonResultJson: aiComparisonResultJson ? encrypt(JSON.stringify(aiComparisonResultJson)) : null,
        aiRecommendationsJson: aiRecommendationsJson ? encrypt(JSON.stringify(aiRecommendationsJson)) : null,
        selectedActionType: selectedActionType || null,
        generatedActionDocJson: generatedActionDocJson ? encrypt(JSON.stringify(generatedActionDocJson)) : null,
        policyMatchesJson: policyMatchesJson ? encrypt(JSON.stringify(policyMatchesJson)) : null,
        supervisorNotes: supervisorNotes ? encrypt(supervisorNotes) : null,
        finalDecision: finalDecision ? encrypt(finalDecision) : null,
        creatorId,
        organizationId,
        facilityId: facilityId || null,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        employees: true,
        documents: true,
        auditTrail: {
          orderBy: { createdAt: 'desc' },
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
            name: emp.name,
            role: emp.role || null,
            department: emp.department || null,
            employeeId: emp.employeeId || null,
            isComplainant: emp.isComplainant || false,
            statement: emp.statement ? encrypt(emp.statement) : null,
          },
        });
      }
    }

    // Parse and add documents if provided
    if (documentsJson) {
      const documents = typeof documentsJson === 'string' ? JSON.parse(documentsJson) : documentsJson;
      
      for (const doc of documents) {
        await prisma.conflictCaseDocument.create({
          data: {
            caseId: conflictCase.id,
            name: doc.name,
            type: doc.type || 'OTHER',
            url: doc.url || null,
            uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
            content: doc.content ? encrypt(doc.content) : null,
            extractedText: doc.extractedText ? encrypt(doc.extractedText) : null,
          },
        });
      }
    }

    // Add audit entry for creation
    await prisma.conflictCaseAuditEntry.create({
      data: {
        caseId: conflictCase.id,
        action: 'CREATED',
        description: 'Case created',
        userId: creatorId,
        changes: JSON.stringify({ status: 'DRAFT' }),
      },
    });

    // Fetch complete case with all relations
    const completeCase = await prisma.conflictCase.findUnique({
      where: { id: conflictCase.id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        employees: true,
        documents: true,
        auditTrail: {
          orderBy: { createdAt: 'desc' },
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
      where.caseType = caseType as any;
    }

    const [cases, total] = await Promise.all([
      prisma.conflictCase.findMany({
        where,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          facility: {
            select: { id: true, name: true },
          },
          employees: true,
          _count: {
            select: { documents: true, auditTrail: true },
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

// ============================================================================
// GET /api/conflict-cases/:id
// Get single case by ID
// ============================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conflictCase = await prisma.conflictCase.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        employees: true,
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        auditTrail: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!conflictCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }

    res.json({
      success: true,
      data: decryptCaseData(conflictCase),
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
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      caseType,
      status,
      description,
      aiComparisonResultJson,
      aiRecommendationsJson,
      selectedActionType,
      generatedActionDocJson,
      policyMatchesJson,
      supervisorNotes,
      finalDecision,
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
      updateData.caseType = caseType;
      changes.caseType = { from: existingCase.caseType, to: caseType };
    }
    if (status !== undefined) {
      updateData.status = status;
      changes.status = { from: existingCase.status, to: status };
    }
    if (description !== undefined) {
      updateData.description = encrypt(description);
      changes.description = 'updated';
    }
    if (aiComparisonResultJson !== undefined) {
      updateData.aiComparisonResultJson = encrypt(JSON.stringify(aiComparisonResultJson));
      changes.aiComparisonResult = 'updated';
    }
    if (aiRecommendationsJson !== undefined) {
      updateData.aiRecommendationsJson = encrypt(JSON.stringify(aiRecommendationsJson));
      changes.aiRecommendations = 'updated';
    }
    if (selectedActionType !== undefined) {
      updateData.selectedActionType = selectedActionType;
      changes.selectedActionType = { from: existingCase.selectedActionType, to: selectedActionType };
    }
    if (generatedActionDocJson !== undefined) {
      updateData.generatedActionDocJson = encrypt(JSON.stringify(generatedActionDocJson));
      changes.generatedActionDoc = 'updated';
    }
    if (policyMatchesJson !== undefined) {
      updateData.policyMatchesJson = encrypt(JSON.stringify(policyMatchesJson));
      changes.policyMatches = 'updated';
    }
    if (supervisorNotes !== undefined) {
      updateData.supervisorNotes = encrypt(supervisorNotes);
      changes.supervisorNotes = 'updated';
    }
    if (finalDecision !== undefined) {
      updateData.finalDecision = encrypt(finalDecision);
      changes.finalDecision = 'updated';
    }

    const updatedCase = await prisma.conflictCase.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true },
        },
        employees: true,
        documents: true,
        auditTrail: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Add audit entry
    if (userId && Object.keys(changes).length > 0) {
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'UPDATED',
          description: `Case updated: ${Object.keys(changes).join(', ')}`,
          userId,
          changes: JSON.stringify(changes),
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
// DELETE /api/conflict-cases/:id
// Delete a case
// ============================================================================
router.delete('/:id', async (req: Request, res: Response) => {
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
        name,
        role: role || null,
        department: department || null,
        employeeId: employeeId || null,
        isComplainant: isComplainant || false,
        statement: statement ? encrypt(statement) : null,
      },
    });

    // Add audit entry
    if (userId) {
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_ADDED',
          description: `Employee added: ${name}`,
          userId,
          changes: JSON.stringify({ employeeId: employee.id, name }),
        },
      });
    }

    // Decrypt statement before returning
    const decryptedEmployee = {
      ...employee,
      statement: employee.statement ? decrypt(employee.statement) : null,
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
    const { name, role, department, employeeIdField, isComplainant, statement, userId } = req.body;

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
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (employeeIdField !== undefined) updateData.employeeId = employeeIdField;
    if (isComplainant !== undefined) updateData.isComplainant = isComplainant;
    if (statement !== undefined) updateData.statement = encrypt(statement);

    const updatedEmployee = await prisma.conflictInvolvedEmployee.update({
      where: { id: employeeId },
      data: updateData,
    });

    // Add audit entry
    if (userId) {
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_UPDATED',
          description: `Employee updated: ${updatedEmployee.name}`,
          userId,
          changes: JSON.stringify(updateData),
        },
      });
    }

    const decryptedEmployee = {
      ...updatedEmployee,
      statement: updatedEmployee.statement ? decrypt(updatedEmployee.statement) : null,
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
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'EMPLOYEE_REMOVED',
          description: `Employee removed: ${employee.name}`,
          userId: userId as string,
          changes: JSON.stringify({ employeeId, name: employee.name }),
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
    const { name, type, url, content, extractedText, userId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Document name is required',
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

    const document = await prisma.conflictCaseDocument.create({
      data: {
        caseId: id,
        name,
        type: type || 'OTHER',
        url: url || null,
        content: content ? encrypt(content) : null,
        extractedText: extractedText ? encrypt(extractedText) : null,
      },
    });

    // Add audit entry
    if (userId) {
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'DOCUMENT_ADDED',
          description: `Document added: ${name}`,
          userId,
          changes: JSON.stringify({ documentId: document.id, name, type }),
        },
      });
    }

    const decryptedDoc = {
      ...document,
      content: document.content ? decrypt(document.content) : null,
      extractedText: document.extractedText ? decrypt(document.extractedText) : null,
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
      await prisma.conflictCaseAuditEntry.create({
        data: {
          caseId: id,
          action: 'DOCUMENT_REMOVED',
          description: `Document removed: ${document.name}`,
          userId: userId as string,
          changes: JSON.stringify({ documentId, name: document.name }),
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
      orderBy: { createdAt: 'desc' },
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

export default router;

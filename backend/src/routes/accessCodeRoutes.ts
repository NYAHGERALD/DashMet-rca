import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireSystemAdmin } from '../middleware/rbac';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

/**
 * Generate a unique 6-digit access code
 */
async function generateUniqueAccessCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if code already exists
    const existingCode = await prisma.accessCode.findUnique({
      where: { code }
    });
    
    if (!existingCode) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique access code after maximum attempts');
}

/**
 * POST /api/access-codes
 * Generate a new access code (SYSTEM_ADMIN only)
 */
router.post('/', authenticate, requireSystemAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { role, maxUses } = req.body;

    // Validate role
    if (!role || !Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Valid role is required'
      });
    }

    // Validate maxUses
    const parsedMaxUses = maxUses ? parseInt(maxUses) : 1000;
    if (isNaN(parsedMaxUses) || parsedMaxUses < 1) {
      return res.status(400).json({
        success: false,
        error: 'maxUses must be a positive number'
      });
    }

    // Generate unique code
    const code = await generateUniqueAccessCode();

    // Create access code
    const accessCode = await prisma.accessCode.create({
      data: {
        id: uuidv4(),
        updatedAt: new Date(),
        code,
        role,
        maxUses: parsedMaxUses,
        isActive: true,
        usedCount: 0
      }
    });

    res.status(201).json({
      success: true,
      data: accessCode,
      message: 'Access code generated successfully'
    });
  } catch (error: any) {
    console.error('Generate access code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate access code'
    });
  }
});

/**
 * GET /api/access-codes
 * List all access codes (SYSTEM_ADMIN only)
 */
router.get('/', authenticate, requireSystemAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const accessCodes = await prisma.accessCode.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: accessCodes
    });
  } catch (error: any) {
    console.error('List access codes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load access codes'
    });
  }
});

/**
 * PATCH /api/access-codes/:id/toggle
 * Toggle access code active status (SYSTEM_ADMIN only)
 */
router.patch('/:id/toggle', authenticate, requireSystemAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const accessCode = await prisma.accessCode.findUnique({
      where: { id }
    });

    if (!accessCode) {
      return res.status(404).json({
        success: false,
        error: 'Access code not found'
      });
    }

    const updated = await prisma.accessCode.update({
      where: { id },
      data: {
        isActive: !accessCode.isActive
      }
    });

    res.json({
      success: true,
      data: updated,
      message: `Access code ${updated.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error: any) {
    console.error('Toggle access code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle access code'
    });
  }
});

/**
 * PATCH /api/access-codes/:id/max-uses
 * Update max uses for an access code (SYSTEM_ADMIN only)
 */
router.patch('/:id/max-uses', authenticate, requireSystemAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { maxUses } = req.body;

    // Validate maxUses
    const parsedMaxUses = parseInt(maxUses);
    if (isNaN(parsedMaxUses) || parsedMaxUses < 1) {
      return res.status(400).json({
        success: false,
        error: 'maxUses must be a positive number'
      });
    }

    const accessCode = await prisma.accessCode.findUnique({
      where: { id }
    });

    if (!accessCode) {
      return res.status(404).json({
        success: false,
        error: 'Access code not found'
      });
    }

    const updated = await prisma.accessCode.update({
      where: { id },
      data: { maxUses: parsedMaxUses }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Max uses updated successfully'
    });
  } catch (error: any) {
    console.error('Update max uses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update max uses'
    });
  }
});

/**
 * DELETE /api/access-codes/:id
 * Delete access code (SYSTEM_ADMIN only)
 */
router.delete('/:id', authenticate, requireSystemAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const accessCode = await prisma.accessCode.findUnique({
      where: { id }
    });

    if (!accessCode) {
      return res.status(404).json({
        success: false,
        error: 'Access code not found'
      });
    }

    await prisma.accessCode.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Access code deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete access code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete access code'
    });
  }
});

export default router;

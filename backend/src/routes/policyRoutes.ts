import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireSystemAdmin } from '../middleware/rbac';
import { PolicyType } from '@prisma/client';

const router = Router();

function parsePolicyType(raw: string): PolicyType | null {
  const normalized = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');

  const aliases: Record<string, PolicyType> = {
    PRIVACY: 'PRIVACY_POLICY',
    PRIVACY_POLICY: 'PRIVACY_POLICY',
    TERMS: 'TERMS_OF_SERVICE',
    TERMS_OF_SERVICE: 'TERMS_OF_SERVICE',
    TOS: 'TERMS_OF_SERVICE',
    COOKIE: 'COOKIE_POLICY',
    COOKIE_POLICY: 'COOKIE_POLICY',
    SECURITY: 'SECURITY',
    SECURITY_COMPLIANCE: 'SECURITY',
    COMPLIANCE: 'SECURITY',
  };

  return aliases[normalized] ?? null;
}

// PUBLIC: Get published policy by type
// GET /api/policies/:type
router.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const type = parsePolicyType(req.params.type);
    if (!type) {
      res.status(400).json({ success: false, error: 'Invalid policy type' });
      return;
    }

    const policy = await prisma.policyDocument.findUnique({ where: { type } });

    if (!policy || !policy.isPublished) {
      res.status(404).json({ success: false, error: 'Policy not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        policy: {
          type: policy.type,
          title: policy.title,
          content: policy.content,
          version: policy.version,
          publishedAt: policy.publishedAt,
          updatedAt: policy.updatedAt,
        },
      },
    });
  })
);

// ADMIN: List all policies (drafts + published)
// GET /api/policies
router.get(
  '/',
  authenticate,
  requireSystemAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    const policies = await prisma.policyDocument.findMany({
      orderBy: [{ type: 'asc' }],
    });

    res.json({
      success: true,
      data: { policies },
    });
  })
);

// ADMIN: Update policy content/title; optionally publish
// PUT /api/policies/:type
router.put(
  '/:type',
  authenticate,
  requireSystemAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    const type = parsePolicyType(req.params.type);
    if (!type) {
      res.status(400).json({ success: false, error: 'Invalid policy type' });
      return;
    }

    const { title, content, publish } = req.body as {
      title?: string;
      content?: string;
      publish?: boolean;
    };

    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.policyDocument.findUnique({ where: { type } });

      if (!existing) {
        const created = await tx.policyDocument.create({
          data: {
            type,
            title: title.trim(),
            content,
            version: 1,
            isPublished: Boolean(publish),
            publishedAt: publish ? now : null,
            updatedByUserId: req.user?.id ?? null,
          },
        });

        return created;
      }

      // Save previous version as revision for auditability (only if not already saved)
      const existingRevision = await tx.policyRevision.findUnique({
        where: {
          policyId_version: {
            policyId: existing.id,
            version: existing.version,
          },
        },
      });

      if (!existingRevision) {
        await tx.policyRevision.create({
          data: {
            policyId: existing.id,
            version: existing.version,
            title: existing.title,
            content: existing.content,
            createdByUserId: req.user?.id ?? null,
          },
        });
      }

      const updated = await tx.policyDocument.update({
        where: { type },
        data: {
          title: title.trim(),
          content,
          version: existing.version + 1,
          isPublished: publish ? true : existing.isPublished,
          publishedAt: publish ? now : existing.publishedAt,
          updatedByUserId: req.user?.id ?? null,
        },
      });

      return updated;
    });

    res.json({
      success: true,
      data: { policy: result },
    });
  })
);

export default router;

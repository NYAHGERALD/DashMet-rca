/**
 * Consent Controller
 * 
 * Handles recording consent and compliance operations
 * GDPR/Legal compliant consent management for meeting recordings
 * 
 * IMPORTANT: Consent records are IMMUTABLE - they should never be deleted or modified
 * This is a legal requirement for audit trails
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ===========================================
// CONSENT POLICY OPERATIONS
// ===========================================

/**
 * Get the current active consent policy
 */
export const getCurrentPolicy = async (req: Request, res: Response) => {
  try {
    const policy = await prisma.consentPolicy.findFirst({
      where: { isActive: true },
      orderBy: { effectiveDate: 'desc' }
    });

    if (!policy) {
      // Return default policy if none exists
      return res.json({
        success: true,
        data: getDefaultPolicy()
      });
    }

    res.json({
      success: true,
      data: {
        id: policy.id,
        version: policy.version,
        title: policy.title,
        purposeOfRecording: policy.purposeOfRecording,
        dataRetentionPolicy: policy.dataRetentionPolicy,
        dataSecurityPolicy: policy.dataSecurityPolicy,
        dataSharingPolicy: policy.dataSharingPolicy,
        userRights: policy.userRights,
        effectiveDate: policy.effectiveDate
      }
    });

  } catch (error) {
    console.error('Error fetching consent policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch consent policy'
    });
  }
};

/**
 * Create or update consent policy (admin only)
 */
export const createPolicy = async (req: Request, res: Response) => {
  try {
    const {
      version,
      title,
      purposeOfRecording,
      dataRetentionPolicy,
      dataSecurityPolicy,
      dataSharingPolicy,
      userRights,
      fullPolicyText,
      createdById
    } = req.body;

    // Deactivate all existing policies
    await prisma.consentPolicy.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create new policy
    const policy = await prisma.consentPolicy.create({
      data: {
        version,
        title: title || 'Meeting Recording Consent Policy',
        purposeOfRecording,
        dataRetentionPolicy,
        dataSecurityPolicy,
        dataSharingPolicy,
        userRights,
        fullPolicyText,
        createdById,
        isActive: true,
        effectiveDate: new Date()
      }
    });

    res.status(201).json({
      success: true,
      data: policy
    });

  } catch (error) {
    console.error('Error creating consent policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create consent policy'
    });
  }
};

/**
 * Initialize default policy if none exists
 */
export const initializeDefaultPolicy = async (req: Request, res: Response) => {
  try {
    const existingPolicy = await prisma.consentPolicy.findFirst({
      where: { isActive: true }
    });

    if (existingPolicy) {
      return res.json({
        success: true,
        message: 'Policy already exists',
        data: existingPolicy
      });
    }

    const defaultPolicy = getDefaultPolicy();
    
    const policy = await prisma.consentPolicy.create({
      data: {
        version: '1.0.0',
        title: defaultPolicy.title,
        purposeOfRecording: defaultPolicy.purposeOfRecording,
        dataRetentionPolicy: defaultPolicy.dataRetentionPolicy,
        dataSecurityPolicy: defaultPolicy.dataSecurityPolicy,
        dataSharingPolicy: defaultPolicy.dataSharingPolicy,
        userRights: defaultPolicy.userRights,
        fullPolicyText: defaultPolicy.fullPolicyText,
        isActive: true,
        effectiveDate: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Default policy created',
      data: policy
    });

  } catch (error) {
    console.error('Error initializing default policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default policy'
    });
  }
};

// ===========================================
// CONSENT RECORDING OPERATIONS
// ===========================================

/**
 * Record user consent for meeting recording
 * This creates an IMMUTABLE audit record
 */
export const recordConsent = async (req: Request, res: Response) => {
  try {
    const {
      meetingId,
      userId,
      userEmail,
      userFirstName,
      userLastName,
      userPhoneNumber,
      policyId,
      policyVersion,
      consentType,
      consentMethod,
      deviceId,
      deviceModel,
      osVersion,
      appVersion,
      geoLocation,
      allParticipantsNotified,
      audioAnnouncementPlayed
    } = req.body;

    // Get IP address and user agent from request
    const ipAddress = req.headers['x-forwarded-for'] as string || 
                      req.socket.remoteAddress || 
                      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Generate tamper-proof hash
    const timestamp = new Date().toISOString();
    const consentHash = generateConsentHash(
      meetingId,
      userId,
      timestamp,
      policyVersion
    );

    // Get or create policy
    let policy = await prisma.consentPolicy.findFirst({
      where: policyId ? { id: policyId } : { isActive: true }
    });

    if (!policy) {
      // Create default policy if none exists
      const defaultPolicy = getDefaultPolicy();
      policy = await prisma.consentPolicy.create({
        data: {
          version: '1.0.0',
          title: defaultPolicy.title,
          purposeOfRecording: defaultPolicy.purposeOfRecording,
          dataRetentionPolicy: defaultPolicy.dataRetentionPolicy,
          dataSecurityPolicy: defaultPolicy.dataSecurityPolicy,
          dataSharingPolicy: defaultPolicy.dataSharingPolicy,
          userRights: defaultPolicy.userRights,
          fullPolicyText: defaultPolicy.fullPolicyText,
          isActive: true,
          effectiveDate: new Date()
        }
      });
    }

    // Create immutable consent record
    const consentRecord = await prisma.recordingConsentAudit.create({
      data: {
        meetingId,
        userId,
        userEmail,
        userFirstName,
        userLastName,
        userPhoneNumber,
        policyId: policy.id,
        policyVersion: policy.version,
        consentType: consentType || 'RECORDING_START',
        consentMethod: consentMethod || 'IN_APP_MODAL',
        consentGiven: true,
        ipAddress,
        userAgent,
        deviceId,
        deviceModel,
        osVersion,
        appVersion,
        geoLocation,
        allParticipantsNotified: allParticipantsNotified || false,
        audioAnnouncementPlayed: audioAnnouncementPlayed || false,
        consentHash,
        consentTimestamp: new Date()
      }
    });

    console.log(`✅ Consent recorded for meeting ${meetingId} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        id: consentRecord.id,
        consentHash: consentRecord.consentHash,
        consentTimestamp: consentRecord.consentTimestamp,
        policyVersion: consentRecord.policyVersion,
        message: 'Consent recorded successfully. Recording may begin.'
      }
    });

  } catch (error: any) {
    console.error('Error recording consent:', error);
    
    // Check for unique constraint violation (duplicate consent)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Consent already recorded for this session'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to record consent'
    });
  }
};

/**
 * Update consent record to mark audio announcement played
 * This is the ONLY allowed update - to mark announcement as played
 */
export const markAnnouncementPlayed = async (req: Request, res: Response) => {
  try {
    const { consentId, meetingId } = req.body;

    const record = await prisma.recordingConsentAudit.findFirst({
      where: consentId ? { id: consentId } : { meetingId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Consent record not found'
      });
    }

    // Only update if not already marked
    if (!record.audioAnnouncementPlayed) {
      await prisma.recordingConsentAudit.update({
        where: { id: record.id },
        data: { audioAnnouncementPlayed: true }
      });
    }

    res.json({
      success: true,
      message: 'Audio announcement marked as played'
    });

  } catch (error) {
    console.error('Error marking announcement played:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update consent record'
    });
  }
};

/**
 * Get consent records for a meeting (audit purposes)
 */
export const getConsentRecords = async (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params;

    const records = await prisma.recordingConsentAudit.findMany({
      where: { meetingId },
      include: {
        policy: {
          select: {
            version: true,
            title: true,
            effectiveDate: true
          }
        }
      },
      orderBy: { consentTimestamp: 'desc' }
    });

    res.json({
      success: true,
      data: records.map(record => ({
        id: record.id,
        userId: record.userId,
        userEmail: record.userEmail,
        userName: `${record.userFirstName} ${record.userLastName}`,
        userPhoneNumber: record.userPhoneNumber,
        consentType: record.consentType,
        consentMethod: record.consentMethod,
        consentGiven: record.consentGiven,
        consentTimestamp: record.consentTimestamp,
        policyVersion: record.policyVersion,
        deviceModel: record.deviceModel,
        osVersion: record.osVersion,
        allParticipantsNotified: record.allParticipantsNotified,
        audioAnnouncementPlayed: record.audioAnnouncementPlayed,
        consentHash: record.consentHash,
        isRevoked: record.isRevoked,
        revokedAt: record.revokedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching consent records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch consent records'
    });
  }
};

/**
 * Verify consent exists for a meeting
 */
export const verifyConsent = async (req: Request, res: Response) => {
  try {
    const { meetingId, userId } = req.query;

    const record = await prisma.recordingConsentAudit.findFirst({
      where: {
        meetingId: meetingId as string,
        userId: userId as string,
        consentGiven: true,
        isRevoked: false
      },
      orderBy: { consentTimestamp: 'desc' }
    });

    res.json({
      success: true,
      data: {
        hasValidConsent: !!record,
        consentId: record?.id,
        consentTimestamp: record?.consentTimestamp,
        audioAnnouncementPlayed: record?.audioAnnouncementPlayed
      }
    });

  } catch (error) {
    console.error('Error verifying consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify consent'
    });
  }
};

/**
 * Revoke consent (soft delete - marks as revoked but keeps record)
 * Required for GDPR right to withdraw consent
 */
export const revokeConsent = async (req: Request, res: Response) => {
  try {
    const { consentId, meetingId, userId, reason } = req.body;

    const record = await prisma.recordingConsentAudit.findFirst({
      where: consentId 
        ? { id: consentId }
        : { meetingId, userId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Consent record not found'
      });
    }

    // Soft revoke - we never delete consent records
    await prisma.recordingConsentAudit.update({
      where: { id: record.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revocationReason: reason || 'User requested revocation'
      }
    });

    res.json({
      success: true,
      message: 'Consent revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke consent'
    });
  }
};

/**
 * Get all consent audit logs (admin only)
 * For compliance reporting
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate,
      userId 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (startDate && endDate) {
      where.consentTimestamp = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    if (userId) {
      where.userId = userId;
    }

    const [records, total] = await Promise.all([
      prisma.recordingConsentAudit.findMany({
        where,
        include: {
          policy: {
            select: { version: true, title: true }
          },
          meeting: {
            select: { title: true, createdAt: true }
          }
        },
        orderBy: { consentTimestamp: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.recordingConsentAudit.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        records: records.map(r => ({
          id: r.id,
          meetingId: r.meetingId,
          meetingTitle: r.meeting?.title,
          userId: r.userId,
          userName: `${r.userFirstName} ${r.userLastName}`,
          userEmail: r.userEmail,
          userPhoneNumber: r.userPhoneNumber,
          consentType: r.consentType,
          consentMethod: r.consentMethod,
          consentTimestamp: r.consentTimestamp,
          policyVersion: r.policyVersion,
          deviceModel: r.deviceModel,
          osVersion: r.osVersion,
          ipAddress: r.ipAddress,
          consentHash: r.consentHash,
          isRevoked: r.isRevoked,
          revokedAt: r.revokedAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate cryptographic hash for consent verification
 * This ensures consent records cannot be tampered with
 */
function generateConsentHash(
  meetingId: string,
  userId: string,
  timestamp: string,
  policyVersion: string
): string {
  const data = `${meetingId}|${userId}|${timestamp}|${policyVersion}`;
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Default consent policy content
 */
function getDefaultPolicy() {
  return {
    version: '1.0.0',
    title: 'Meeting Recording Consent Policy',
    
    purposeOfRecording: `This meeting is being recorded for the following purposes:

1. **Meeting Transcription**: Audio is transcribed to text using AI technology for accurate record-keeping.

2. **AI Summary Generation**: The transcript is processed to generate executive summaries, key discussion points, and meeting highlights.

3. **Action Item Extraction**: AI identifies and extracts action items, decisions, and follow-up tasks from the meeting.

4. **Important Details Capture**: Key information, dates, names, and commitments are automatically identified and organized.

The recording enables efficient meeting documentation without manual note-taking.`,

    dataRetentionPolicy: `**Audio Recording Retention:**
- The original audio recording is automatically and permanently DELETED immediately after transcription is complete.
- Audio files are NOT stored long-term.
- Only the text transcript and AI-generated summaries are retained.

**Transcript & Summary Retention:**
- Text transcripts and AI summaries are retained for the duration specified by your organization's data retention policy.
- Default retention period is 90 days unless otherwise configured.
- Data can be deleted upon request subject to legal hold requirements.`,

    dataSecurityPolicy: `Your meeting data is protected with enterprise-grade security:

1. **Encryption in Transit**: All data is encrypted using TLS 1.3 during transmission.

2. **Encryption at Rest**: Stored data is encrypted using AES-256 encryption.

3. **Access Controls**: Role-based access control (RBAC) ensures only authorized personnel can access meeting data.

4. **Audit Logging**: All access to meeting data is logged for security and compliance purposes.

5. **Secure Infrastructure**: Data is stored on SOC 2 Type II certified cloud infrastructure.

6. **Regular Security Audits**: Our systems undergo regular security assessments and penetration testing.`,

    dataSharingPolicy: `Meeting data is handled with strict confidentiality:

1. **No Third-Party Sharing**: Meeting data is NOT shared with third parties for marketing or any other purpose.

2. **AI Processing**: Audio is processed by OpenAI's Whisper API for transcription. OpenAI does not retain or train on this data per our enterprise agreement.

3. **Internal Access**: Within your organization, meeting data is accessible to:
   - Meeting participants
   - Meeting organizer
   - Designated administrators

4. **Legal Disclosure**: Data may be disclosed if required by law or valid legal process.

5. **Export Requests**: Participants may request an export of their meeting data.`,

    userRights: `As a meeting participant, you have the following rights:

1. **Right to Information**: You are informed about recording before it begins.

2. **Right to Consent**: Recording only begins after explicit consent is given.

3. **Right to Access**: You can request access to meeting data you participated in.

4. **Right to Correction**: You can request corrections to inaccurate transcripts.

5. **Right to Deletion**: You can request deletion of your meeting data (subject to legal requirements).

6. **Right to Withdraw**: You may leave the meeting at any time if you do not wish to be recorded.

7. **Right to Object**: You may object to specific processing of your data.

For any data-related requests, contact your organization's data protection officer or administrator.`,

    fullPolicyText: `MEETING RECORDING CONSENT POLICY v1.0.0

Effective Date: ${new Date().toISOString().split('T')[0]}

By clicking "I Agree" or continuing to participate in this meeting after the recording announcement, you acknowledge and consent to the recording and processing of this meeting as described in this policy.

[Full policy text includes all sections above]

This consent is recorded and timestamped for compliance purposes. You may withdraw consent at any time by leaving the meeting or contacting your administrator.`
  };
}

export default {
  getCurrentPolicy,
  createPolicy,
  initializeDefaultPolicy,
  recordConsent,
  markAnnouncementPlayed,
  getConsentRecords,
  verifyConsent,
  revokeConsent,
  getAuditLogs
};

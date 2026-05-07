# Adaptive MFA + VPN Blocking — Implementation Guide

> **DashMet Operations Intelligence — Security Enhancement**
> Email OTP (location-based) + VPN/Proxy Detection + Trusted Device Memory  
> Date: April 7, 2026 | Updated: April 8, 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current System Baseline](#2-current-system-baseline)
3. [Phase 1: Database Schema](#3-phase-1-database-schema)
4. [Phase 2: IP Intelligence Service (ipinfo.io)](#4-phase-2-ip-intelligence-service)
5. [Phase 3: VPN/Proxy Detection & Blocking](#5-phase-3-vpnproxy-detection--blocking)
6. [Phase 4: Email OTP via Resend](#6-phase-4-email-otp-via-resend)
7. [Phase 5: Trusted Locations (Geofencing)](#7-phase-5-trusted-locations-geofencing)
8. [Phase 6: Trusted Device Memory](#8-phase-6-trusted-device-memory)
9. [Phase 7: Login Flow Integration](#9-phase-7-login-flow-integration)
10. [Phase 8: Backend API Endpoints](#10-phase-8-backend-api-endpoints)
11. [Phase 9: Frontend OTP Screen](#11-phase-9-frontend-otp-screen)
12. [Phase 10: Admin Dashboard](#12-phase-10-admin-dashboard)
13. [Phase 11: Audit & Monitoring](#13-phase-11-audit--monitoring)
14. [Phase 12: Testing & Rollout](#14-phase-12-testing--rollout)
15. [Environment Variables](#15-environment-variables)
16. [Cost Estimates](#16-cost-estimates)
17. [Security Considerations](#17-security-considerations)

---

## 1. Architecture Overview

### Login Flow with Adaptive MFA

```
User enters email + password
         │
         ▼
Firebase Auth validates credentials
         │
         ▼
Backend receives Firebase token + client IP
         │
         ▼
┌─────────────────────────────────┐
│  IP Intelligence Check          │
│  (ipinfo.io API)                │
│                                 │
│  Returns:                       │
│  - Country, City, Lat/Lng       │
│  - isVPN, isProxy, isTor        │
│  - ISP / ASN                    │
└─────────┬───────────────────────┘
          │
          ▼
    ┌─────────────┐     YES
    │  VPN/Proxy?  │ ──────────► 403 BLOCKED
    └──────┬──────┘             "VPN connections not allowed"
           │ NO
           ▼
    ┌──────────────────┐     YES
    │ Trusted Device?   │ ──────────► ✅ LOGIN SUCCESS
    │ (cookie exists)   │             (skip OTP)
    └──────┬───────────┘
           │ NO
           ▼
    ┌─────────────────────────┐     YES
    │ Within Trusted Location? │ ──────────► ✅ LOGIN SUCCESS
    │ (geofence check)         │             (no OTP needed)
    └──────┬──────────────────┘
           │ NO
           ▼
    ┌─────────────────┐
    │ Send Email OTP   │
    │ (Resend)         │
    └──────┬──────────┘
           │
           ▼
    User enters 6-digit code
           │
           ▼
    ┌─────────────────┐     FAIL (max 5 attempts)
    │ Verify OTP       │ ──────────► 🔒 Account locked
    └──────┬──────────┘
           │ PASS
           ▼
    ✅ LOGIN SUCCESS
    + Set trusted device cookie (30 days)
    + Log audit event
```

### Technology Stack

| Component | Service | Why |
|-----------|---------|-----|
| **IP Intelligence** | ipinfo.io | Geolocation + VPN/proxy/Tor detection in one API. Free tier: 50K requests/month |
| **Email OTP** | Resend (existing) | Already integrated in the project. Free tier: 100 emails/day. Zero additional cost |
| **Trusted Device** | Signed HTTP-only cookie | Secure, no DB lookups needed for repeat logins |
| **Geofencing** | Haversine formula | Server-side distance calculation, no external API needed |
| **OTP Storage** | PostgreSQL (existing) | Temporary challenge records with TTL |

---

## 2. Current System Baseline

### What Already Exists (Leverage These)

| Feature | Status | Location |
|---------|--------|----------|
| `User.mfaEnabled` field | ✅ In schema | `prisma/schema.prisma` — Boolean, default false |
| `User.mfaSecret` field | ✅ In schema | `prisma/schema.prisma` — String, nullable |
| `User.phone` field | ✅ In schema | `prisma/schema.prisma` — String, unique, nullable (not needed for email OTP) |
| `User.lastLoginIp` | ✅ Tracked | Updated on every login |
| `Session.ipAddress` | ✅ Tracked | Stored per session |
| `getClientIp()` utility | ✅ Working | `auditService.ts` — Extracts from X-Forwarded-For |
| `Resend email service` | ✅ Working | `notificationService.ts` — `sendEmailNotification()` with HTML support |
| Account lockout | ✅ Working | 5 failures → 15-min lock + Firebase disable |
| Audit logging | ✅ Working | Logs IP, action, user, org |
| `trust proxy` | ✅ Set | `app.set('trust proxy', 1)` in production |
| Firebase token verification | ✅ Working | `authenticate` middleware with revocation check |

### What Needs to Be Added

| Component | Type | Effort |
|-----------|------|--------|
| Prisma models (TrustedLocation, OtpChallenge, LoginSecurityLog, TrustedDevice) | Schema | Small |
| IP intelligence service (ipinfo.io integration) | New service | Medium |
| VPN detection middleware | New middleware | Small |
| Resend email OTP integration | New service (uses existing Resend) | Small |
| OTP challenge endpoints | New routes | Medium |
| Trusted location CRUD + geofence logic | New routes + service | Medium |
| Trusted device cookie management | Auth middleware update | Small |
| Frontend OTP verification screen | New component | Medium |
| Admin location management UI | New page section | Medium |

---

## 3. Phase 1: Database Schema

### File: `backend/prisma/schema.prisma`

Add these models after the existing `Session` model:

```prisma
/// Organization trusted locations for geofencing (offices, warehouses, facilities)
model TrustedLocation {
  id             String       @id @default(uuid())
  name           String       // "HQ Office", "Portland Warehouse"
  address        String?      // Human-readable address
  latitude       Float
  longitude      Float
  radiusKm       Float        @default(1.0)  // Geofence radius in kilometers
  isActive       Boolean      @default(true)
  organizationId String
  createdById    String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  Organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  CreatedBy      User         @relation("TrustedLocationsCreated", fields: [createdById], references: [id])

  @@index([organizationId])
}

/// Temporary OTP challenges — auto-expire after 5 minutes
model OtpChallenge {
  id         String   @id @default(uuid())
  userId     String
  method     String   @default("email")    // "email"
  email      String                          // Email OTP was sent to
  attempts   Int      @default(0)            // Track verification attempts
  maxAttempts Int     @default(5)
  code       String                          // Hashed 6-digit OTP code
  verified   Boolean  @default(false)
  expiresAt  DateTime                        // 5-minute TTL
  ipAddress  String                          // IP that triggered OTP
  createdAt  DateTime @default(now())

  User       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

/// Login security events — comprehensive audit for every login attempt
model LoginSecurityLog {
  id              String   @id @default(uuid())
  userId          String?                     // Null if user not found
  email           String                      // Email attempted
  ipAddress       String
  country         String?
  city            String?
  latitude        Float?
  longitude       Float?
  isp             String?                     // Internet Service Provider
  isVpn           Boolean  @default(false)
  isProxy         Boolean  @default(false)
  isTor           Boolean  @default(false)
  isHosting       Boolean  @default(false)    // Cloud/datacenter IP
  isTrustedLocation Boolean @default(false)
  isTrustedDevice Boolean  @default(false)
  otpRequired     Boolean  @default(false)
  otpVerified     Boolean?
  result          String                      // "success" | "blocked_vpn" | "otp_sent" | "otp_verified" | "otp_failed" | "locked"
  userAgent       String?
  organizationId  String?
  createdAt       DateTime @default(now())

  User            User?    @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([ipAddress])
  @@index([createdAt])
  @@index([organizationId])
}

/// Trusted devices — remembered after successful OTP verification
model TrustedDevice {
  id            String   @id @default(uuid())
  userId        String
  deviceHash    String                        // SHA-256 of (userId + userAgent + fingerprint)
  deviceName    String?                       // "Chrome on macOS", derived from User-Agent
  ipAddress     String                        // IP when device was trusted
  lastUsedAt    DateTime @default(now())
  expiresAt     DateTime                      // 30 days from creation
  createdAt     DateTime @default(now())

  User          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceHash])
  @@index([userId])
  @@index([expiresAt])
}
```

### Update User Model — Add Relations

```prisma
model User {
  // ... existing fields ...
  
  // ADD these relations:
  OtpChallenges         OtpChallenge[]
  LoginSecurityLogs     LoginSecurityLog[]
  TrustedDevices        TrustedDevice[]
  TrustedLocationsCreated TrustedLocation[]   @relation("TrustedLocationsCreated")
}
```

### Migration Commands

```bash
cd backend
npx prisma migrate dev --name add_adaptive_mfa_tables
npx prisma generate
```

---

## 4. Phase 2: IP Intelligence Service

### Install ipinfo.io SDK

```bash
cd backend
npm install ipinfo-ts
```

### Create Service — `backend/src/services/ipIntelligenceService.ts`

```typescript
import IPinfoWrapper from 'ipinfo-ts';
import { createHash } from 'crypto';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

// In-memory cache to reduce API calls (IP → result, 24-hour TTL)
const ipCache = new Map<string, { data: IpIntelligenceResult; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IpIntelligenceResult {
  ip: string;
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;  // Datacenter/cloud IP
  isRelay: boolean;    // Apple iCloud Private Relay, etc.
}

/**
 * Query ipinfo.io for IP geolocation + privacy/VPN data.
 * Results are cached for 24 hours to minimize API usage.
 */
export async function getIpIntelligence(ip: string): Promise<IpIntelligenceResult> {
  // Skip for localhost / development
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      ip,
      country: 'LOCAL',
      city: 'Localhost',
      region: null,
      latitude: null,
      longitude: null,
      isp: null,
      isVpn: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      isRelay: false,
    };
  }

  // Check cache first
  const cached = ipCache.get(ip);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  if (!IPINFO_TOKEN) {
    console.warn('[IP Intelligence] IPINFO_TOKEN not set — skipping IP check');
    return {
      ip,
      country: null, city: null, region: null,
      latitude: null, longitude: null, isp: null,
      isVpn: false, isProxy: false, isTor: false,
      isHosting: false, isRelay: false,
    };
  }

  try {
    const client = new IPinfoWrapper(IPINFO_TOKEN);
    const data = await client.lookupIp(ip);

    const [lat, lng] = (data.loc || '').split(',').map(Number);

    const result: IpIntelligenceResult = {
      ip,
      country: data.country || null,
      city: data.city || null,
      region: data.region || null,
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
      isp: data.org || null,
      isVpn: (data as any).privacy?.vpn || false,
      isProxy: (data as any).privacy?.proxy || false,
      isTor: (data as any).privacy?.tor || false,
      isHosting: (data as any).privacy?.hosting || false,
      isRelay: (data as any).privacy?.relay || false,
    };

    // Cache the result
    ipCache.set(ip, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    // Evict expired entries periodically (every 100 lookups)
    if (ipCache.size > 100) {
      const now = Date.now();
      for (const [key, val] of ipCache) {
        if (val.expiry < now) ipCache.delete(key);
      }
    }

    return result;
  } catch (error) {
    console.error('[IP Intelligence] Lookup failed for', ip, error);
    // Fail open — don't block login if IP service is down
    return {
      ip,
      country: null, city: null, region: null,
      latitude: null, longitude: null, isp: null,
      isVpn: false, isProxy: false, isTor: false,
      isHosting: false, isRelay: false,
    };
  }
}

/**
 * Clear the IP cache (for testing or force-refresh)
 */
export function clearIpCache(): void {
  ipCache.clear();
}
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **24-hour cache** | ipinfo.io free tier = 50K/month. Caching prevents repeat lookups for same IP |
| **Fail open** | If ipinfo.io is down, allow login (don't lock users out due to third-party failure) |
| **Skip local IPs** | Development convenience — never block localhost |
| **In-memory cache** | Simpler than Redis for this use case. Acceptable to lose cache on restart |

---

## 5. Phase 3: VPN/Proxy Detection & Blocking

### Create Middleware — `backend/src/middleware/vpnBlocker.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { getIpIntelligence } from '../services/ipIntelligenceService';
import { getClientIp } from '../services/auditService';

/**
 * Middleware to block VPN, proxy, Tor, and hosting/datacenter connections.
 * Applied to auth routes only — not to static assets or health checks.
 *
 * Behavior:
 * - Checks client IP against ipinfo.io privacy data
 * - Blocks with 403 if VPN/proxy/Tor detected
 * - Attaches ipIntelligence to req for downstream use
 * - Skips check in development mode
 */
export async function blockVpnConnections(req: Request, res: Response, next: NextFunction) {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  try {
    const ip = getClientIp(req);
    const intel = await getIpIntelligence(ip);

    // Attach to request for downstream use (login flow, audit logging)
    (req as any).ipIntelligence = intel;

    if (intel.isVpn || intel.isProxy || intel.isTor) {
      console.warn(`[VPN Blocker] Blocked ${intel.isVpn ? 'VPN' : intel.isProxy ? 'Proxy' : 'Tor'} connection from ${ip} (${intel.country}/${intel.city})`);
      
      return res.status(403).json({
        error: 'VPN_DETECTED',
        message: 'For security purposes, VPN, proxy, and anonymizer connections are not permitted. Please disconnect your VPN and try again.',
        details: {
          type: intel.isVpn ? 'vpn' : intel.isProxy ? 'proxy' : 'tor',
          country: intel.country,
        }
      });
    }

    next();
  } catch (error) {
    // Fail open — don't block if IP check fails
    console.error('[VPN Blocker] Error checking IP:', error);
    next();
  }
}
```

### Apply to Auth Routes — `backend/src/routes/firebaseAuthRoutes.ts`

```typescript
import { blockVpnConnections } from '../middleware/vpnBlocker';

// Apply VPN blocking to all Firebase auth routes
router.use(blockVpnConnections);

// Or selectively on login-related routes only:
router.post('/check-login-security', blockVpnConnections, checkLoginSecurity);
router.post('/create-profile', blockVpnConnections, createProfile);
```

---

## 6. Phase 4: Email OTP via Resend

### No New Packages Required

Resend is already installed and configured in the project:
- **Package**: `resend@^6.10.0` in `backend/package.json`
- **API Key**: `RESEND_API_KEY` in `backend/.env`
- **Sender**: `EMAIL_FROM=DashMet <noreply@dashmet.com>`
- **Existing service**: `backend/src/services/notificationService.ts`

### Create Service — `backend/src/services/emailOtpService.ts`

```typescript
import { createHash, randomInt } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendEmailNotification } from './notificationService';

const prisma = new PrismaClient();

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit OTP code.
 */
function generateOtpCode(): string {
  return randomInt(100000, 999999).toString();
}

/**
 * Hash the OTP code for secure storage (never store plaintext).
 */
function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Send Email OTP to user via existing Resend service.
 * We handle code generation, storage, and expiry ourselves.
 *
 * @returns challengeId if email sent successfully, null on failure
 */
export async function sendEmailOtp(
  userId: string,
  email: string,
  ipAddress: string
): Promise<{ challengeId: string; maskedEmail: string } | null> {
  const code = generateOtpCode();
  const hashedCode = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any existing unexpired challenges for this user
  await prisma.otpChallenge.updateMany({
    where: {
      userId,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() }, // Expire them immediately
  });

  // Create new challenge record with hashed code
  const challenge = await prisma.otpChallenge.create({
    data: {
      userId,
      email,
      code: hashedCode,
      expiresAt,
      ipAddress,
    },
  });

  // Send the OTP email via existing Resend service
  const result = await sendEmailNotification({
    to: email,
    subject: `${code} — Your DashMet verification code`,
    body: `Your DashMet verification code is: ${code}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this code, please ignore this email and secure your account.`,
    html: buildOtpEmailHtml(code, OTP_EXPIRY_MINUTES),
  });

  if (!result.success) {
    console.error(`[Email OTP] Failed to send to ${maskEmail(email)}: ${result.reason}`);
    // Clean up the challenge since email failed
    await prisma.otpChallenge.delete({ where: { id: challenge.id } });
    return null;
  }

  console.log(`[Email OTP] Sent to ${maskEmail(email)} — Challenge: ${challenge.id}`);
  return { challengeId: challenge.id, maskedEmail: maskEmail(email) };
}

/**
 * Verify the OTP code entered by the user.
 * Compares hashed code, checks expiry, and tracks attempts.
 *
 * @returns true if code is correct, not expired, and under attempt limit
 */
export async function verifyEmailOtp(challengeId: string, userId: string, code: string): Promise<{
  verified: boolean;
  error?: string;
  attemptsRemaining?: number;
}> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      id: challengeId,
      userId,
      verified: false,
    },
  });

  if (!challenge) {
    return { verified: false, error: 'OTP expired or invalid. Please request a new code.' };
  }

  if (challenge.expiresAt < new Date()) {
    return { verified: false, error: 'OTP expired. Please request a new code.' };
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    return { verified: false, error: 'Too many attempts. Please request a new code.' };
  }

  // Increment attempts
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { attempts: { increment: 1 } },
  });

  // Compare hashed codes (timing-safe comparison via hash match)
  const hashedInput = hashOtpCode(code);
  if (hashedInput !== challenge.code) {
    const remaining = challenge.maxAttempts - (challenge.attempts + 1);
    return { verified: false, error: 'Invalid code', attemptsRemaining: remaining };
  }

  // Mark as verified
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { verified: true },
  });

  return { verified: true };
}

/**
 * Mask email for display: john.doe@gmail.com → jo***@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const masked = local.length <= 2
    ? local[0] + '***'
    : local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

/**
 * Build branded HTML email template for OTP verification.
 */
function buildOtpEmailHtml(code: string, expiryMinutes: number): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">DashMet</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Security Verification</p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center; border: 1px solid #e2e8f0;">
        <p style="color: #475569; margin: 0 0 16px; font-size: 15px;">Your verification code is:</p>
        <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 auto; display: inline-block;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b; font-family: 'SF Mono', Monaco, monospace;">${code}</span>
        </div>
        <p style="color: #94a3b8; margin: 16px 0 0; font-size: 13px;">
          This code expires in <strong>${expiryMinutes} minutes</strong>.
        </p>
      </div>

      <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #fde68a;">
        <p style="color: #92400e; margin: 0; font-size: 13px;">
          ⚠️ If you did not request this code, please ignore this email. Someone may have entered your email address by mistake.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
        This is an automated security email from DashMet Operations Intelligence.
      </p>
    </div>
  `;
}
```

### Why Email OTP via Resend (Not Twilio SMS)

| Feature | Email OTP (Resend) | SMS OTP (Twilio Verify) |
|---------|-------------------|------------------------|
| Cost | **$0** (free tier: 100/day) | $0.05/verification |
| Already integrated | **✅ Yes** | ❌ New dependency |
| Delivery reliability | ✅ High (transactional email) | ✅ High |
| Code generation | We generate + hash | Twilio auto-generates |
| Code storage | **SHA-256 hashed** in DB | Stored by Twilio |
| Rich branding | **✅ HTML template** | ❌ Plain SMS |
| No phone required | **✅ Uses existing email** | ❌ Requires phone number |
| International delivery | **✅ Free worldwide** | ❌ Varies by country |
| Attempt limiting | We implement (5 max) | Built-in |

### Key Advantage: No Phone Number Needed

Every user already has an email in the system. No need to collect phone numbers, handle E.164 formatting, or deal with international SMS delivery issues.

---

## 7. Phase 5: Trusted Locations (Geofencing)

### Create Service — `backend/src/services/geofenceService.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Haversine formula — calculates great-circle distance between two points.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if given coordinates fall within ANY trusted location for the organization.
 * Returns the matching location if found, null otherwise.
 */
export async function isWithinTrustedLocation(
  latitude: number,
  longitude: number,
  organizationId: string
): Promise<{ trusted: boolean; location: { id: string; name: string; distanceKm: number } | null }> {
  const locations = await prisma.trustedLocation.findMany({
    where: {
      organizationId,
      isActive: true,
    },
  });

  for (const loc of locations) {
    const distance = haversineDistance(latitude, longitude, loc.latitude, loc.longitude);
    if (distance <= loc.radiusKm) {
      return {
        trusted: true,
        location: { id: loc.id, name: loc.name, distanceKm: Math.round(distance * 100) / 100 },
      };
    }
  }

  return { trusted: false, location: null };
}
```

---

## 8. Phase 6: Trusted Device Memory

### Concept

After a user successfully completes OTP from a new location, offer to "remember this device" for 30 days. Uses a signed HTTP-only cookie containing a hashed device identifier.

### Create Service — `backend/src/services/trustedDeviceService.ts`

```typescript
import { createHash, randomBytes, createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEVICE_COOKIE_NAME = 'dashmet_trusted_device';
const DEVICE_SECRET = process.env.TRUSTED_DEVICE_SECRET || 'change-me-in-production';
const TRUST_DURATION_DAYS = 30;

/**
 * Generate a unique device hash from user + browser fingerprint.
 */
function generateDeviceHash(userId: string, userAgent: string): string {
  return createHash('sha256')
    .update(`${userId}:${userAgent}:${DEVICE_SECRET}`)
    .digest('hex');
}

/**
 * Create a signed device token for the cookie.
 */
function signDeviceToken(deviceId: string): string {
  const payload = `${deviceId}:${Date.now()}`;
  const signature = createHmac('sha256', DEVICE_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Verify a signed device token from cookie.
 */
function verifyDeviceToken(token: string): string | null {
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [deviceId, timestamp, signature] = parts;
  const expected = createHmac('sha256', DEVICE_SECRET)
    .update(`${deviceId}:${timestamp}`)
    .digest('hex');
  if (signature !== expected) return null;
  return deviceId;
}

/**
 * Check if the current device is trusted for this user.
 */
export async function isTrustedDevice(
  userId: string,
  userAgent: string,
  cookieValue?: string
): Promise<boolean> {
  if (!cookieValue) return false;

  const deviceId = verifyDeviceToken(cookieValue);
  if (!deviceId) return false;

  const deviceHash = generateDeviceHash(userId, userAgent);

  const device = await prisma.trustedDevice.findUnique({
    where: {
      userId_deviceHash: { userId, deviceHash },
    },
  });

  if (!device || device.expiresAt < new Date()) {
    return false;
  }

  // Update last used timestamp
  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  });

  return true;
}

/**
 * Register current device as trusted (after successful OTP).
 * Returns the cookie value to set.
 */
export async function registerTrustedDevice(
  userId: string,
  userAgent: string,
  ipAddress: string
): Promise<{ cookieName: string; cookieValue: string; maxAge: number }> {
  const deviceHash = generateDeviceHash(userId, userAgent);
  const expiresAt = new Date(Date.now() + TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Derive device name from User-Agent
  const deviceName = parseDeviceName(userAgent);

  // Upsert — refresh if same device already trusted
  const device = await prisma.trustedDevice.upsert({
    where: {
      userId_deviceHash: { userId, deviceHash },
    },
    create: {
      userId,
      deviceHash,
      deviceName,
      ipAddress,
      expiresAt,
    },
    update: {
      ipAddress,
      lastUsedAt: new Date(),
      expiresAt,
    },
  });

  return {
    cookieName: DEVICE_COOKIE_NAME,
    cookieValue: signDeviceToken(device.id),
    maxAge: TRUST_DURATION_DAYS * 24 * 60 * 60, // seconds
  };
}

/**
 * Revoke a specific trusted device.
 */
export async function revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({
    where: { id: deviceId, userId },
  });
}

/**
 * Revoke all trusted devices for a user (e.g., on password change).
 */
export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({
    where: { userId },
  });
}

/**
 * Parse User-Agent into a readable device name.
 */
function parseDeviceName(ua: string): string {
  if (!ua) return 'Unknown Device';
  
  let browser = 'Browser';
  let os = 'Unknown';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';

  return `${browser} on ${os}`;
}

export { DEVICE_COOKIE_NAME };
```

---

## 9. Phase 7: Login Flow Integration

### Create Service — `backend/src/services/loginSecurityService.ts`

This is the **orchestrator** that ties all pieces together.

```typescript
import { PrismaClient } from '@prisma/client';
import { getIpIntelligence, IpIntelligenceResult } from './ipIntelligenceService';
import { isWithinTrustedLocation } from './geofenceService';
import { isTrustedDevice } from './trustedDeviceService';
import { sendEmailOtp, maskEmail } from './emailOtpService';
import { getClientIp } from './auditService';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface LoginSecurityCheckResult {
  allowed: boolean;
  requiresOtp: boolean;
  blocked: boolean;
  blockReason?: string;
  otpSent?: boolean;
  maskedEmail?: string;
  challengeId?: string;
  ipIntelligence: IpIntelligenceResult;
  isTrustedLocation: boolean;
  isTrustedDevice: boolean;
  trustedLocationName?: string;
}

/**
 * Main login security check — called AFTER Firebase credentials are verified.
 * 
 * Decision tree:
 * 1. VPN/Proxy/Tor? → BLOCK
 * 2. Trusted device cookie? → ALLOW (skip OTP)
 * 3. Within trusted location? → ALLOW (skip OTP)
 * 4. MFA enabled for user/org? → SEND EMAIL OTP
 * 5. MFA not enabled → ALLOW (log event)
 */
export async function performLoginSecurityCheck(
  req: Request,
  userId: string,
  organizationId: string | null,
): Promise<LoginSecurityCheckResult> {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const cookieValue = req.cookies?.dashmet_trusted_device;

  // 1. Get IP intelligence
  const ipIntel = (req as any).ipIntelligence || await getIpIntelligence(ip);

  // 2. Check VPN/Proxy/Tor
  if (ipIntel.isVpn || ipIntel.isProxy || ipIntel.isTor) {
    await logSecurityEvent({
      userId, email: '', ipAddress: ip, ipIntel,
      isTrustedLocation: false, isTrustedDevice: false,
      otpRequired: false, result: 'blocked_vpn',
      userAgent, organizationId,
    });

    return {
      allowed: false,
      requiresOtp: false,
      blocked: true,
      blockReason: ipIntel.isVpn ? 'vpn' : ipIntel.isProxy ? 'proxy' : 'tor',
      ipIntelligence: ipIntel,
      isTrustedLocation: false,
      isTrustedDevice: false,
    };
  }

  // 3. Check trusted device
  const deviceTrusted = await isTrustedDevice(userId, userAgent, cookieValue);
  if (deviceTrusted) {
    await logSecurityEvent({
      userId, email: '', ipAddress: ip, ipIntel,
      isTrustedLocation: false, isTrustedDevice: true,
      otpRequired: false, result: 'success',
      userAgent, organizationId,
    });

    return {
      allowed: true,
      requiresOtp: false,
      blocked: false,
      ipIntelligence: ipIntel,
      isTrustedLocation: false,
      isTrustedDevice: true,
    };
  }

  // 4. Check trusted location (geofence)
  let locationTrusted = false;
  let trustedLocationName: string | undefined;
  if (ipIntel.latitude && ipIntel.longitude && organizationId) {
    const geoResult = await isWithinTrustedLocation(
      ipIntel.latitude, ipIntel.longitude, organizationId
    );
    locationTrusted = geoResult.trusted;
    trustedLocationName = geoResult.location?.name;
  }

  if (locationTrusted) {
    await logSecurityEvent({
      userId, email: '', ipAddress: ip, ipIntel,
      isTrustedLocation: true, isTrustedDevice: false,
      otpRequired: false, result: 'success',
      userAgent, organizationId,
    });

    return {
      allowed: true,
      requiresOtp: false,
      blocked: false,
      ipIntelligence: ipIntel,
      isTrustedLocation: true,
      isTrustedDevice: false,
      trustedLocationName,
    };
  }

  // 5. User is outside trusted location + no trusted device → check if OTP is needed
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mfaEnabled: true },
  });

  if (!user?.mfaEnabled) {
    // MFA not enabled — allow but log
    await logSecurityEvent({
      userId, email: user?.email || '', ipAddress: ip, ipIntel,
      isTrustedLocation: false, isTrustedDevice: false,
      otpRequired: false, result: 'success',
      userAgent, organizationId,
    });

    return {
      allowed: true,
      requiresOtp: false,
      blocked: false,
      ipIntelligence: ipIntel,
      isTrustedLocation: false,
      isTrustedDevice: false,
    };
  }

  // 6. Send Email OTP via Resend
  const otpResult = await sendEmailOtp(userId, user.email, ip);

  if (!otpResult) {
    // Email failed to send — fail open (allow login, log warning)
    console.warn(`[LoginSecurity] Email OTP failed for user ${userId}, allowing login`);
    await logSecurityEvent({
      userId, email: user.email, ipAddress: ip, ipIntel,
      isTrustedLocation: false, isTrustedDevice: false,
      otpRequired: true, result: 'otp_email_failed',
      userAgent, organizationId,
    });

    return {
      allowed: true,
      requiresOtp: false,
      blocked: false,
      ipIntelligence: ipIntel,
      isTrustedLocation: false,
      isTrustedDevice: false,
    };
  }

  await logSecurityEvent({
    userId, email: user.email, ipAddress: ip, ipIntel,
    isTrustedLocation: false, isTrustedDevice: false,
    otpRequired: true, result: 'otp_sent',
    userAgent, organizationId,
  });

  return {
    allowed: false,
    requiresOtp: true,
    blocked: false,
    otpSent: true,
    maskedEmail: otpResult.maskedEmail,
    challengeId: otpResult.challengeId,
    ipIntelligence: ipIntel,
    isTrustedLocation: false,
    isTrustedDevice: false,
  };
}

// ─── Internal helper ───

async function logSecurityEvent(params: {
  userId: string | null;
  email: string;
  ipAddress: string;
  ipIntel: IpIntelligenceResult;
  isTrustedLocation: boolean;
  isTrustedDevice: boolean;
  otpRequired: boolean;
  otpVerified?: boolean;
  result: string;
  userAgent: string;
  organizationId: string | null;
}) {
  try {
    await prisma.loginSecurityLog.create({
      data: {
        userId: params.userId,
        email: params.email,
        ipAddress: params.ipAddress,
        country: params.ipIntel.country,
        city: params.ipIntel.city,
        latitude: params.ipIntel.latitude,
        longitude: params.ipIntel.longitude,
        isp: params.ipIntel.isp,
        isVpn: params.ipIntel.isVpn,
        isProxy: params.ipIntel.isProxy,
        isTor: params.ipIntel.isTor,
        isHosting: params.ipIntel.isHosting,
        isTrustedLocation: params.isTrustedLocation,
        isTrustedDevice: params.isTrustedDevice,
        otpRequired: params.otpRequired,
        otpVerified: params.otpVerified,
        result: params.result,
        userAgent: params.userAgent,
        organizationId: params.organizationId,
      },
    });
  } catch (error) {
    console.error('[LoginSecurity] Failed to log event:', error);
  }
}
```

---

## 10. Phase 8: Backend API Endpoints

### Create Route File — `backend/src/routes/securityRoutes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { otpRateLimiter } from '../middleware/rateLimiter';
import { performLoginSecurityCheck } from '../services/loginSecurityService';
import { verifyEmailOtp, sendEmailOtp, maskEmail } from '../services/emailOtpService';
import { registerTrustedDevice, revokeAllTrustedDevices, DEVICE_COOKIE_NAME } from '../services/trustedDeviceService';
import { getClientIp } from '../services/auditService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// ─── POST /api/security/login-check ───
// Called by frontend AFTER Firebase auth succeeds.
// Returns whether OTP is required.
router.post('/login-check', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await performLoginSecurityCheck(req, user.id, user.organizationId);

    if (result.blocked) {
      return res.status(403).json({
        error: 'CONNECTION_BLOCKED',
        message: 'Your connection type is not permitted.',
        blockReason: result.blockReason,
      });
    }

    if (result.requiresOtp) {
      return res.status(202).json({
        requiresOtp: true,
        maskedEmail: result.maskedEmail,
        challengeId: result.challengeId,
        otpSent: result.otpSent,
      });
    }

    // No OTP needed
    return res.json({
      requiresOtp: false,
      isTrustedLocation: result.isTrustedLocation,
      isTrustedDevice: result.isTrustedDevice,
      trustedLocationName: result.trustedLocationName,
    });
  } catch (error) {
    console.error('[Security] Login check error:', error);
    res.status(500).json({ error: 'Security check failed' });
  }
});

// ─── POST /api/security/verify-otp ───
// User submits the 6-digit code received via email
router.post('/verify-otp', otpRateLimiter, authenticate, async (req: Request, res: Response) => {
  try {
    const { code, challengeId, trustDevice } = req.body;
    const user = (req as any).user;

    if (!code || !challengeId) {
      return res.status(400).json({ error: 'Code and challengeId are required' });
    }

    // Verify OTP via our email OTP service (handles hashing, attempts, expiry)
    const result = await verifyEmailOtp(challengeId, user.id, code);

    if (!result.verified) {
      const status = result.error?.includes('Too many') ? 429 : 401;
      return res.status(status).json({
        error: result.error,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    // Log success
    await prisma.loginSecurityLog.create({
      data: {
        userId: user.id,
        email: user.email,
        ipAddress: getClientIp(req),
        result: 'otp_verified',
        otpRequired: true,
        otpVerified: true,
        userAgent: req.headers['user-agent'] || '',
        organizationId: user.organizationId,
      },
    });

    // Trust device if user opted in
    const response: any = { verified: true };

    if (trustDevice) {
      const cookie = await registerTrustedDevice(
        user.id,
        req.headers['user-agent'] || '',
        getClientIp(req)
      );

      res.cookie(cookie.cookieName, cookie.cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookie.maxAge * 1000, // ms
        path: '/',
      });

      response.deviceTrusted = true;
    }

    return res.json(response);
  } catch (error) {
    console.error('[Security] OTP verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /api/security/resend-otp ───
router.post('/resend-otp', otpRateLimiter, authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const otpResult = await sendEmailOtp(user.id, user.email, getClientIp(req));

    if (!otpResult) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.json({
      otpSent: true,
      challengeId: otpResult.challengeId,
      maskedEmail: otpResult.maskedEmail,
    });
  } catch (error) {
    console.error('[Security] Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// ─── Trusted Locations CRUD (Admin/System Admin only) ───

// GET /api/security/trusted-locations
router.get('/trusted-locations', authenticate, authorize('ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const locations = await prisma.trustedLocation.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { CreatedBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/security/trusted-locations
router.post('/trusted-locations', authenticate, authorize('ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, address, latitude, longitude, radiusKm } = req.body;

    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    const location = await prisma.trustedLocation.create({
      data: {
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusKm: parseFloat(radiusKm) || 1.0,
        organizationId: user.organizationId,
        createdById: user.id,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// PUT /api/security/trusted-locations/:id
router.put('/trusted-locations/:id', authenticate, authorize('ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, address, latitude, longitude, radiusKm, isActive } = req.body;

    const location = await prisma.trustedLocation.updateMany({
      where: { id: req.params.id, organizationId: user.organizationId },
      data: { name, address, latitude, longitude, radiusKm, isActive },
    });

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/security/trusted-locations/:id
router.delete('/trusted-locations/:id', authenticate, authorize('ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await prisma.trustedLocation.deleteMany({
      where: { id: req.params.id, organizationId: user.organizationId },
    });
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// ─── Trusted Devices Management ───

// GET /api/security/trusted-devices
router.get('/trusted-devices', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const devices = await prisma.trustedDevice.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceName: true, ipAddress: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// DELETE /api/security/trusted-devices/:id
router.delete('/trusted-devices/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { revokeTrustedDevice } = require('../services/trustedDeviceService');
    await revokeTrustedDevice(user.id, req.params.id);
    res.json({ revoked: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

// DELETE /api/security/trusted-devices (revoke all)
router.delete('/trusted-devices', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await revokeAllTrustedDevices(user.id);
    res.clearCookie(DEVICE_COOKIE_NAME);
    res.json({ revokedAll: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke devices' });
  }
});

// ─── Security Logs (Admin only) ───

// GET /api/security/logs
router.get('/logs', authenticate, authorize('ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { limit = 50, offset = 0 } = req.query;

    const logs = await prisma.loginSecurityLog.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        User: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
```

### Register Routes — `backend/src/server.ts`

```typescript
import securityRoutes from './routes/securityRoutes';

// Add with other route registrations:
app.use('/api/security', securityRoutes);
```

---

## 11. Phase 9: Frontend OTP Screen

### Create Component — `frontend/src/components/auth/OtpVerification.tsx`

This component appears between successful Firebase login and app access when OTP is required.

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface OtpVerificationProps {
  maskedEmail: string;
  challengeId: string;
  onVerified: () => void;
  onCancel: () => void;
  apiUrl: string;
  token: string;
}

export default function OtpVerification({
  maskedEmail, challengeId, onVerified, onCancel, apiUrl, token,
}: OtpVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [currentChallengeId, setCurrentChallengeId] = useState(challengeId);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take last char
    setCode(newCode);
    setError('');

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length === 6) handleVerify(pasted);
  };

  const handleVerify = async (fullCode: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/security/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          code: fullCode,
          challengeId: currentChallengeId,
          trustDevice,
        }),
      });
      const data = await res.json();

      if (res.ok && data.verified) {
        onVerified();
      } else {
        setAttemptsRemaining(data.attemptsRemaining ?? attemptsRemaining - 1);
        setError(data.error || 'Invalid code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await fetch(`${apiUrl}/security/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.challengeId) {
        setCurrentChallengeId(data.challengeId);
        setAttemptsRemaining(5);
        setError('');
        setCode(['', '', '', '', '', '']);
        setResendCooldown(60); // 60-second cooldown
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Failed to resend code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Verification Required
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            We sent a 6-digit code to <strong>{maskedEmail}</strong>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            This is required because you're signing in from a new location. Check your email inbox (and spam folder).
          </p>
        </div>

        {/* 6-digit input */}
        <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all
                ${error
                  ? 'border-red-300 dark:border-red-600'
                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'}
                bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                disabled:opacity-50`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-center mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {attemptsRemaining > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        )}

        {/* Trust device checkbox */}
        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Trust this device for 30 days
          </span>
        </label>

        {/* Resend */}
        <div className="text-center mb-6">
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Didn't receive a code? Resend"}
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          Cancel and sign out
        </button>
      </div>
    </div>
  );
}
```

### Integrate into AuthProvider — `frontend/src/components/providers/AuthProvider.tsx`

After Firebase auth succeeds and before granting app access:

```typescript
// After getting Firebase token, call the security check endpoint:
const securityRes = await fetch(`${API_URL}/security/login-check`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${firebaseToken}`,
  },
  credentials: 'include',
});

const securityData = await securityRes.json();

if (securityRes.status === 403) {
  // VPN blocked
  setVpnBlocked(true);
  await auth.signOut();
  return;
}

if (securityRes.status === 202 && securityData.requiresOtp) {
  // Show OTP verification screen
  setOtpRequired(true);
  setOtpChallengeId(securityData.challengeId);
  setMaskedEmail(securityData.maskedEmail);
  return;
}

// Login success — proceed normally
```

---

## 12. Phase 10: Admin Dashboard

### Trusted Locations Management

Add to the Admin Settings page or create a dedicated Security Settings page:

1. **Map view** — Display trusted locations as pins with radius circles
2. **CRUD form** — Name, address, lat/lng (with geocoding), radius slider
3. **Location list** — Table with name, address, radius, active toggle, delete
4. **Geocoding** — Use browser Geolocation API or address search to get coordinates

### Security Logs Dashboard

Add a "Security Logs" tab in Admin panel:

1. **Table columns**: Date, User, Email, IP, Country/City, VPN?, Trusted?, OTP?, Result
2. **Filters**: Date range, result type, VPN only, specific user
3. **Stats cards**: Total logins, blocked VPN attempts, OTP verifications, unique locations

### User MFA Management

In admin user management:

1. **Enforce MFA** — Toggle per-user or organization-wide
2. **Reset MFA** — Revoke all trusted devices for a user
3. **View security logs** — See login attempts, OTP events, blocked VPN connections

---

## 13. Phase 11: Audit & Monitoring

### Automatic Cleanup (Cron Job)

Add to existing cron/scheduled tasks:

```typescript
// Clean up expired OTP challenges (run hourly)
await prisma.otpChallenge.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});

// Clean up expired trusted devices (run daily)
await prisma.trustedDevice.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});

// Clean up old security logs (keep 90 days)
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
await prisma.loginSecurityLog.deleteMany({
  where: { createdAt: { lt: ninetyDaysAgo } },
});
```

### Alert Triggers (Implement Later)

- **5+ VPN attempts** from same email → notify admin
- **10+ OTP failures** for single user in 24h → temporary lock + admin alert
- **Login from new country** → email notification to user
- **Unusual login time** (outside business hours) → flag in logs

---

## 14. Phase 12: Testing & Rollout

### Step 1: Development Testing

| Test Case | How to Test | Expected Result |
|-----------|------------|-----------------|
| Local IP detection | Login from localhost | Skip all checks (return LOCAL) |
| VPN blocking | Use a VPN service | 403 "VPN detected" |
| OTP flow | Login with MFA enabled | OTP email sent, verify screen shown |
| Wrong OTP code | Enter wrong code 5x | "Too many attempts" |
| Expired OTP | Wait 5 min, then enter code | "OTP expired" |
| Trusted device | Verify OTP with "Trust" checked | Next login skips OTP |
| Trusted location | Set location as trusted + login from it | No OTP required |
| No phone number | N/A (uses email) | N/A — all users already have email |

### Step 2: Staging Rollout

1. Deploy with `MFA_ENFORCEMENT=optional` (only users who opt-in get OTP)
2. Monitor security logs for false positives
3. Adjust trusted location radius if needed
4. Test with 2-3 internal users for 1 week

### Step 3: Production Rollout

1. Set `MFA_ENFORCEMENT=required` (all users get OTP when from untrusted location/device)
2. No grace period needed — all users already have email addresses
3. Monitor Resend usage (should stay well under free tier)
4. Monitor security logs for false positives

---

## 15. Environment Variables

### Add to `backend/.env`

```env
# ─── IP Intelligence (ipinfo.io) ───
IPINFO_TOKEN=your_ipinfo_token_here

# ─── Resend (Email OTP — already configured) ───
# RESEND_API_KEY=already_in_your_.env
# EMAIL_FROM=already_in_your_.env

# ─── Trusted Device ───
TRUSTED_DEVICE_SECRET=generate-a-64-char-random-secret-here

# ─── MFA Configuration ───
MFA_ENFORCEMENT=optional          # "optional" | "required"
OTP_EXPIRY_MINUTES=5
TRUSTED_DEVICE_DAYS=30
TRUSTED_LOCATION_DEFAULT_RADIUS_KM=1.0
```

### Generate Secrets

```bash
# Generate TRUSTED_DEVICE_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 16. Cost Estimates

### Monthly Costs (at scale)

| Service | Free Tier | Cost After Free | Estimate (500 users) |
|---------|-----------|-----------------|----------------------|
| **ipinfo.io** | 50K lookups/month | $99/month (150K) | Free tier sufficient |
| **Resend (Email OTP)** | 100 emails/day (3,000/month) | $20/month (50K) | **$0** (free tier sufficient) |
| **Database** | N/A (existing PostgreSQL) | $0 | $0 |

### Cost Optimization

- **IP caching** reduces ipinfo.io calls by ~80%
- **Trusted device cookies** reduce OTP emails by ~70% (repeat logins skip OTP)
- **Trusted locations** eliminate OTP for in-office logins entirely
- **Net estimate**: **$0/month** for up to 500 users (both free tiers are sufficient)
- Even at 500 users with no trusted devices: ~1,100 OTPs/month = well under 3,000 free emails

---

## 17. Security Considerations

### Critical Requirements

| Item | Implementation |
|------|---------------|
| **OTP codes are SHA-256 hashed in DB** | Plaintext codes are never stored. Even if DB is compromised, codes can't be extracted |
| **Trusted device cookies are HTTP-only** | Cannot be read by JavaScript (XSS-safe) |
| **Trusted device cookies are signed** | HMAC prevents tampering |
| **Trusted device cookies are Secure** | Only sent over HTTPS |
| **IP cache doesn't leak** | In-memory only, not persisted |
| **Phone numbers encrypted at rest** | Not needed — email OTP uses existing email field |
| **Rate limiting on OTP** | Existing `otpRateLimiter` (5/hour) |
| **Fail-open design** | Third-party failures don't lock users out |

### Attack Vectors Addressed

| Attack | Protection |
|--------|-----------|
| **Credential stuffing** | Existing brute force protection + now OTP for unknown locations |
| **VPN anonymization** | ipinfo.io VPN/proxy/Tor detection |
| **SIM swap** | Not applicable — email OTP (attacker needs email access + device) |
| **Cookie theft** | HMAC-signed, HTTP-only, Secure, SameSite=strict |
| **Replay attack** | OTP is one-time-use, 5-min expiry |
| **Location spoofing** | IP-based (can't spoof source IP at TCP level) |

---

## Implementation Order (Recommended)

| Step | Phase | Dependencies | Priority |
|------|-------|-------------|----------|
| 1 | Phase 1: Database Schema | None | 🔴 Do first |
| 2 | Phase 2: IP Intelligence Service | ipinfo.io token | 🔴 Do first |
| 3 | Phase 3: VPN Blocking Middleware | Phase 2 | 🟡 Quick win |
| 4 | Phase 5: Trusted Locations | Phase 1 | 🟡 Then this |
| 5 | Phase 4: Email OTP (Resend) | Resend already configured | 🟡 Then this |
| 6 | Phase 6: Trusted Device Memory | Phase 1 | 🟡 Then this |
| 7 | Phase 7: Login Security Service | Phases 2-6 | 🔴 Orchestrator |
| 8 | Phase 8: API Endpoints | Phase 7 | 🔴 Backend done |
| 9 | Phase 9: Frontend OTP Screen | Phase 8 | 🔴 Frontend done |
| 10 | Phase 10: Admin Dashboard | Phase 8 | 🟢 Polish |
| 11 | Phase 11: Audit & Cleanup | Phase 8 | 🟢 Polish |
| 12 | Phase 12: Testing & Rollout | All phases | 🟢 Ship |

---

## Quick Start Checklist

- [ ] Sign up for [ipinfo.io](https://ipinfo.io/signup) — get API token (free tier)
- [ ] Resend already configured — no action needed ✅
- [ ] Add environment variables to `.env` (IPINFO_TOKEN, TRUSTED_DEVICE_SECRET, MFA config)
- [ ] Run Prisma migration
- [ ] Install packages: `npm install ipinfo-ts`
- [ ] Create all service files (Phases 2-7)
- [ ] Create route file and register in server.ts
- [ ] Create frontend OTP component
- [ ] Integrate into AuthProvider
- [ ] Test end-to-end
- [ ] Deploy to staging
- [ ] Monitor for 1 week
- [ ] Roll out to production

/**
 * Shared Encryption Utilities
 * AES-256-GCM encryption + HMAC-SHA256 hashing for sensitive data.
 * Key: ENCRYPTION_KEY environment variable (normalized to 32 bytes).
 */

import crypto from 'crypto';

// ── Key Derivation ───────────────────────────────────────────────────────────

function getEncryptionKeyBuffer(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === 32) return buf;
  if (buf.length > 32) return buf.slice(0, 32);
  const padded = Buffer.alloc(32, 0);
  buf.copy(padded);
  return padded;
}

let _keyBuffer: Buffer | null = null;
function getKey(): Buffer {
  if (!_keyBuffer) _keyBuffer = getEncryptionKeyBuffer();
  return _keyBuffer;
}

const IV_LENGTH = 16;

// ── AES-256-GCM Encrypt / Decrypt ───────────────────────────────────────────

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else if (parts.length === 2) {
      // Legacy CBC format
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    return text;
  } catch {
    return text;
  }
}

// ── HMAC-SHA256 Hash (deterministic, for lookups / uniqueness) ──────────────

export function hmacHash(text: string): string {
  return crypto.createHmac('sha256', getKey()).update(text).digest('hex');
}

// ── Phone Number Helpers ────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format: +{countryCode}{digits}
 * e.g. "(555) 123-4567" + countryCode "1" → "+15551234567"
 */
export function normalizePhone(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  const cleanCode = countryCode.replace(/\D/g, '');
  return `+${cleanCode}${digits}`;
}

/**
 * Encrypt a phone number for storage.
 * Returns { encryptedPhone, phoneHash } — store both.
 */
export function encryptPhone(phone: string, countryCode: string): { encryptedPhone: string; phoneHash: string } {
  const normalized = normalizePhone(phone, countryCode);
  return {
    encryptedPhone: encrypt(normalized),
    phoneHash: hmacHash(normalized),
  };
}

/**
 * Compute a phoneHash from a raw E.164 phone string (for lookup).
 * Also tries common variants so mobile auth can match.
 */
export function phoneHashVariants(phone: string, countryCode?: string): string[] {
  const hashes: Set<string> = new Set();
  let normalized = phone.replace(/[\s\-\(\)]/g, '').trim();

  // Exact as provided
  hashes.add(hmacHash(normalized));

  // With + prefix
  if (!normalized.startsWith('+')) {
    hashes.add(hmacHash(`+${normalized}`));
  }

  // With country code
  if (countryCode) {
    const cc = countryCode.replace(/[^0-9+]/g, '');
    if (!normalized.startsWith('+')) {
      hashes.add(hmacHash(`${cc}${normalized}`));
      if (!cc.startsWith('+')) hashes.add(hmacHash(`+${cc}${normalized}`));
    }
  }

  // US/CA 10-digit → +1
  const digitsOnly = normalized.replace(/^\+/, '');
  if (digitsOnly.length === 10 && /^[2-9]/.test(digitsOnly)) {
    hashes.add(hmacHash(`+1${digitsOnly}`));
    hashes.add(hmacHash(digitsOnly));
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    hashes.add(hmacHash(`+${digitsOnly}`));
    hashes.add(hmacHash(`+${digitsOnly.substring(1)}`));
  }

  return [...hashes];
}

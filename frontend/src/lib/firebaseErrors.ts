/**
 * Centralized Firebase Auth error-to-friendly-message mapping.
 *
 * SECURITY: Never expose raw Firebase error messages to users.
 * Raw messages can leak internal details (SDK version, project ID,
 * stack traces) that aid attackers in reconnaissance.
 *
 * Every Firebase Auth error code is mapped to a safe, user-friendly
 * string. Unknown codes fall through to a generic message.
 */

const FIREBASE_ERROR_MAP: Record<string, string> = {
  // ── Authentication ──────────────────────────────────────────────
  'auth/invalid-credential':
    'Invalid email or password. Please try again.',
  'auth/wrong-password':
    'Invalid email or password. Please try again.',
  'auth/user-not-found':
    'Invalid email or password. Please try again.', // Same message to prevent enumeration
  'auth/invalid-email':
    'Please enter a valid email address.',
  'auth/user-disabled':
    'This account has been disabled. Please contact your administrator.',
  'auth/too-many-requests':
    'Access temporarily blocked due to too many failed attempts. Please reset your password or try again later.',

  // ── Registration ────────────────────────────────────────────────
  'auth/email-already-in-use':
    'An account with this email already exists. Please sign in instead.',
  'auth/weak-password':
    'Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.',
  'auth/operation-not-allowed':
    'This sign-in method is not enabled. Please contact your administrator.',

  // ── OAuth / Popup ───────────────────────────────────────────────
  'auth/popup-closed-by-user':
    'Sign-in was cancelled. Please try again.',
  'auth/popup-blocked':
    'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.',
  'auth/cancelled-popup-request':
    '', // Silent — user opened a new popup, old one cancelled
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method. Please sign in with your original method.',
  'auth/credential-already-in-use':
    'This credential is already associated with another account.',

  // ── Token / Session ─────────────────────────────────────────────
  'auth/id-token-expired':
    'Your session has expired. Please sign in again.',
  'auth/id-token-revoked':
    'Your session has been revoked. Please sign in again.',
  'auth/requires-recent-login':
    'This action requires recent authentication. Please sign in again.',

  // ── Password Reset ─────────────────────────────────────────────
  'auth/expired-action-code':
    'This link has expired. Please request a new one.',
  'auth/invalid-action-code':
    'This link is invalid or has already been used. Please request a new one.',

  // ── Network / Infrastructure ────────────────────────────────────
  'auth/network-request-failed':
    'Network error. Please check your internet connection and try again.',
  'auth/internal-error':
    'An unexpected error occurred. Please try again.',
};

/**
 * Convert a Firebase Auth error into a safe, user-facing message.
 *
 * @param error  The caught error object (may or may not be a Firebase error)
 * @param fallback  Optional generic fallback when code is unknown
 * @returns A user-friendly string that never contains internal details
 */
export function getFirebaseErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as { code?: string; message?: string };

  // Primary: check err.code directly
  if (err.code && typeof err.code === 'string') {
    const mapped = FIREBASE_ERROR_MAP[err.code];
    if (mapped !== undefined) return mapped; // '' is valid (silent dismiss)
  }

  // Fallback: extract error code from message like "Firebase: Error (auth/some-code)."
  if (err.message && typeof err.message === 'string') {
    const match = err.message.match(/\(auth\/([^)]+)\)/);
    if (match) {
      const extractedCode = `auth/${match[1]}`;
      const mapped = FIREBASE_ERROR_MAP[extractedCode];
      if (mapped !== undefined) return mapped;
    }
  }

  return fallback;
}

/**
 * Check whether an error is `auth/too-many-requests` —
 * used to trigger the account-lockout + forced-password-reset flow.
 */
export function isTooManyRequestsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code === 'auth/too-many-requests') return true;
  // Fallback: check message for embedded code
  if (err.message && typeof err.message === 'string') {
    return err.message.includes('auth/too-many-requests');
  }
  return false;
}

/**
 * Check whether an error is a silent/dismiss error
 * (e.g. cancelled popup) that should not show any message.
 */
export function isSilentError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'auth/cancelled-popup-request';
}

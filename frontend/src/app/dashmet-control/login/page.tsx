// DASHMET System Admin Portal - Secure Login
// This page is intentionally at a secret URL path
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import SystemAdminWarningModal from '@/components/modals/SystemAdminWarningModal';
import { fetchPublicPlatformBranding, getEmailLogoUrl, getLoginBackgroundUrl } from '@/lib/platformBranding';

type MfaMethod = 'email_otp' | 'totp';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password. Please try again.';
const normalizeEmailInput = (value: string) => value.replace(/\u00A0/g, ' ').trim().toLowerCase();
const normalizePasswordInput = (value: string) => value.replace(/\u00A0/g, ' ').trim();

const normalizeLoginError = (message?: string): string => {
  const normalized = message?.toLowerCase().trim();
  if (!normalized || normalized === 'authentication failed' || normalized.includes('account is not authorized')) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  return message || INVALID_CREDENTIALS_MESSAGE;
};

export default function SystemAdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('email_otp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Show warning modal if blocked=true query param is present
  const [showBlockedWarning, setShowBlockedWarning] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(getLoginBackgroundUrl());
  const [logoImageUrl, setLogoImageUrl] = useState(getEmailLogoUrl());
  
  useEffect(() => {
    if (searchParams.get('blocked') === 'true') {
      setShowBlockedWarning(true);
      // Clean up the URL
      router.replace('/dashmet-control/login');
    }
  }, [searchParams, router]);

  useEffect(() => {
    let mounted = true;

    fetchPublicPlatformBranding()
      .then((branding) => {
        if (!mounted) return;
        setBackgroundImageUrl(getLoginBackgroundUrl(branding));
        setLogoImageUrl(getEmailLogoUrl(branding));
      })
      .catch(() => {
        // Keep local fallback assets when branding fetch fails.
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Redirect if already logged in as System Admin
  useEffect(() => {
    // Don't trigger if we're already handling a login success or redirecting
    if (loginSuccess || isRedirecting) return;
    
    if (!authLoading && user) {
      if (user.role === 'SYSTEM_ADMIN') {
        setIsRedirecting(true);
        setLoginSuccess(true); // Prevent any error flash
        window.location.href = '/system-admin';
      }
      // Don't show error for non-system-admin - they might be logging out and switching accounts
      // The login form will handle auth properly
    }
  }, [user, authLoading, loginSuccess, isRedirecting]);

  // Lockout timer
  useEffect(() => {
    if (isLocked && lockTimer > 0) {
      const timer = setTimeout(() => setLockTimer(lockTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockTimer === 0 && isLocked) {
      setIsLocked(false);
    }
  }, [isLocked, lockTimer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError(`Too many attempts. Please wait ${lockTimer} seconds.`);
      return;
    }

    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (requiresMfa && !mfaCode.trim()) {
      setError('Enter the verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const normalizedEmail = normalizeEmailInput(email);
      const normalizedPassword = normalizePasswordInput(password);

      // Single secure authentication flow with optional MFA challenge.
      const authResponse = await api.post('/system-admin-auth/authenticate', {
        email: normalizedEmail,
        password: normalizedPassword,
        mfaCode: mfaCode.trim(),
      });

      if (authResponse.data.success && authResponse.data.user?.role === 'SYSTEM_ADMIN') {
        // Success! Set flags to prevent any re-renders or duplicate redirects
        setIsRedirecting(true);
        setLoginSuccess(true);
        setError(''); // Clear any errors
        const refreshedUser = await refreshUser();
        if (!refreshedUser) {
          setIsRedirecting(false);
          setLoginSuccess(false);
          throw new Error(
            'Sign-in was verified, but the browser did not receive the secure session cookie. Check the deployed API proxy and cookie settings.'
          );
        }
        // Use window.location for a clean redirect without React state race conditions
        window.location.href = '/system-admin';
        return; // Exit early, keep loading state
      } else if (authResponse.data.requiresMfa) {
        const method: MfaMethod = authResponse.data.mfaMethod === 'totp' ? 'totp' : 'email_otp';
        setRequiresMfa(true);
        setMfaMethod(method);
        setMfaCode('');
        setLoading(false);
        setNotice(
          authResponse.data.message ||
            (method === 'totp'
              ? 'Enter the verification code from your authenticator app.'
              : 'Enter the verification code sent to your email.')
        );
        return;
      } else {
        throw new Error(authResponse.data.error || 'Account is not authorized for System Admin access');
      }
    } catch (err: any) {
      console.error('System Admin login error:', err);
      setLoading(false); // Only set loading false on error
      
      // Check if this is an API error with lockout info
      const apiError = err.response?.data;
      if (apiError?.locked) {
        setIsLocked(true);
        setLockTimer((apiError.remainingMinutes || 15) * 60);
        setError(
          apiError.error && apiError.error.toLowerCase() !== 'authentication failed'
            ? apiError.error
            : 'Account locked due to too many failed attempts.'
        );
      } else if (apiError?.requiresMfa) {
        const method: MfaMethod = apiError?.mfaMethod === 'totp' ? 'totp' : 'email_otp';
        setRequiresMfa(true);
        setMfaMethod(method);
        setNotice('');
        setError(
          method === 'totp'
            ? 'Invalid authenticator code. Try again.'
            : 'Invalid verification code. Try again.'
        );
      } else {
        setError(normalizeLoginError(apiError?.error || err.message));
      }
    }
  };

  const handleBackToCredentials = () => {
    setRequiresMfa(false);
    setMfaCode('');
    setError('');
    setNotice('');
  };

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundImageUrl}")` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <Loader2 className="relative z-10 h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // Show success state while redirecting
  if (loginSuccess) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundImageUrl}")` }} />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <div className="relative z-10 flex flex-col items-center space-y-4 rounded-2xl border border-white/20 bg-white/10 px-8 py-9 backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-300" />
          </div>
          <div className="text-white text-lg font-semibold">Authentication successful</div>
          <div className="text-slate-200 text-sm">Redirecting to System Admin Portal...</div>
          <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundImageUrl}")` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="w-full">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-7 pb-6 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative w-12 h-12 rounded-xl border border-white/20 bg-white/10 p-1 shadow-lg">
                <div className="w-full h-full rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  <Image 
                    src={logoImageUrl} 
                    alt="DASHMET" 
                    width={40}
                    height={40}
                    className="object-contain"
                    onError={() => setLogoImageUrl('/images/logo.png')}
                  />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              {requiresMfa ? 'Verify Sign In' : 'System Admin Sign In'}
            </h1>
            <p className="text-sm text-center text-gray-200 mt-2 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
              {requiresMfa ? 'Enter the verification code to continue.' : 'Authorized access only.'}
            </p>
          </div>

          {/* Security Notice */}
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-200 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span>Authorized personnel only.</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-5">
            {error && !loginSuccess && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-200 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </p>
              </div>
            )}

            {notice && !error && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-200 text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  {notice}
                </p>
              </div>
            )}

            {/* Email */}
            {!requiresMfa && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      disabled={isLocked}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 transition-all"
                      placeholder="admin@dashmet.com"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isLocked}
                      className="w-full px-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 transition-all"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {requiresMfa && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-300">
                    Verification for
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white break-all">{email}</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    {mfaMethod === 'totp' ? 'Authenticator Code' : 'Email Verification Code'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={isLocked}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 transition-all tracking-[0.35em]"
                      placeholder="000000"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <KeyRound className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {mfaMethod === 'totp'
                      ? 'Enter the 6-digit code from your authenticator app.'
                      : 'Enter the 6-digit code sent to your email. Codes expire after 10 minutes.'}
                  </p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{requiresMfa ? 'Verifying...' : 'Checking credentials...'}</span>
                </>
              ) : isLocked ? (
                <>
                  <LockKeyhole className="h-5 w-5" />
                  <span>Locked ({lockTimer}s)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span>{requiresMfa ? 'Verify and continue' : 'Continue'}</span>
                </>
              )}
            </button>

            {requiresMfa ? (
              <button
                type="button"
                onClick={handleBackToCredentials}
                className="mx-auto flex items-center justify-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            ) : (
              <div className="text-center">
                <Link
                  href={`/forgot-password?from=system-admin${email ? `&email=${encodeURIComponent(email.trim())}` : ''}`}
                  className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/10">
            <p className="text-xs text-center text-gray-400">
              Unauthorized access is prohibited
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* System Admin Blocked Warning Modal */}
      <SystemAdminWarningModal
        isOpen={showBlockedWarning}
        onClose={() => setShowBlockedWarning(false)}
        onRedirect={() => setShowBlockedWarning(false)}
      />
    </div>
  );
}

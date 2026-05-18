// Backend-owned email/password login
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { assertWebTrustedDeviceRemembered } from '@/lib/trustedDevice';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { fetchPublicPlatformBranding, getEmailLogoUrl, getLoginBackgroundUrl } from '@/lib/platformBranding';

type MfaMethod = 'email_otp';

const normalizeEmailInput = (value: string) => value.replace(/\u00A0/g, ' ').trim().toLowerCase();
const normalizePasswordInput = (value: string) => value.replace(/\u00A0/g, ' ').trim();

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, needsProfileSetup: authNeedsProfileSetup, refreshUser } = useAuth();
  const [step, setStep] = useState<'email' | 'password' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('email_otp');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaNotice, setMfaNotice] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  // Forgot password modal state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  
  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(getLoginBackgroundUrl());
  const [logoImageUrl, setLogoImageUrl] = useState(getEmailLogoUrl());
  
  // Check if redirected here due to account lockout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('locked') === 'true') {
      const lockedEmail = params.get('email') || '';
      if (lockedEmail) {
        router.replace(`/account-locked?email=${encodeURIComponent(lockedEmail)}`);
      }
      window.history.replaceState({}, '', '/login');
    }
    // Handle return from successful unlock
    if (params.get('unlocked') === 'true') {
      setError('Account unlocked. Please sign in with your new password.');
      window.history.replaceState({}, '', '/login');
    }
  }, [router]);

  // Redirect if user is already logged in (using AuthProvider)
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        // User has complete profile, redirect to dashboard
        router.push('/dashboard');
      } else if (authNeedsProfileSetup) {
        // User needs to complete profile setup
        router.push('/profile-setup');
      }
    }
  }, [user, authLoading, authNeedsProfileSetup, router]);

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

  // Show loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Checking your session...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // If user exists or needs profile setup, show loading while redirecting
  if (user || authNeedsProfileSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Redirecting you now...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      setEmail(normalizeEmailInput(email));
      setNeedsProfileSetup(false);
      setRequiresMfa(false);
      setMfaCode('');
      setMfaNotice('');
      setRememberDevice(false);
      setStep('password');
    } catch {
      setError('Unable to continue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresMfa && !mfaCode.trim()) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = normalizeEmailInput(email);
      const normalizedPassword = normalizePasswordInput(password);

      const payload: { email: string; password: string; mfaCode?: string; rememberDevice?: boolean } = {
        email: normalizedEmail,
        password: normalizedPassword,
      };
      if (requiresMfa) {
        payload.mfaCode = mfaCode.trim();
        payload.rememberDevice = rememberDevice;
      }

      const response = await api.post('/auth/login', payload);
      if (response.data?.requiresMfa) {
        setRequiresMfa(true);
        setMfaMethod('email_otp');
        setMfaNotice(response.data?.message || 'Enter the verification code sent to your email.');
        setError('');
        return;
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Unable to sign in');
      }

      await assertWebTrustedDeviceRemembered(requiresMfa && rememberDevice, response.data);

      const refreshedUser = await refreshUser();
      if (!refreshedUser) {
        throw new Error(
          'Sign-in was verified, but the browser did not receive the secure session cookie. Check the deployed API proxy and cookie settings.'
        );
      }
      router.push('/dashboard');
    } catch (err: any) {
      const apiError = err.response?.data;
      if (apiError?.requiresMfa) {
        setRequiresMfa(true);
        setMfaMethod('email_otp');
        setMfaNotice(apiError?.message || 'Enter the verification code sent to your email.');
        setError(typeof apiError?.error === 'string' ? apiError.error : 'Invalid verification code');
        return;
      }

      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : typeof err.message === 'string'
        ? err.message
        : 'Invalid email or password';

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendMfaCode = async () => {
    if (!email || !password) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', {
        email: normalizeEmailInput(email),
        password: normalizePasswordInput(password),
      });
      if (response.data?.requiresMfa) {
        setMfaNotice(response.data?.message || 'Enter the verification code sent to your email.');
        setMfaCode('');
        return;
      }
      setError('Unable to send a new verification code. Please try again.');
    } catch (err: any) {
      const message = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : 'Unable to send a new verification code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };



  // Self-registration is disabled — users must be invited by an organization admin

  const handleForgotPassword = async () => {
    setShowForgotPasswordModal(true);
    setResetEmail(email || '');
    setResetSuccess(false);
    setResetError('');
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedResetEmail = normalizeEmailInput(resetEmail);

    if (!normalizedResetEmail) {
      setResetError('Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedResetEmail)) {
      setResetError('Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    setResetError('');

    try {
      await api.post('/auth/forgot-password', { email: normalizedResetEmail });
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setResetEmail('');
    setResetSuccess(false);
    setResetError('');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundImageUrl}")` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base text-gray-400 hover:text-primary-400 mb-4 sm:mb-6 transition-colors group"
        >
          <svg 
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6">
          <div className="text-center mb-4 sm:mb-6">
            <div className="flex justify-center mb-3">
              <div className="relative w-16 h-16">
                <Image 
                  src={logoImageUrl} 
                  alt="DASHMET Logo" 
                  fill 
                  className="object-contain"
                  onError={() => setLogoImageUrl('/images/logo.png')}
                />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Sign in to DashMet
            </h1>
            <p className="text-sm sm:text-base text-gray-300 mb-2">
              Operations Intelligence
            </p>
            <p className="text-xs text-gray-400">Sign in with your email. New users must be invited by their organization admin.</p>
          </div>

          {error && (
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-200">Email</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setNeedsProfileSetup(false);
                      setRequiresMfa(false);
                      setMfaCode('');
                      setMfaNotice('');
                      setRememberDevice(false);
                      setError('');
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Change
                  </button>
                </div>
                <div className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white">{email}</div>
              </div>
              {needsProfileSetup && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                  <p className="text-amber-200 font-medium mb-1">Complete Your Profile</p>
                  <p className="text-amber-300/80">Your account was created but profile setup wasn't completed. Sign in to finish setting up your profile.</p>
                </div>
              )}
              {!requiresMfa && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}
              {requiresMfa && (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-100">
                    {mfaNotice || 'Enter the verification code sent to your email.'}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      {mfaMethod === 'email_otp' ? 'Email Verification Code' : 'Verification Code'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        className="w-full px-4 py-2.5 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent tracking-[0.35em]"
                        placeholder="000000"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <KeyRound className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-300">
                      <span>Codes expire in 10 minutes.</span>
                      <button
                        type="button"
                        onClick={handleResendMfaCode}
                        className="text-blue-300 hover:text-blue-200"
                      >
                        Resend code
                      </button>
                    </div>
                    <label className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-blue-100">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-2 focus:ring-blue-500/50"
                      />
                      <span className="leading-5">
                        Remember this device
                        <span className="block text-xs text-blue-200/70">Use only on a private device.</span>
                      </span>
                    </label>
                  </div>
                </>
              )}
              {!requiresMfa && (
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={handleForgotPassword} className="text-blue-400 hover:text-blue-300">Forgot password?</button>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? (requiresMfa ? 'Verifying...' : 'Signing in...') : (requiresMfa ? 'Verify & Sign In' : 'Sign In')}
              </button>
            </form>
          )}

          {step === 'register' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-200">Email</label>
                  <button type="button" onClick={() => setStep('email')} className="text-sm text-blue-400 hover:text-blue-300">Change</button>
                </div>
                <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white">{email}</div>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                <p className="text-amber-200 font-medium mb-1">Invitation Required</p>
                <p className="text-amber-300/80">This email is not registered. To join DashMet Operations Intelligence, you need an invitation from your organization administrator.</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                <p className="text-blue-200 font-medium mb-2">How to get started:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-blue-300/80">
                  <li>Ask your organization admin to send you an invitation</li>
                  <li>Check your email for the invitation link</li>
                  <li>Click the link to create your account</li>
                </ol>
              </div>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all font-medium shadow-lg"
              >
                Try a Different Email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Professional Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={closeForgotPasswordModal}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-md transform rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 shadow-2xl transition-all">
              {/* Close Button */}
              <button
                onClick={closeForgotPasswordModal}
                className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {resetSuccess ? (
                /* Success State */
                <div className="text-center py-4">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-gray-300 mb-4">
                    If an account exists for <span className="font-medium text-white">{resetEmail}</span>, you will receive a password reset link shortly.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-300 text-left">
                        <p className="font-medium mb-1">Didn't receive the email?</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-400/80">
                          <li>Check your spam folder</li>
                          <li>Make sure you entered the correct email</li>
                          <li>Wait a few minutes and try again</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeForgotPasswordModal}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all font-medium shadow-lg"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                /* Form State */
                <>
                  <div className="text-center mb-6">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-500/20 mb-4">
                      <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Reset Your Password
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>

                  {resetError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center">
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {resetError}
                    </div>
                  )}

                  <form onSubmit={handleSendResetEmail} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        placeholder="you@company.com"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center shadow-lg"
                    >
                      {resetLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Reset Link
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      onClick={closeForgotPasswordModal}
                      className="text-sm text-gray-400 hover:text-blue-400"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

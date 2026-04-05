// Phase 1.1: Firebase Email-First Login + Google OAuth + Microsoft OAuth
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  OAuthCredential
} from 'firebase/auth';
import { auth, googleProvider, microsoftProvider } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { getFirebaseErrorMessage, isTooManyRequestsError, isSilentError } from '@/lib/firebaseErrors';
import SystemAdminWarningModal from '@/components/modals/SystemAdminWarningModal';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, needsProfileSetup: authNeedsProfileSetup } = useAuth();
  const [step, setStep] = useState<'email' | 'password' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  
  // System Admin warning modal state
  const [showSystemAdminWarning, setShowSystemAdminWarning] = useState(false);
  
  // Forgot password modal state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  
  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
      setMessage('Account unlocked. Please sign in with your new password.');
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
    setMessage('');

    try {
      const response = await api.post('/firebase-auth/check-user', { email });
      const { existsInFirebase, existsInDatabase, hasProfile } = response.data.data;

      if (existsInFirebase && existsInDatabase && hasProfile) {
        // SECURITY: Check if account is locked BEFORE showing password form
        try {
          const securityCheck = await api.post('/firebase-auth/check-login-security', { email });
          if (securityCheck.data.data?.accountLocked) {
            router.push(`/account-locked?email=${encodeURIComponent(email)}`);
            return;
          }
        } catch {
          // If security check fails, proceed to password — server-side lockout will still block
        }
        // User exists in both Firebase and DB with complete profile - show password login
        setStep('password');
      } else if (existsInFirebase && !existsInDatabase) {
        // SECURITY: Check if account is locked BEFORE showing password form
        try {
          const securityCheck = await api.post('/firebase-auth/check-login-security', { email });
          if (securityCheck.data.data?.accountLocked) {
            router.push(`/account-locked?email=${encodeURIComponent(email)}`);
            return;
          }
        } catch {
          // If security check fails, proceed to password — server-side lockout will still block
        }
        // User exists in Firebase but not in DB - they need to complete profile setup
        setNeedsProfileSetup(true);
        setMessage('Your account exists but profile setup was not completed. Please enter your password to continue.');
        setStep('password');
      } else if (existsInFirebase && existsInDatabase && !hasProfile) {
        // SECURITY: Check if account is locked BEFORE showing password form
        try {
          const securityCheck = await api.post('/firebase-auth/check-login-security', { email });
          if (securityCheck.data.data?.accountLocked) {
            router.push(`/account-locked?email=${encodeURIComponent(email)}`);
            return;
          }
        } catch {
          // If security check fails, proceed to password — server-side lockout will still block
        }
        // User exists in both but profile incomplete
        setNeedsProfileSetup(true);
        setMessage('Please enter your password to complete your profile setup.');
        setStep('password');
      } else {
        // User doesn't exist in Firebase - show registration
        setStep('register');
      }
    } catch (err: any) {
      // Handle System Admin trying to use regular login
      if (err.response?.status === 403) {
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      const errorMsg = typeof err.response?.data?.error === 'string' 
        ? err.response.data.error 
        : getFirebaseErrorMessage(err, 'Failed to verify email');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      // SECURITY: Check if account is locked due to brute-force detection
      try {
        const securityCheck = await api.post('/firebase-auth/check-login-security', { email });
        if (securityCheck.data.data?.accountLocked) {
          await auth.signOut();
          router.push(`/account-locked?email=${encodeURIComponent(email)}`);
          return;
        }
      } catch {
        console.warn('Security check unavailable');
      }

      // Check if this login follows a password reset (unlock the account)
      try {
        await api.post('/firebase-auth/confirm-password-reset', { email });
      } catch {
        // Not a post-reset login — that's fine
      }

      // No suspicious activity — report successful login and proceed
      api.post('/firebase-auth/report-successful-login', { email }).catch(() => {});
      
      // Check if user has completed profile in PostgreSQL
      const response = await api.post('/firebase-auth/check-user', { email });
      const { existsInDatabase, hasProfile } = response.data.data;

      if (existsInDatabase && hasProfile) {
        router.push('/dashboard');
      } else {
        // User authenticated with Firebase but hasn't set up profile in DB
        router.push('/profile-setup');
      }
    } catch (err: any) {
      // Report the failed attempt to backend for tracking
      api.post('/firebase-auth/report-failed-login', { email }).catch(() => {});

      // Handle System Admin trying to use regular login
      if (err.response?.status === 403) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      // Account disabled at Firebase level OR Firebase rate-limited = account locked
      if (isTooManyRequestsError(err) || err.code === 'auth/user-disabled') {
        // Report to backend so it can disable the account if not already
        api.post('/firebase-auth/report-failed-login', { email }).catch(() => {});
        router.push(`/account-locked?email=${encodeURIComponent(email)}`);
        return;
      } else {
        setError(getFirebaseErrorMessage(err, 'Login failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/profile-setup');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setNeedsProfileSetup(true);
        setMessage('This email is already registered. Please enter your password to complete your profile setup.');
        setError('');
        setStep('password');
      } else {
        setError(getFirebaseErrorMessage(err, 'Registration failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const response = await api.post('/firebase-auth/check-user', { email: user.email });
      const { existsInDatabase, hasProfile } = response.data.data;

      if (existsInDatabase && hasProfile) {
        router.push('/dashboard');
      } else {
        router.push('/profile-setup');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      // Handle System Admin trying to use regular login
      if (err.response?.status === 403) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        // Show the warning modal
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      if (isSilentError(err)) return;
      setError(getFirebaseErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Microsoft OAuth Login Handler (Work, School, and Personal Microsoft accounts)
  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, microsoftProvider);
      const user = result.user;

      const response = await api.post('/firebase-auth/check-user', { email: user.email });
      const { existsInDatabase, hasProfile } = response.data.data;

      if (existsInDatabase && hasProfile) {
        router.push('/dashboard');
      } else {
        router.push('/profile-setup');
      }
    } catch (err: any) {
      console.error('Microsoft login error:', err);
      // Handle System Admin trying to use regular login
      if (err.response?.status === 403) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        // Show the warning modal
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      if (isSilentError(err)) return;
      // Special handling for account-exists-with-different-credential
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('google.com')) {
            setError('This email is linked to Google. Please sign in with Google first, then you can link Microsoft in your profile settings.');
          } else if (methods.includes('password')) {
            setError('This email is linked to email/password. Please sign in with your email and password.');
          } else {
            setError(getFirebaseErrorMessage(err));
          }
        } else {
          setError(getFirebaseErrorMessage(err));
        }
      } else {
        setError(getFirebaseErrorMessage(err, 'Microsoft sign-in failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setShowForgotPasswordModal(true);
    setResetEmail(email || '');
    setResetSuccess(false);
    setResetError('');
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setResetError('Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setResetError('Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    setResetError('');

    try {
      // Check if email exists in Firebase
      const signInMethods = await fetchSignInMethodsForEmail(auth, resetEmail);
      
      if (signInMethods.length === 0) {
        // Don't reveal if account doesn't exist for security
        // But still show success message
      }
      
      await sendPasswordResetEmail(auth, resetEmail, {
        // This URL is where users land AFTER completing password reset
        // The actual reset happens on our custom /reset-password page
        url: `${window.location.origin}/login`,
        handleCodeInApp: true, // This enables custom action URL handling
      });
      
      setResetSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Don't reveal if user doesn't exist - just show success
        setResetSuccess(true);
      } else {
        setResetError(getFirebaseErrorMessage(err, 'Failed to send reset email. Please try again.'));
      }
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
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
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

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8">
          <div className="text-center mb-5 sm:mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative w-16 h-16">
                <Image 
                  src="/images/logo.png" 
                  alt="DASHMET Logo" 
                  fill 
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Sign in to RCA Engine
            </h1>
            <p className="text-sm sm:text-base text-gray-300">
              Enterprise Root Cause Analysis Platform
            </p>
            <p className="text-xs text-gray-400 mt-3">Sign in instantly with Google or Microsoft (Work, School, or Personal), or use your email address to login or create a new account.</p>
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg text-success-700 dark:text-success-300 text-xs sm:text-sm">
              {message}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full mb-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/5 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Microsoft Login Button - Enterprise SSO */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full mb-4 sm:mb-6 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/5 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
          >
            {/* Microsoft Logo */}
            <svg className="w-5 h-5" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-gray-400">Or continue with email</span>
            </div>
          </div>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-200">Email</label>
                  <button type="button" onClick={() => { setStep('email'); setNeedsProfileSetup(false); }} className="text-sm text-blue-400 hover:text-blue-300">Change</button>
                </div>
                <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white">{email}</div>
              </div>
              {needsProfileSetup && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                  <p className="text-amber-200 font-medium mb-1">Complete Your Profile</p>
                  <p className="text-amber-300/80">Your account was created but profile setup wasn't completed. Sign in to finish setting up your profile.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
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
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={handleForgotPassword} className="text-blue-400 hover:text-blue-300">Forgot password?</button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-200">Email</label>
                  <button type="button" onClick={() => setStep('email')} className="text-sm text-blue-400 hover:text-blue-300">Change</button>
                </div>
                <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white">{email}</div>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                <p className="text-blue-200 font-medium mb-1">New Account</p>
                <p className="text-blue-300/80">This email is not registered. Create a password to continue.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    placeholder="Create a password (min 6 characters)"
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
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
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

      {/* System Admin Warning Modal */}
      <SystemAdminWarningModal
        isOpen={showSystemAdminWarning}
        onClose={() => setShowSystemAdminWarning(false)}
        onRedirect={() => {
          setShowSystemAdminWarning(false);
          router.push('/dashmet-control/login');
        }}
      />
    </div>
  );
}

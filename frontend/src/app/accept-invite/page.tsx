// Accept Invitation Page — invitation-only registration flow
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider, microsoftProvider } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { getFirebaseErrorMessage, isSilentError } from '@/lib/firebaseErrors';
import { Eye, EyeOff, Mail, Building2, Shield, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface InvitationData {
  email: string;
  role: string;
  organizationName: string;
  facilityName?: string;
  invitedBy: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, firebaseUser, loading: authLoading, refreshUser } = useAuth();

  // Invitation state
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');

  // Registration form state
  const [step, setStep] = useState<'validate' | 'register' | 'complete-profile' | 'success'>('validate');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validate invitation token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('No invitation token provided. Please use the link from your invitation email.');
      setValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  // If user is already logged in with a complete profile, redirect
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // If user has Firebase auth but no profile, and we have a valid invitation, show profile completion
  useEffect(() => {
    if (!authLoading && firebaseUser && !user && invitation) {
      // Check if the Firebase user's email matches the invitation
      if (firebaseUser.email?.toLowerCase() === invitation.email.toLowerCase()) {
        setStep('complete-profile');
      } else {
        setError(`This invitation is for ${invitation.email}. You're signed in as ${firebaseUser.email}. Please sign out first.`);
      }
    }
  }, [authLoading, firebaseUser, user, invitation]);

  const validateToken = async () => {
    setValidating(true);
    setTokenError('');
    try {
      const response = await api.get(`/invitations/${token}/validate`);
      if (response.data.success) {
        setInvitation(response.data.data);
        // If no Firebase user, show registration form
        if (!firebaseUser) {
          setStep('register');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'This invitation link is invalid or has expired.';
      setTokenError(msg);
    } finally {
      setValidating(false);
    }
  };

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    setLoading(true);
    setError('');

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // 1. Create Firebase account with the invitation email
      await createUserWithEmailAndPassword(auth, invitation.email, password);

      // 2. Create profile in PostgreSQL using invitation token
      const idToken = await auth.currentUser?.getIdToken();
      await api.post(
        '/firebase-auth/create-profile',
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          invitationToken: token,
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      // 3. Refresh auth state
      await refreshUser();
      setStep('success');

      // Redirect to dashboard after brief success message
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      // If Firebase account already exists, try signing in
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in with your password below, or use Google/Microsoft sign-in.');
        setStep('register');
      } else {
        const msg = err.response?.data?.error || getFirebaseErrorMessage(err, 'Registration failed. Please try again.');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    setLoading(true);
    setError('');

    try {
      // Sign in to existing Firebase account
      await signInWithEmailAndPassword(auth, invitation.email, password);

      // Complete profile with invitation token
      const idToken = await auth.currentUser?.getIdToken();
      await api.post(
        '/firebase-auth/create-profile',
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          invitationToken: token,
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      await refreshUser();
      setStep('success');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      const msg = err.response?.data?.error || getFirebaseErrorMessage(err, 'Sign-in failed. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'microsoft') => {
    if (!invitation || !token) return;

    setLoading(true);
    setError('');

    try {
      const authProvider = provider === 'google' ? googleProvider : microsoftProvider;
      const result = await signInWithPopup(auth, authProvider);

      // Verify the OAuth email matches the invitation
      if (result.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        await auth.signOut();
        setError(`This invitation is for ${invitation.email}, but you signed in with ${result.user.email}. Please use the correct account.`);
        setLoading(false);
        return;
      }

      // Complete profile
      setStep('complete-profile');
    } catch (err: any) {
      if (!isSilentError(err)) {
        setError(getFirebaseErrorMessage(err, `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in failed.`));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    setLoading(true);
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      await api.post(
        '/firebase-auth/create-profile',
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          invitationToken: token,
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      await refreshUser();
      setStep('success');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to complete profile. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──
  if (authLoading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Mail className="w-8 h-8 text-purple-600 animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Validating Invitation</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Checking your invitation link...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid/expired token ──
  if (tokenError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">Invitation Invalid</h1>
            <p className="text-sm text-gray-300 mb-6">{tokenError}</p>
            <p className="text-xs text-gray-400 mb-6">
              Please contact your organization administrator to request a new invitation.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-lg transition-all text-sm"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (step === 'success') {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">Welcome to DashMet RCA!</h1>
            <p className="text-sm text-gray-300 mb-2">
              Your account has been created successfully.
            </p>
            <p className="text-xs text-gray-400">Redirecting to dashboard...</p>
            <div className="flex items-center justify-center gap-1.5 mt-6">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete profile (OAuth users who are already signed in) ──
  if (step === 'complete-profile' && invitation) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8">
            <div className="text-center mb-5">
              <div className="flex justify-center mb-4">
                <div className="relative w-16 h-16">
                  <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Complete Your Profile</h1>
              <p className="text-xs text-gray-400">
                Signed in as <span className="font-medium text-white">{firebaseUser?.email}</span>
              </p>
            </div>

            {/* Invitation Details Card */}
            <div className="mb-5 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-300">Organization</span>
              </div>
              <p className="text-sm font-medium text-white ml-6">{invitation.organizationName}</p>
              <div className="flex items-center gap-2 mt-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-300">Role</span>
              </div>
              <p className="text-sm font-medium text-white ml-6">{formatRole(invitation.role)}</p>
              {invitation.facilityName && (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-300">Facility</span>
                  </div>
                  <p className="text-sm font-medium text-white ml-6">{invitation.facilityName}</p>
                </>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-200 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-200 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form (main flow) ──
  if (!invitation) return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-400 mb-4 transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Sign In
        </Link>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="flex justify-center mb-4">
              <div className="relative w-16 h-16">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Accept Invitation</h1>
            <p className="text-xs text-gray-400">Create your account to join your organization</p>
          </div>

          {/* Invitation Details Card */}
          <div className="mb-5 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">Email</span>
                <span className="text-xs font-medium text-white ml-auto truncate max-w-[200px]">{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">Organization</span>
                <span className="text-xs font-medium text-white ml-auto">{invitation.organizationName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">Role</span>
                <span className="text-xs font-medium text-white ml-auto">{formatRole(invitation.role)}</span>
              </div>
              {invitation.facilityName && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300">Facility</span>
                  <span className="text-xs font-medium text-white ml-auto">{invitation.facilityName}</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-white/10">
              Invited by {invitation.invitedBy}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* OAuth Sign-In Options */}
          <div className="space-y-2 mb-4">
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuthSignIn('microsoft')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
              Continue with Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-800/80 text-gray-400">or create with email & password</span>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="space-y-3">
            {/* Email (read-only, from invitation) */}
            <div>
              <label className="block text-xs font-medium text-gray-200 mb-1">Email</label>
              <input
                type="email"
                value={invitation.email}
                disabled
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm cursor-not-allowed"
              />
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-200 mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-200 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-200 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-gray-200 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Join Organization'
              )}
            </button>
          </form>

          {/* Already have account link */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

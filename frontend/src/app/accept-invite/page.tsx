// Accept Invitation Page — invitation-only registration flow
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { getFirebaseErrorMessage } from '@/lib/firebaseErrors';
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
  const [step, setStep] = useState<'validate' | 'register' | 'success'>('validate');
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

      // 3. Sign out so user must log in with their new credentials
      await signOut(auth);
      setStep('success');

      // Redirect to login after brief success message
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      // If Firebase account already exists, try signing in
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in on the login page.');
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
            <p className="text-xs text-gray-400">Redirecting to sign in...</p>
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

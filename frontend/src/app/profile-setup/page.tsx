// Profile Setup Page — Invitation-only registration
// Users without an invitation are directed to contact their admin
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Mail, AlertTriangle } from 'lucide-react';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, firebaseUser, loading: authLoading, needsProfileSetup } = useAuth();

  useEffect(() => {
    // If user has a complete profile, redirect to dashboard
    if (user) {
      router.push('/dashboard');
      return;
    }

    // If auth is done loading and there's no Firebase user, redirect to login
    if (!authLoading && !firebaseUser && !needsProfileSetup) {
      router.push('/login');
    }
  }, [user, firebaseUser, authLoading, needsProfileSetup, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary-200 dark:border-primary-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-primary-600 border-r-primary-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading your profile...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-3 py-4 xs:p-4 sm:p-6">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[calc(100vw-1.5rem)] xs:max-w-sm sm:max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-4 xs:p-5 sm:p-8">
          <div className="text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-amber-400" />
            </div>

            <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-2">
              Invitation Required
            </h1>

            {firebaseUser && (
              <p className="text-xs text-gray-400 mb-4">
                Signed in as: <span className="font-medium text-white break-all">{firebaseUser.email}</span>
              </p>
            )}

            <div className="mb-6 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200 text-left">
                  Registration requires an invitation from your organization administrator. 
                  Please check your email for an invitation link, or contact your admin to request one.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Once you receive an invitation email, click the link inside to complete your registration and join your organization.
            </p>

            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-lg transition-all text-sm text-center"
              >
                Back to Sign In
              </Link>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut(auth);
                    localStorage.removeItem('firebaseToken');
                    router.push('/login');
                  } catch (err) {
                    console.error('Failed to sign out:', err);
                  }
                }}
                className="block w-full text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Sign out and use a different account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


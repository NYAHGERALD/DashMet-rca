'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { Shield, Mail, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import api from '@/lib/api';

function AccountLockedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email] = useState(emailParam);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetInProgress, setResetInProgress] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If no email provided, redirect back to login
    if (!emailParam) {
      router.replace('/login');
    }
  }, [emailParam, router]);

  const handleSendResetEmail = async () => {
    setResetInProgress(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email: email.toLowerCase().trim() });
      setResetEmailSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send password reset email. Please try again.');
    } finally {
      setResetInProgress(false);
    }
  };

  if (!emailParam) return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-5 sm:p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16">
              <Image
                src="/images/logo.png"
                alt="DASHMET Logo"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Lock Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">Account Locked</h1>
          <p className="text-gray-400 text-center text-sm mb-6">
            Multiple failed login attempts were detected on your account. 
            All sessions have been revoked for your security. 
            You must reset your password to regain access.
          </p>

          {/* Email display */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg mb-6">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-300 truncate">{email}</span>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          {resetEmailSent ? (
            /* Post-reset state — user must follow the email link */
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-300 font-medium">Reset email sent</p>
                    <p className="text-xs text-green-300/70 mt-1">
                      Check your inbox at <strong>{email}</strong> and follow the link to set a new password.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300/80 text-center">
                  Your account will be automatically unlocked when you complete the password reset from the email link.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={resetInProgress}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                {resetInProgress ? 'Sending...' : 'Resend reset email'}
              </button>
            </div>
          ) : (
            /* Initial state — prompt to reset */
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    For your security, your account has been disabled at the authentication level. 
                    A password reset is required to restore access.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={resetInProgress}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {resetInProgress ? 'Sending Reset Email...' : 'Send Password Reset Email'}
              </button>
            </div>
          )}

          {/* Back to login */}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full flex items-center justify-center gap-2 mt-6 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          If you believe this is an error, contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default function AccountLockedPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>
        <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin relative z-10" />
      </div>
    }>
      <AccountLockedContent />
    </Suspense>
  );
}

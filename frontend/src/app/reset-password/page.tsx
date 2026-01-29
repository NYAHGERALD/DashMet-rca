// Professional Password Reset Page - Handles Firebase password reset action
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [codeValid, setCodeValid] = useState(false);
  
  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError('Invalid password reset link. Please request a new one.');
        setVerifying(false);
        return;
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
        setCodeValid(true);
      } catch (err: any) {
        if (err.code === 'auth/expired-action-code') {
          setError('This password reset link has expired. Please request a new one.');
        } else if (err.code === 'auth/invalid-action-code') {
          setError('This password reset link is invalid or has already been used.');
        } else {
          setError('Unable to verify reset link. Please try again.');
        }
        setCodeValid(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  useEffect(() => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [password]);

  const isPasswordStrong = () => {
    return (
      passwordStrength.hasMinLength &&
      passwordStrength.hasUppercase &&
      passwordStrength.hasLowercase &&
      passwordStrength.hasNumber
    );
  };

  const getStrengthPercentage = () => {
    const checks = Object.values(passwordStrength);
    return (checks.filter(Boolean).length / checks.length) * 100;
  };

  const getStrengthColor = () => {
    const percentage = getStrengthPercentage();
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 40) return 'bg-orange-500';
    if (percentage <= 60) return 'bg-yellow-500';
    if (percentage <= 80) return 'bg-lime-500';
    return 'bg-green-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong()) {
      setError('Please create a stronger password');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode!, password);
      setSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/expired-action-code') {
        setError('This password reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/10">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-gray-300">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-6">
                <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Password Reset Successful!
              </h1>
              <p className="text-gray-300 mb-8">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all font-medium shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!codeValid) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-500/20 mb-6">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-gray-300 mb-8">
                {error}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all font-medium shadow-lg"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/10">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/20 mb-4">
              <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Create New Password
            </h1>
            <p className="text-gray-300 text-sm">
              for <span className="font-medium text-white">{email}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-start">
              <svg className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-20 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  placeholder="Enter new password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  <svg className={`h-5 w-5 ${isPasswordStrong() ? 'text-green-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-3">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{ width: `${getStrengthPercentage()}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center ${passwordStrength.hasMinLength ? 'text-green-400' : 'text-gray-500'}`}>
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {passwordStrength.hasMinLength ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                      8+ characters
                    </div>
                    <div className={`flex items-center ${passwordStrength.hasUppercase ? 'text-green-400' : 'text-gray-500'}`}>
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {passwordStrength.hasUppercase ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                      Uppercase letter
                    </div>
                    <div className={`flex items-center ${passwordStrength.hasLowercase ? 'text-green-400' : 'text-gray-500'}`}>
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {passwordStrength.hasLowercase ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                      Lowercase letter
                    </div>
                    <div className={`flex items-center ${passwordStrength.hasNumber ? 'text-green-400' : 'text-gray-500'}`}>
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {passwordStrength.hasNumber ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                      Number
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`w-full px-4 py-3 pr-20 bg-white/5 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-500/50'
                      : confirmPassword && password === confirmPassword
                      ? 'border-green-500/50'
                      : 'border-white/10'
                  }`}
                  placeholder="Confirm new password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  {confirmPassword && (
                    password === confirmPassword ? (
                      <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )
                  )}
                </div>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-sm text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordStrong() || password !== confirmPassword}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center shadow-lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resetting Password...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Reset Password
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/10">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-gray-300">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState } from 'react';
import { 
  Brain, 
  Shield, 
  BarChart3, 
  Zap, 
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import api from '@/lib/api';
import { assertWebTrustedDeviceRemembered } from '@/lib/trustedDevice';
import SupportModal from '@/components/support/SupportModal';
import {
  fetchPublicPlatformBranding,
  getEmailLogoUrl,
  getLoginBackgroundUrl,
  type PlatformBranding,
} from '@/lib/platformBranding';

type MfaMethod = 'email_otp';
const normalizeEmailInput = (value: string) => value.replace(/\u00A0/g, ' ').trim().toLowerCase();
const normalizePasswordInput = (value: string) => value.replace(/\u00A0/g, ' ').trim();

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  
  // Login form state
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
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  // Forgot password modal state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  
  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(getLoginBackgroundUrl(branding));
  const [logoImageUrl, setLogoImageUrl] = useState(getEmailLogoUrl(branding));
  
  // Check if redirected here due to account lockout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('locked') === 'true') {
      // Redirect to dedicated account-locked page
      const lockedEmail = params.get('email') || '';
      if (lockedEmail) {
        router.replace(`/account-locked?email=${encodeURIComponent(lockedEmail)}`);
      }
      // Clean the URL without reloading
      window.history.replaceState({}, '', '/');
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let mounted = true;

    fetchPublicPlatformBranding()
      .then((nextBranding) => {
        if (!mounted) return;
        setBranding(nextBranding);
        setBackgroundImageUrl(getLoginBackgroundUrl(nextBranding));
        setLogoImageUrl(getEmailLogoUrl(nextBranding));
      })
      .catch(() => {
        // Keep local fallback assets when branding fetch fails.
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 relative overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <Image
              src={logoImageUrl}
              alt="DASHMET Logo"
              width={96}
              height={96}
              className="animate-pulse"
              priority
              onError={() => setLogoImageUrl('/images/logo.png')}
            />
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-blue-200/80 mt-4 text-sm font-medium tracking-wide">Initializing...</p>
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
      const payload: { email: string; password: string; mfaCode?: string; rememberDevice?: boolean } = {
        email: normalizeEmailInput(email),
        password: normalizePasswordInput(password),
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



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('Self-registration is disabled. Please use an invitation link from your organization administrator.');
  };

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
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white flex flex-col relative overflow-hidden">
      <SupportModal open={showSupportModal} onOpenChange={setShowSupportModal} />

      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${backgroundImageUrl}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 sm:w-64 h-32 sm:h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-48 sm:w-96 h-48 sm:h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Main Content - Centered Layout */}
      <main className="relative z-10 flex-1 flex items-center justify-center overflow-y-auto py-4 sm:py-8">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-8 md:px-12 lg:px-16 xl:px-20">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 xl:gap-24 items-center">
            
            {/* Left: Brand & Hero */}
            <div className="text-center space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Logo */}
              <div className="flex justify-center">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28">
                  <Image
                    src={logoImageUrl}
                    alt="DashMet Operations Intelligence Logo"
                    fill
                    className="object-contain"
                    priority
                    onError={() => setLogoImageUrl('/images/logo.png')}
                  />
                </div>
              </div>

              {/* Hero Content */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  DashMet
                </h1>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-blue-200/80 font-normal">
                  Operations Intelligence
                </p>
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-300 max-w-xl mx-auto px-1 sm:px-2">
                  Transform incident management with AI-powered analytics. Identify patterns, predict failures, and resolve issues faster than ever.
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-6 max-w-md lg:max-w-xl mx-auto">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-cyan-400 mx-auto mb-1 sm:mb-2" />
                  <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base mb-0.5">Secure</h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 hidden sm:block">Enterprise-grade security</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-400 mx-auto mb-1 sm:mb-2" />
                  <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base mb-0.5">Analytics</h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 hidden sm:block">Real-time insights</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-yellow-400 mx-auto mb-1 sm:mb-2" />
                  <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base mb-0.5">Fast</h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 hidden sm:block">Instant analysis</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 text-center">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-purple-400 mx-auto mb-1 sm:mb-2" />
                  <h3 className="font-semibold text-white text-xs sm:text-sm md:text-base mb-0.5">Smart</h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 hidden sm:block">AI-powered insights</p>
                </div>
              </div>
            </div>

            {/* Right: Auth Card */}
            <div className="w-full max-w-sm sm:max-w-md mx-auto lg:mx-0">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl">
                <div className="text-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2">Welcome</h2>
                  <p className="text-xs sm:text-sm md:text-base text-blue-200/70">Sign in to access your dashboard</p>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2">Sign in with your organization account. New users must use an invitation link.</p>
                </div>

                <div className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Email Form */}
                  {step === 'email' && (
                    <form onSubmit={handleEmailSubmit}>
                      <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-blue-200 mb-2">
                          Email Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="username"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                          placeholder="Enter your email"
                          required
                          disabled={loading}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Checking...' : 'Continue'}
                      </button>
                    </form>
                  )}

                  {/* Password Form */}
                  {step === 'password' && (
                    <div>
                      <div className="mb-4">
                        <p className="text-blue-200/70 text-sm">
                          Signing in as <span className="text-white font-medium">{email}</span>
                        </p>
                        <button
                          onClick={() => {
                            setStep('email');
                            setNeedsProfileSetup(false);
                            setRequiresMfa(false);
                            setMfaCode('');
                            setMfaNotice('');
                            setRememberDevice(false);
                            setError('');
                          }}
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          Change email
                        </button>
                      </div>
                      <form onSubmit={handlePasswordLogin}>
                        {!requiresMfa && (
                          <div className="mb-4">
                            <label htmlFor="password" className="block text-sm font-medium text-blue-200 mb-2">
                              Password
                            </label>
                            <div className="relative">
                              <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                placeholder="Enter your password"
                                required
                                disabled={loading}
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
                            <div className="p-3 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-100">
                              {mfaNotice || 'Enter the verification code sent to your email.'}
                            </div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-blue-200 mb-2">
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
                                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent tracking-[0.35em]"
                                  placeholder="000000"
                                  disabled={loading}
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
                          <div className="flex items-center justify-between mb-4">
                            <button
                              type="button"
                              onClick={handleForgotPassword}
                              className="text-blue-400 hover:text-blue-300 text-sm underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {loading ? (requiresMfa ? 'Verifying...' : 'Signing in...') : (requiresMfa ? 'Verify & Sign In' : 'Sign In')}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Register Form */}
                  {step === 'register' && (
                    <div className="space-y-4">
                      <div className="mb-4">
                        <p className="text-blue-200/70 text-sm">
                          Invitation required for <span className="text-white font-medium">{email}</span>
                        </p>
                        <button
                          onClick={() => setStep('email')}
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          Change email
                        </button>
                      </div>
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                        <p className="text-amber-200 font-medium mb-1">Self-registration is disabled</p>
                        <p className="text-amber-300/80">Ask your organization administrator to send an invitation link.</p>
                      </div>
                      <form onSubmit={handleRegister}>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          Request Invitation
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-20 border-t border-white/10 backdrop-blur-xl bg-slate-900/30 flex-shrink-0">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-3 sm:py-4 md:py-6">
          <div className="flex flex-col items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400">
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 sm:gap-x-3 md:gap-x-4 gap-y-1">
              <Link href="/privacy-policy" className="hover:text-white transition-colors underline">
                Privacy Policy
              </Link>
              <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <Link href="/terms-of-service" className="hover:text-white transition-colors underline">
                Terms of Service
              </Link>
              <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <Link href="/cookie-policy" className="hover:text-white transition-colors underline">
                Cookie Policy
              </Link>
              <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <Link href="/security" className="hover:text-white transition-colors underline">
                Security
              </Link>
              <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <button
                onClick={() => setShowSupportModal(true)}
                className="hover:text-white transition-colors underline"
              >
                Contact Support
              </button>
            </div>
            <p className="text-center">
              &copy; {new Date().getFullYear()} DASHMET. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal */}
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
                <X className="h-6 w-6" />
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
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all font-medium shadow-lg"
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
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center shadow-lg"
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

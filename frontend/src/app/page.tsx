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
  EyeOff
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { auth, googleProvider, microsoftProvider } from '@/lib/firebase';
import api from '@/lib/api';
import SupportModal from '@/components/support/SupportModal';
import SystemAdminWarningModal from '@/components/modals/SystemAdminWarningModal';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Login form state
  const [step, setStep] = useState<'email' | 'password' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  
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

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

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
              src="/images/logo.png"
              alt="DASHMET Logo"
              width={96}
              height={96}
              className="animate-pulse"
              priority
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

  // Login handlers (unchanged logic)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/firebase-auth/check-user', { email });
      const { existsInFirebase, existsInDatabase, hasProfile } = response.data.data;

      if (existsInFirebase && existsInDatabase && hasProfile) {
        setStep('password');
      } else if (existsInFirebase && !existsInDatabase) {
        setNeedsProfileSetup(true);
        setMessage('Your account exists but profile setup was not completed. Please enter your password to continue.');
        setStep('password');
      } else if (existsInFirebase && existsInDatabase && !hasProfile) {
        setNeedsProfileSetup(true);
        setMessage('Please enter your password to complete your profile setup.');
        setStep('password');
      } else {
        setStep('register');
      }
    } catch (err: any) {
      // Handle System Admin trying to use regular login
      if (err.response?.data?.isSystemAdmin) {
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      const errorMsg = typeof err.response?.data?.error === 'string' 
        ? err.response.data.error 
        : err.message || 'Failed to verify email';
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
      
      const response = await api.post('/firebase-auth/check-user', { email });
      const { existsInDatabase, hasProfile } = response.data.data;

      if (existsInDatabase && hasProfile) {
        router.push('/dashboard');
      } else {
        router.push('/profile-setup');
      }
    } catch (err: any) {
      // Handle System Admin trying to use regular login
      if (err.response?.data?.isSystemAdmin) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else {
        const errorMsg = typeof err === 'string' ? err : (err.message || 'Login failed');
        setError(errorMsg);
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
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        const errorMsg = typeof err === 'string' ? err : (err.message || 'Registration failed');
        setError(errorMsg);
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
      if (err.response?.data?.isSystemAdmin) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        // Show the warning modal
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Google login failed');
      }
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
      if (err.response?.data?.isSystemAdmin) {
        // Sign out from Firebase to clear the session
        await auth.signOut();
        // Show the warning modal
        setShowSystemAdminWarning(true);
        setLoading(false);
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email. Please sign in using Google or email/password.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid credentials. Please try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Microsoft sign-in is not enabled. Please contact support.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else {
        setError(err.message || 'Microsoft login failed. Please try again.');
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setResetError('Please enter a valid email address');
      return;
    }

    setResetLoading(true);
    setResetError('');

    try {
      await sendPasswordResetEmail(auth, resetEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      
      setResetSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetSuccess(true);
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address');
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Too many requests. Please try again later.');
      } else {
        setResetError(err.message || 'Failed to send reset email. Please try again.');
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
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white flex flex-col relative overflow-hidden">
      <SupportModal open={showSupportModal} onOpenChange={setShowSupportModal} />

      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="/images/landing-page-image.jpg"
          alt="Landing background"
          fill
          className="object-cover"
          priority
          quality={80}
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
                    src="/images/logo.png"
                    alt="DASHMET RCA Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Hero Content */}
              <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  DASHMET RCA
                </h1>
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-200/80 font-medium">
                  Intelligent Root Cause Analysis Engine
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
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2">Sign in or register with Google, Microsoft (Work/School/Personal), or your email.</p>
                </div>

                <div className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
                      {message}
                    </div>
                  )}

                  {/* Google Sign In */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-all duration-200 font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* Microsoft Sign In - Enterprise SSO */}
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#2F2F2F] text-white rounded-lg hover:bg-[#404040] transition-all duration-200 font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                  >
                    {/* Microsoft Logo */}
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    Continue with Microsoft
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-transparent text-slate-400">or</span>
                    </div>
                  </div>

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
                          onClick={() => setStep('email')}
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          Change email
                        </button>
                      </div>
                      <form onSubmit={handlePasswordLogin}>
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
                        <div className="flex items-center justify-between mb-4">
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-blue-400 hover:text-blue-300 text-sm underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Register Form */}
                  {step === 'register' && (
                    <div>
                      <div className="mb-4">
                        <p className="text-blue-200/70 text-sm">
                          Create account for <span className="text-white font-medium">{email}</span>
                        </p>
                        <button
                          onClick={() => setStep('email')}
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          Change email
                        </button>
                      </div>
                      <form onSubmit={handleRegister}>
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
                              className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              placeholder="Create a password"
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
                        <div className="mb-4">
                          <label htmlFor="confirmPassword" className="block text-sm font-medium text-blue-200 mb-2">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <input
                              id="confirmPassword"
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                              placeholder="Confirm your password"
                              required
                              disabled={loading}
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
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {loading ? 'Creating account...' : 'Create Account'}
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

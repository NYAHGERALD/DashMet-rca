// Accept Invitation Page — invitation-only registration flow
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import { Eye, EyeOff, Mail, Building2, Shield, CheckCircle2, AlertTriangle, Loader2, Phone, ChevronDown, Check, X } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '1', country: 'US', label: 'US +1', flag: '🇺🇸', format: '(XXX) XXX-XXXX', maxDigits: 10 },
  { code: '1', country: 'CA', label: 'CA +1', flag: '🇨🇦', format: '(XXX) XXX-XXXX', maxDigits: 10 },
  { code: '52', country: 'MX', label: 'MX +52', flag: '🇲🇽', format: '(XX) XXXX-XXXX', maxDigits: 10 },
];

function formatPhoneNumber(digits: string, countryCode: string): string {
  const d = digits.replace(/\D/g, '');
  if (countryCode === '52') {
    // Mexico: (XX) XXXX-XXXX
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  // US/CA: (XXX) XXX-XXXX
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

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
  const { user, loading: authLoading } = useAuth();

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

  // Phone state
  const [phoneDigits, setPhoneDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Password strength
  const passwordChecks = useMemo(() => ({
    minLength: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const passedCount = useMemo(() => Object.values(passwordChecks).filter(Boolean).length, [passwordChecks]);
  const strengthPercent = (passedCount / 5) * 100;
  const strengthLabel = passedCount <= 1 ? 'Very Weak' : passedCount === 2 ? 'Weak' : passedCount === 3 ? 'Fair' : passedCount === 4 ? 'Strong' : 'Very Strong';
  const strengthColor = passedCount <= 1 ? 'bg-red-500' : passedCount === 2 ? 'bg-orange-500' : passedCount === 3 ? 'bg-yellow-500' : passedCount === 4 ? 'bg-blue-500' : 'bg-emerald-500';
  const strengthTextColor = passedCount <= 1 ? 'text-red-400' : passedCount === 2 ? 'text-orange-400' : passedCount === 3 ? 'text-yellow-400' : passedCount === 4 ? 'text-blue-400' : 'text-emerald-400';

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
        setStep('register');
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

    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      setLoading(false);
      return;
    }

    if (passedCount < 3) {
      setError('Password is too weak. Please meet at least 3 of the strength requirements.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await api.post(
        `/invitations/${token}/accept`,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          ...(phoneDigits.length >= 10 ? {
            phone: phoneDigits,
            countryCode: selectedCountry.code,
          } : {}),
        }
      );

      setStep('success');

      // Redirect to login after brief success message
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
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

      {/* Content — landscape card */}
      <div className="relative z-10 w-full max-w-4xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-400 mb-4 transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Sign In
        </Link>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">

          {/* ── LEFT PANEL — Organization Info & Branding ── */}
          <div className="relative lg:w-[42%] bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-purple-600/30 p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_reverse]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 bg-indigo-500/8 rounded-full blur-2xl animate-[pulse_6s_ease-in-out_infinite]" />
              {/* Grid pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            </div>

            {/* Content */}
            <div className="relative z-10">
              {/* Logo with glow */}
              <div className="flex items-center gap-3 mb-8 animate-[fadeSlideDown_0.6s_ease-out]">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg animate-pulse" />
                  <div className="relative w-14 h-14 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
                    <Image src="/images/logo.png" alt="DASHMET Logo" width={40} height={40} className="object-contain" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">DASHMET</h2>
                  <p className="text-[10px] text-blue-300/70 uppercase tracking-widest">RCA Engine</p>
                </div>
              </div>

              {/* Welcome text */}
              <div className="mb-8 animate-[fadeSlideDown_0.6s_ease-out_0.15s_both]">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                  Welcome to<br />your team
                </h1>
                <p className="text-sm text-gray-300/80">You&apos;ve been invited to join your organization on DashMet.</p>
              </div>

              {/* Invitation details */}
              <div className="space-y-3 animate-[fadeSlideDown_0.6s_ease-out_0.3s_both]">
                {[
                  { icon: Mail, label: 'Email', value: invitation.email, truncate: true },
                  { icon: Building2, label: 'Organization', value: invitation.organizationName },
                  { icon: Shield, label: 'Role', value: formatRole(invitation.role) },
                  ...(invitation.facilityName ? [{ icon: Building2, label: 'Facility', value: invitation.facilityName }] : []),
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group"
                    style={{ animationDelay: `${0.35 + i * 0.08}s` }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <item.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.label}</p>
                      <p className={`text-sm font-medium text-white ${item.truncate ? 'truncate' : ''}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom — invited by */}
            <div className="relative z-10 mt-6 pt-4 border-t border-white/10 animate-[fadeSlideDown_0.6s_ease-out_0.55s_both]">
              <p className="text-[11px] text-gray-400">
                DASHMET <span className="text-gray-200 font-medium">{invitation.invitedBy}</span>
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL — Registration Form ── */}
          <div className="lg:w-[58%] p-5 sm:p-8 overflow-y-auto max-h-[85vh]">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white mb-1">Create your account</h2>
              <p className="text-xs text-gray-400">Fill in your details to get started</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs animate-[shake_0.4s_ease-in-out]">
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
                    minLength={12}
                    className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Minimum 12 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                <div className={`overflow-hidden transition-all duration-500 ease-out ${
                  password.length > 0 ? 'max-h-40 opacity-100 mt-2.5' : 'max-h-0 opacity-0 mt-0'
                }`}>
                  {/* Progress Bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${strengthColor}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium min-w-[60px] text-right transition-colors duration-300 ${strengthTextColor}`}>
                      {strengthLabel}
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {[
                      { key: 'minLength', label: '12+ characters' },
                      { key: 'hasUpper', label: 'Uppercase (A-Z)' },
                      { key: 'hasLower', label: 'Lowercase (a-z)' },
                      { key: 'hasNumber', label: 'Number (0-9)' },
                      { key: 'hasSpecial', label: 'Special (!@#$)' },
                    ].map(({ key, label }) => {
                      const passed = passwordChecks[key as keyof typeof passwordChecks];
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-1.5 transition-all duration-300 ${
                            passed ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 ${
                            passed
                              ? 'bg-emerald-500/20 text-emerald-400 scale-100'
                              : 'bg-white/5 text-gray-500 scale-90'
                          }`}>
                            {passed
                              ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
                              : <X className="w-2.5 h-2.5" strokeWidth={3} />
                            }
                          </div>
                          <span className={`text-[10px] transition-colors duration-300 ${
                            passed ? 'text-gray-200' : 'text-gray-500'
                          }`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
                    minLength={8}
                    className={`w-full px-3 py-2.5 pr-10 bg-white/5 border rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors duration-300 ${
                      confirmPassword.length > 0 && password !== confirmPassword
                        ? 'border-red-500/50'
                        : confirmPassword.length > 0 && password === confirmPassword
                          ? 'border-emerald-500/50'
                          : 'border-white/10'
                    }`}
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
                {/* Match indicator */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  confirmPassword.length > 0 ? 'max-h-6 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
                }`}>
                  <div className="flex items-center gap-1">
                    {password === confirmPassword ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                        <span className="text-[10px] text-emerald-400">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 text-red-400" strokeWidth={3} />
                        <span className="text-[10px] text-red-400">Passwords do not match</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Phone Number (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-200 mb-1">
                  Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  {/* Country Code Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="flex items-center gap-1 px-2.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors min-w-[90px]"
                    >
                      <span className="text-base">{selectedCountry.flag}</span>
                      <span className="text-xs text-gray-300">+{selectedCountry.code}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                    </button>
                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-40 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden">
                        {COUNTRY_CODES.map((c, i) => (
                          <button
                            key={`${c.country}-${i}`}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(c);
                              setShowCountryDropdown(false);
                              setPhoneDigits('');
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                              selectedCountry.country === c.country ? 'bg-blue-500/20 text-blue-300' : 'text-gray-200'
                            }`}
                          >
                            <span className="text-base">{c.flag}</span>
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Phone Input */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formatPhoneNumber(phoneDigits, selectedCountry.code)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw.length <= selectedCountry.maxDigits) {
                          setPhoneDigits(raw);
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder={selectedCountry.format}
                    />
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-gray-500">Used for mobile device login verification</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (password.length > 0 && passedCount < 3) || (confirmPassword.length > 0 && password !== confirmPassword)}
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

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.05); }
          66% { transform: translate(-10px, 10px) scale(0.95); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

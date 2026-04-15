'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebaseErrors';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useIsAdmin } from '@/lib/rbac';
import { formatDateTime } from '@/lib/dateUtils';
import api from '@/lib/api';
import LswNotificationSettings from '@/components/settings/LswNotificationSettings';
import Link from 'next/link';

const ProfilePictureCropper = dynamic(
  () => import('@/components/profile/ProfilePictureCropper'),
  { ssr: false }
);

type Tab = 'profile' | 'preferences' | 'notifications' | 'security';

interface Preferences {
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  defaultSiteId: string | null;
  defaultLineId: string | null;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'security', label: 'Security', icon: '🔒' },
];

function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, logout } = useAuth();
  const { theme: currentTheme, setTheme: setAppTheme } = useTheme();
  const { language, setLanguage, t, availableLanguages } = useI18n();
  const isAdmin = useIsAdmin();

  const initialTab = (searchParams.get('tab') as Tab) || 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [animatingTab, setAnimatingTab] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [preferences, setPreferences] = useState<Preferences>({
    theme: 'DARK',
    defaultSiteId: null,
    defaultLineId: null,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Phone number state
  const COUNTRY_CODES = [
    { country: 'US', code: '1', flag: '🇺🇸', label: 'US +1', format: '(555) 123-4567', maxDigits: 10 },
    { country: 'CA', code: '1', flag: '🇨🇦', label: 'CA +1', format: '(555) 123-4567', maxDigits: 10 },
    { country: 'MX', code: '52', flag: '🇲🇽', label: 'MX +52', format: '(55) 1234-5678', maxDigits: 10 },
  ];
  const [phoneDigits, setPhoneDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<'input' | 'verify'>('input');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);

  interface Session {
    id: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadPreferences();
    loadProfilePicture();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab;
    if (tab && TABS.some((t) => t.key === tab)) {
      switchTab(tab);
    }
  }, [searchParams]);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    setAnimatingTab(true);
    setTimeout(() => {
      setActiveTab(tab);
      setAnimatingTab(false);
    }, 150);
  };

  const loadPreferences = async () => {
    try {
      const response = await api.get('/preferences');
      const prefs = response.data.data;
      setPreferences(prefs);
    } catch (err: any) {
      console.error('Failed to load preferences:', err);
    }
  };

  const loadProfilePicture = async () => {
    try {
      const response = await api.get('/firebase-auth/me');
      if (response.data.data.user.profilePicture) {
        setProfilePicture(response.data.data.user.profilePicture);
      }
      const userPhone = response.data.data.user.phone;
      if (userPhone) {
        if (userPhone.startsWith('+52')) {
          setSelectedCountry(COUNTRY_CODES[2]);
          setPhoneDigits(userPhone.replace('+52', ''));
        } else if (userPhone.startsWith('+1')) {
          setSelectedCountry(COUNTRY_CODES[0]);
          setPhoneDigits(userPhone.replace('+1', ''));
        } else {
          setPhoneDigits(userPhone.replace(/^\+\d{1,3}/, ''));
        }
      }
    } catch (err: any) {
      console.error('Failed to load profile picture:', err);
    }
  };

  const handleImageCropped = async (croppedImageBlob: Blob) => {
    setUploadingPicture(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('profilePicture', croppedImageBlob, 'profile.jpg');
      const response = await api.post('/users/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setProfilePicture(response.data.data.profilePicture);
        setMessage('Profile picture updated successfully!');
        setShowCropper(false);
        if (refreshUser) refreshUser();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;
    setUploadingPicture(true);
    setError('');
    setMessage('');
    try {
      await api.delete('/users/profile-picture');
      setProfilePicture(null);
      setMessage('Profile picture removed!');
      if (refreshUser) refreshUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const formatPhoneNumber = (digits: string, countryCode: string): string => {
    if (!digits) return '';
    if (countryCode === '52') {
      if (digits.length <= 2) return `(${digits})`;
      if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    if (digits.length <= 3) return `(${digits})`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSavePhone = async () => {
    setPhoneLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.patch('/firebase-auth/update-phone', {
        phone: phoneDigits,
        countryCode: selectedCountry.code,
      });
      if (response.data?.data?.requiresVerification) {
        setMessage('A verification code has been sent to your email.');
        setPhoneVerificationStep('verify');
      } else {
        setMessage('Phone number updated!');
        setIsEditingPhone(false);
        setPhoneVerificationStep('input');
        setPhoneVerificationCode('');
        if (refreshUser) refreshUser();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update phone number');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (phoneVerificationCode.length !== 6) return;
    setPhoneVerifyLoading(true);
    setError('');
    setMessage('');
    try {
      await api.patch('/firebase-auth/update-phone', {
        phone: phoneDigits,
        countryCode: selectedCountry.code,
        verificationCode: phoneVerificationCode,
      });
      setMessage('Phone number verified and saved!');
      setIsEditingPhone(false);
      setPhoneVerificationStep('input');
      setPhoneVerificationCode('');
      if (refreshUser) refreshUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify phone number.');
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      await api.patch('/preferences', preferences);
      const themeMap: Record<string, 'light' | 'dark'> = {
        LIGHT: 'light',
        DARK: 'dark',
        SYSTEM: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      };
      setAppTheme(themeMap[preferences.theme]);
      setMessage('Preferences saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    if (!user?.email) { setError('No email address found'); return; }
    setPasswordLoading(true);
    setMessage('');
    setError('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage('Password reset email sent. Check your inbox.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err, 'Failed to send password reset email.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    setError('');
    try {
      const response = await api.get('/auth/sessions');
      setSessions(response.data.data.sessions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleViewSessions = () => { setShowSessionsModal(true); loadSessions(); };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    setError('');
    try {
      await api.delete('/auth/sessions/' + sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      setMessage('Session revoked');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke session');
    } finally {
      setRevokingSession(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!confirm('Sign out from all other devices?')) return;
    setSessionsLoading(true);
    setError('');
    try {
      const response = await api.delete('/auth/sessions');
      setSessions(sessions.filter((s) => s.isCurrent));
      setMessage(response.data.data.revokedCount + ' session(s) revoked');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const parseDeviceInfo = (deviceInfo: string | null) => {
    if (!deviceInfo) return { browser: 'Unknown', os: 'Unknown device' };
    let browser = 'Unknown';
    let os = 'Unknown';
    if (deviceInfo.includes('Chrome')) browser = 'Chrome';
    else if (deviceInfo.includes('Firefox')) browser = 'Firefox';
    else if (deviceInfo.includes('Safari')) browser = 'Safari';
    else if (deviceInfo.includes('Edge')) browser = 'Edge';
    if (deviceInfo.includes('Windows')) os = 'Windows';
    else if (deviceInfo.includes('Mac OS')) os = 'macOS';
    else if (deviceInfo.includes('Linux')) os = 'Linux';
    else if (deviceInfo.includes('Android')) os = 'Android';
    else if (deviceInfo.includes('iPhone') || deviceInfo.includes('iPad')) os = 'iOS';
    return { browser, os };
  };

  if (!user) return null;

  return (
    <div className={"min-h-full p-4 sm:p-6 lg:p-8 transition-opacity duration-500 " + (mounted ? "opacity-100" : "opacity-0")}>
      <div className="w-full space-y-6">

        {/* ── Profile Hero Card ── */}
        <div className={"relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 shadow-xl transform transition-all duration-700 " + (mounted ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0")}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative flex flex-col sm:flex-row items-center gap-5 p-6 sm:p-8">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white/20 ring-4 ring-white/30 shadow-2xl transform transition-transform duration-300 group-hover:scale-105">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold bg-white/10">
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowCropper(true)}
                title="Change profile picture"
                className="absolute inset-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{user.firstName} {user.lastName}</h1>
              <p className="text-primary-100 text-sm mt-1">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm border border-white/20">
                  {user.role}
                </span>
                {user.organizationName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-primary-100 text-xs font-medium border border-white/10">
                    {user.organizationName}
                  </span>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2 sm:flex-col">
              {isAdmin && (
                <Link href="/admin" className="px-4 py-2 text-xs font-medium text-white bg-white/15 hover:bg-white/25 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20 text-center">
                  👥 Manage Users
                </Link>
              )}
              <button
                onClick={() => logout()}
                className="px-4 py-2 text-xs font-medium text-white bg-red-500/80 hover:bg-red-500 rounded-xl transition-all duration-200 backdrop-blur-sm border border-red-400/30"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Toast Messages */}
        {message && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-300 border border-green-200 dark:border-green-800">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-300 border border-red-200 dark:border-red-800">
            <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className={"bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200/60 dark:border-gray-700/60 overflow-hidden transform transition-all duration-500 delay-100 " + (mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={"flex-1 relative py-4 px-2 text-sm font-medium transition-all duration-200 " + (activeTab === tab.key
                  ? "text-primary-700 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                )}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <span className="text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary-500 rounded-full transition-all duration-300" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className={"p-5 sm:p-8 transition-all duration-200 " + (animatingTab ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0")}>

            {/* ── Profile ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Photo actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => setShowCropper(true)} disabled={uploadingPicture} className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all duration-200 disabled:opacity-50">
                    {uploadingPicture ? 'Uploading...' : profilePicture ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {profilePicture && (
                    <button onClick={handleRemoveProfilePicture} disabled={uploadingPicture} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 disabled:opacity-50">
                      Remove Photo
                    </button>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">Square image, at least 256x256px. JPG, PNG or GIF.</p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                    <input type="text" value={user.firstName || ''} disabled aria-label="First name" className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                    <input type="text" value={user.lastName || ''} disabled aria-label="Last name" className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" value={user.email || ''} disabled aria-label="Email" className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                    <input type="text" value={user.role || ''} disabled aria-label="Role" className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm" />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">📱 Phone Number</label>
                    {!isEditingPhone && (
                      <button onClick={() => setIsEditingPhone(true)} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
                        {phoneDigits ? 'Change' : 'Add Phone'}
                      </button>
                    )}
                  </div>
                  {!isEditingPhone ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {phoneDigits
                        ? selectedCountry.flag + ' +' + selectedCountry.code + ' ' + formatPhoneNumber(phoneDigits, selectedCountry.code)
                        : 'No phone number added'
                      }
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {phoneVerificationStep === 'input' ? (
                        <>
                          <div className="flex gap-2">
                            <div className="relative">
                              <button type="button" onClick={() => setShowCountryDropdown(!showCountryDropdown)} className="flex items-center gap-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[90px]">
                                <span className="text-base">{selectedCountry.flag}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-300">+{selectedCountry.code}</span>
                                <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {showCountryDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 overflow-hidden">
                                  {COUNTRY_CODES.map((c, i) => (
                                    <button key={c.country + '-' + i} type="button" onClick={() => { setSelectedCountry(c); setShowCountryDropdown(false); setPhoneDigits(''); }} className={"w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors " + (selectedCountry.country === c.country ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200')}>
                                      <span className="text-base">{c.flag}</span><span>{c.label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input type="tel" value={formatPhoneNumber(phoneDigits, selectedCountry.code)} onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); if (raw.length <= selectedCountry.maxDigits) setPhoneDigits(raw); }} className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500" placeholder={selectedCountry.format} />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={handleSavePhone} disabled={phoneLoading || (phoneDigits.length > 0 && phoneDigits.length < 10)} className="px-4 py-2 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50">
                              {phoneLoading ? 'Sending Code...' : 'Verify & Save'}
                            </button>
                            <button onClick={() => { setIsEditingPhone(false); setPhoneVerificationStep('input'); setPhoneVerificationCode(''); }} className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors">Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">📧 Check your email</p>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">Enter the 6-digit code sent to your email.</p>
                          </div>
                          <input type="text" inputMode="numeric" maxLength={6} value={phoneVerificationCode} onChange={(e) => setPhoneVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center tracking-[0.3em] font-mono focus:ring-2 focus:ring-primary-500" placeholder="000000" autoFocus />
                          <div className="flex items-center gap-2">
                            <button onClick={handleVerifyPhone} disabled={phoneVerifyLoading || phoneVerificationCode.length !== 6} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50">{phoneVerifyLoading ? 'Verifying...' : 'Confirm Code'}</button>
                            <button onClick={handleSavePhone} disabled={phoneLoading} className="px-4 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 transition-colors disabled:opacity-50">{phoneLoading ? 'Sending...' : 'Resend'}</button>
                            <button onClick={() => { setPhoneVerificationStep('input'); setPhoneVerificationCode(''); setMessage(''); }} className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors">Back</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  💡 To update your name or role, contact your system administrator.
                </p>
              </div>
            )}

            {/* ── Preferences ── */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settings.theme')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['LIGHT', 'DARK', 'SYSTEM'].map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          setPreferences({ ...preferences, theme: theme as any });
                          const themeMap: Record<string, 'light' | 'dark'> = { LIGHT: 'light', DARK: 'dark', SYSTEM: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' };
                          setAppTheme(themeMap[theme]);
                        }}
                        className={"border-2 rounded-xl p-4 text-center text-sm font-medium transition-all duration-200 hover:scale-[1.02] " + (preferences.theme === theme
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-md shadow-primary-500/10'
                          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )}
                      >
                        {theme === 'LIGHT' && '☀️ ' + t('settings.light')}
                        {theme === 'DARK' && '🌙 ' + t('settings.dark')}
                        {theme === 'SYSTEM' && '💻 ' + t('settings.system')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.language')}</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as any)} aria-label="Language" className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm">
                    {Object.entries(availableLanguages).map(([code, lang]) => (
                      <option key={code} value={code}>{lang.flag} {lang.nativeName}</option>
                    ))}
                  </select>
                  {language !== 'en' && (
                    <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <span>✨</span><span>{t('settings.realTimeTranslation')} - {availableLanguages[language]?.name}</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={savePreferences} disabled={loading} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-primary-500/25">
                    {loading ? t('common.loading') : t('settings.savePreferences')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {activeTab === 'notifications' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <LswNotificationSettings />
              </div>
            )}

            {/* ── Security ── */}
            {activeTab === 'security' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">🔑 Change Password</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    We&apos;ll send a reset link to <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>.
                  </p>
                  <button onClick={handleSendPasswordResetEmail} disabled={passwordLoading} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-primary-500/25">
                    {passwordLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Sending...
                      </span>
                    ) : 'Send Password Reset Email'}
                  </button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">🖥️ Active Sessions</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Manage your active login sessions across devices.</p>
                  <button onClick={handleViewSessions} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/25">View Sessions</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Picture Cropper */}
      {showCropper && (
        <div className="fixed inset-0 z-[70]">
          <ProfilePictureCropper onImageCropped={handleImageCropped} onCancel={() => setShowCropper(false)} currentImage={profilePicture} />
        </div>
      )}

      {/* Sessions Modal */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[75vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Sessions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowSessionsModal(false)} title="Close sessions" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No active sessions</div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const { browser, os } = parseDeviceInfo(session.deviceInfo);
                    return (
                      <div key={session.id} className={"p-4 rounded-xl border transition-all duration-200 " + (session.isCurrent ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50')}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">{browser} on {os}</span>
                              {session.isCurrent && (<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Current</span>)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                              {session.ipAddress && <p>IP: {session.ipAddress}</p>}
                              <p>Signed in: {formatDateTime(session.createdAt)}</p>
                            </div>
                          </div>
                          {!session.isCurrent && (
                            <button onClick={() => handleRevokeSession(session.id)} disabled={revokingSession === session.id} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
                              {revokingSession === session.id ? 'Revoking...' : 'Revoke'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button onClick={handleRevokeAllOtherSessions} disabled={sessionsLoading || sessions.filter((s) => !s.isCurrent).length === 0} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50">Sign out all others</button>
              <button onClick={() => setShowSessionsModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-xl font-medium text-sm transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPageWrapper() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  );
}

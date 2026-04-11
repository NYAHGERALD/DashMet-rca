'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { sendPasswordResetEmail, PhoneAuthProvider, RecaptchaVerifier, updatePhoneNumber } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useSettingsModal } from './SettingsModalProvider';
import { formatDateTime } from '@/lib/dateUtils';
import api from '@/lib/api';

const ProfilePictureCropper = dynamic(
  () => import('@/components/profile/ProfilePictureCropper'),
  { ssr: false }
);

interface Preferences {
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  defaultSiteId: string | null;
  defaultLineId: string | null;
}

export default function SettingsModal() {
  const { isOpen, closeSettings, initialTab } = useSettingsModal();
  const { user, refreshUser } = useAuth();
  const { theme: currentTheme, setTheme: setAppTheme } = useTheme();
  const { language, setLanguage, t, availableLanguages } = useI18n();

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
  const [closing, setClosing] = useState(false);

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
  const [verificationId, setVerificationId] = useState('');
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

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

  // Reset tab when opened with a new initialTab
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setError('');
      loadPreferences();
      loadProfilePicture();
    }
  }, [isOpen]);

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
      // Load phone number if available
      const userPhone = response.data.data.user.phone;
      if (userPhone) {
        // Phone comes back as E.164 format e.g. "+15551234567"
        // Parse country code and digits
        if (userPhone.startsWith('+52')) {
          setSelectedCountry(COUNTRY_CODES[2]); // MX
          setPhoneDigits(userPhone.replace('+52', ''));
        } else if (userPhone.startsWith('+1')) {
          setSelectedCountry(COUNTRY_CODES[0]); // US (default)
          setPhoneDigits(userPhone.replace('+1', ''));
        } else {
          // Fallback: strip the + and first digits
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
      console.error('Failed to upload profile picture:', err);
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
      setMessage('Profile picture removed successfully!');
      if (refreshUser) refreshUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to remove profile picture:', err);
      setError(err.response?.data?.error || 'Failed to remove profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const formatPhoneNumber = (digits: string, countryCode: string): string => {
    if (!digits) return '';
    if (countryCode === '52') {
      // Mexico: (XX) XXXX-XXXX
      if (digits.length <= 2) return `(${digits}`;
      if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    // US/CA: (XXX) XXX-XXXX
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSavePhone = async () => {
    setPhoneLoading(true);
    setError('');
    setMessage('');

    try {
      // If removing phone, call backend directly
      if (!phoneDigits || phoneDigits.trim() === '') {
        await api.patch('/firebase-auth/update-phone', { phone: '', countryCode: selectedCountry.code });
        setMessage('Phone number removed.');
        setIsEditingPhone(false);
        if (refreshUser) refreshUser();
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const e164Phone = `+${selectedCountry.code}${phoneDigits}`;

      // Set up invisible reCAPTCHA
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      }

      // Send SMS via Firebase Phone Auth
      const provider = new PhoneAuthProvider(auth);
      const vId = await provider.verifyPhoneNumber(e164Phone, recaptchaVerifierRef.current);
      setVerificationId(vId);
      setPhoneVerificationStep('verify');
      setMessage('A verification code has been sent to your phone via SMS.');
    } catch (err: any) {
      console.error('Failed to send verification:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to send verification code'));
      // Reset reCAPTCHA on error so it can be recreated
      recaptchaVerifierRef.current = null;
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
      // Verify the code via Firebase (also links phone to Firebase user)
      const credential = PhoneAuthProvider.credential(verificationId, phoneVerificationCode);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      await updatePhoneNumber(currentUser, credential);

      // Phone verified — save to database
      await api.patch('/firebase-auth/update-phone', {
        phone: phoneDigits,
        countryCode: selectedCountry.code,
      });

      setMessage('Phone number verified and saved!');
      setIsEditingPhone(false);
      setPhoneVerificationStep('input');
      setPhoneVerificationCode('');
      setVerificationId('');
      recaptchaVerifierRef.current = null;
      if (refreshUser) refreshUser();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to verify phone:', err);
      if (err.code === 'auth/credential-already-in-use') {
        setError('This phone number is already linked to another account.');
      } else if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid verification code. Please try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('Verification code expired. Please resend.');
      } else {
        setError(getFirebaseErrorMessage(err, err.response?.data?.error || 'Failed to verify phone number'));
      }
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
        'LIGHT': 'light',
        'DARK': 'dark',
        'SYSTEM': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      };
      setAppTheme(themeMap[preferences.theme]);
      setMessage('Preferences saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    if (!user?.email) {
      setError('No email address found for your account');
      return;
    }

    setPasswordLoading(true);
    setMessage('');
    setError('');

    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage(`Password reset email sent to ${user.email}. Please check your inbox.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      console.error('Failed to send password reset email:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to send password reset email. Please try again.'));
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
      console.error('Failed to load sessions:', err);
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleViewSessions = () => {
    setShowSessionsModal(true);
    loadSessions();
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    setError('');

    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      setMessage('Session revoked successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to revoke session:', err);
      setError(err.response?.data?.error || 'Failed to revoke session');
    } finally {
      setRevokingSession(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!confirm('Are you sure you want to sign out from all other devices?')) return;

    setSessionsLoading(true);
    setError('');

    try {
      const response = await api.delete('/auth/sessions');
      setSessions(sessions.filter((s) => s.isCurrent));
      setMessage(`${response.data.data.revokedCount} session(s) revoked successfully`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to revoke sessions:', err);
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
    else if (deviceInfo.includes('Opera')) browser = 'Opera';
    if (deviceInfo.includes('Windows')) os = 'Windows';
    else if (deviceInfo.includes('Mac OS')) os = 'macOS';
    else if (deviceInfo.includes('Linux')) os = 'Linux';
    else if (deviceInfo.includes('Android')) os = 'Android';
    else if (deviceInfo.includes('iPhone') || deviceInfo.includes('iPad')) os = 'iOS';
    return { browser, os };
  };

  const formatSessionDate = (dateString: string) => formatDateTime(dateString);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      closeSettings();
    }, 250);
  }, [closeSettings]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-250 ${closing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none`}>
        <div
          className={`pointer-events-auto w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-250 ${
            closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header with close button */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('settings.title')}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          {message && (
            <div className="mx-5 mt-3 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <p className="text-sm text-success-800 dark:text-success-200">{message}</p>
            </div>
          )}
          {error && (
            <div className="mx-5 mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
              <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
            </div>
          )}

          {/* Scrollable Content — all sections */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8">

            {/* PROFILE */}
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>👤</span> Profile Information
              </h3>

              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4 sm:gap-6 p-4 sm:p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="relative group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 border-4 border-white dark:border-gray-700 shadow-lg">
                    {profilePicture ? (
                      <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-bold">
                        {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || ''}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCropper(true)}
                    disabled={uploadingPicture}
                    className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <button
                      onClick={() => setShowCropper(true)}
                      disabled={uploadingPicture}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-50"
                    >
                      {uploadingPicture ? 'Uploading...' : profilePicture ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {profilePicture && (
                      <button
                        onClick={handleRemoveProfilePicture}
                        disabled={uploadingPicture}
                        className="px-3 py-1.5 text-xs font-medium text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 rounded-lg hover:bg-danger-100 dark:hover:bg-danger-900/30 transition-colors disabled:opacity-50"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recommended: Square image, at least 256x256px. JPG, PNG or GIF.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input type="text" value={user?.firstName || ''} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input type="text" value={user?.lastName || ''} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <input type="text" value={user?.role || ''} disabled className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    📱 Phone Number
                  </label>
                  {!isEditingPhone && (
                    <button
                      onClick={() => setIsEditingPhone(true)}
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                      {phoneDigits ? 'Change' : 'Add Phone'}
                    </button>
                  )}
                </div>

                {!isEditingPhone ? (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                    {phoneDigits
                      ? `${selectedCountry.flag} +${selectedCountry.code} ${formatPhoneNumber(phoneDigits, selectedCountry.code)}`
                      : 'No phone number added'
                    }
                  </div>
                ) : (
                  <div className="space-y-2">
                    {phoneVerificationStep === 'input' ? (
                      <>
                        <div className="flex gap-2">
                          {/* Country Code */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                              className="flex items-center gap-1 px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[90px]"
                            >
                              <span className="text-base">{selectedCountry.flag}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-300">+{selectedCountry.code}</span>
                              <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {showCountryDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
                                {COUNTRY_CODES.map((c, i) => (
                                  <button
                                    key={`${c.country}-${i}`}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setShowCountryDropdown(false);
                                      setPhoneDigits('');
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                                      selectedCountry.country === c.country
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                        : 'text-gray-700 dark:text-gray-200'
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
                          <input
                            type="tel"
                            value={formatPhoneNumber(phoneDigits, selectedCountry.code)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              if (raw.length <= selectedCountry.maxDigits) {
                                setPhoneDigits(raw);
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder={selectedCountry.format}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSavePhone}
                            disabled={phoneLoading || (phoneDigits.length > 0 && phoneDigits.length < 10)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {phoneLoading ? 'Sending Code...' : 'Verify & Save'}
                          </button>
                          <button
                            onClick={() => { setIsEditingPhone(false); setPhoneVerificationStep('input'); setPhoneVerificationCode(''); }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          An SMS verification code will be sent to this number to verify ownership.
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Verification Code Step */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-1 font-medium">� Check your phone</p>
                          <p className="text-xs text-blue-600 dark:text-blue-300">
                            We sent a 6-digit code via SMS to your phone number. Enter it below to verify ownership.
                          </p>
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={phoneVerificationCode}
                            onChange={(e) => setPhoneVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center tracking-[0.3em] font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="000000"
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleVerifyPhone}
                            disabled={phoneVerifyLoading || phoneVerificationCode.length !== 6}
                            className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {phoneVerifyLoading ? 'Verifying...' : 'Confirm Code'}
                          </button>
                          <button
                            onClick={handleSavePhone}
                            disabled={phoneLoading}
                            className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors disabled:opacity-50"
                          >
                            {phoneLoading ? 'Sending...' : 'Resend Code'}
                          </button>
                          <button
                            onClick={() => { setPhoneVerificationStep('input'); setPhoneVerificationCode(''); setMessage(''); }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          >
                            Back
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Didn&apos;t receive the SMS? Check your phone and try resending.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  💡 To update your profile information, contact your system administrator.
                </p>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-gray-200 dark:border-gray-700" />

            {/* PREFERENCES */}
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>⚙️</span> {t('settings.applicationPreferences')}
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.theme')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['LIGHT', 'DARK', 'SYSTEM'].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => {
                        setPreferences({ ...preferences, theme: theme as any });
                        const themeMap: Record<string, 'light' | 'dark'> = {
                          'LIGHT': 'light',
                          'DARK': 'dark',
                          'SYSTEM': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
                        };
                        setAppTheme(themeMap[theme]);
                      }}
                      className={`${
                        preferences.theme === theme
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      } border-2 rounded-lg p-3 text-center text-sm font-medium transition-all`}
                    >
                      {theme === 'LIGHT' && `☀️ ${t('settings.light')}`}
                      {theme === 'DARK' && `🌙 ${t('settings.dark')}`}
                      {theme === 'SYSTEM' && `💻 ${t('settings.system')}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.language')}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  {Object.entries(availableLanguages).map(([code, lang]) => (
                    <option key={code} value={code}>
                      {lang.flag} {lang.nativeName}
                    </option>
                  ))}
                </select>
                {language !== 'en' && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span>✨</span>
                    <span>{t('settings.realTimeTranslation')} - {availableLanguages[language]?.name}</span>
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={savePreferences}
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? `${t('common.loading')}` : t('settings.savePreferences')}
                </button>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-gray-200 dark:border-gray-700" />

            {/* SECURITY */}
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🔒</span> Security Settings
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Change Password</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Click the button below to receive a password reset link via email at{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{user?.email}</span>.
                  </p>
                  <button
                    onClick={handleSendPasswordResetEmail}
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Password Reset Email'
                    )}
                  </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Active Sessions</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Manage your active login sessions across devices.
                  </p>
                  <button
                    onClick={handleViewSessions}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-sm transition-colors"
                  >
                    View Sessions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Picture Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 z-[70]">
          <ProfilePictureCropper
            onImageCropped={handleImageCropped}
            onCancel={() => setShowCropper(false)}
            currentImage={profilePicture}
          />
        </div>
      )}

      {/* Active Sessions Sub-Modal */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[75vh] overflow-hidden shadow-2xl">
            {/* Sessions Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Sessions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowSessionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sessions Content */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No active sessions found</div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const { browser, os } = parseDeviceInfo(session.deviceInfo);
                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-lg border ${
                          session.isCurrent
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${session.isCurrent ? 'bg-primary-100 dark:bg-primary-800' : 'bg-gray-200 dark:bg-gray-600'}`}>
                              {os === 'Windows' || os === 'macOS' || os === 'Linux' ? (
                                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">{browser} on {os}</span>
                                {session.isCurrent && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Current Session
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                                {session.ipAddress && <p>IP: {session.ipAddress}</p>}
                                <p>Signed in: {formatSessionDate(session.createdAt)}</p>
                                <p>Expires: {formatSessionDate(session.expiresAt)}</p>
                              </div>
                            </div>
                          </div>
                          {!session.isCurrent && (
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={revokingSession === session.id}
                              className="px-3 py-1.5 text-sm font-medium text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md transition-colors disabled:opacity-50"
                            >
                              {revokingSession === session.id ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                'Revoke'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sessions Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={handleRevokeAllOtherSessions}
                disabled={sessionsLoading || sessions.filter((s) => !s.isCurrent).length === 0}
                className="px-4 py-2 text-sm font-medium text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign out all other sessions
              </button>
              <button
                onClick={() => setShowSessionsModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-md font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

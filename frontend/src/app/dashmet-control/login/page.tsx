// DASHMET System Admin Portal - Secure Login
// This page is intentionally at a secret URL path
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import SystemAdminWarningModal from '@/components/modals/SystemAdminWarningModal';

export default function SystemAdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Show warning modal if blocked=true query param is present
  const [showBlockedWarning, setShowBlockedWarning] = useState(false);
  
  useEffect(() => {
    if (searchParams.get('blocked') === 'true') {
      setShowBlockedWarning(true);
      // Clean up the URL
      router.replace('/dashmet-control/login');
    }
  }, [searchParams, router]);

  // Redirect if already logged in as System Admin
  useEffect(() => {
    // Don't trigger if we're already handling a login success or redirecting
    if (loginSuccess || isRedirecting) return;
    
    if (!authLoading && user) {
      if (user.role === 'SYSTEM_ADMIN') {
        setIsRedirecting(true);
        setLoginSuccess(true); // Prevent any error flash
        window.location.href = '/system-admin';
      }
      // Don't show error for non-system-admin - they might be logging out and switching accounts
      // The login form will handle auth properly
    }
  }, [user, authLoading, loginSuccess, isRedirecting]);

  // Lockout timer
  useEffect(() => {
    if (isLocked && lockTimer > 0) {
      const timer = setTimeout(() => setLockTimer(lockTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockTimer === 0 && isLocked) {
      setIsLocked(false);
      setLoginAttempts(0);
    }
  }, [isLocked, lockTimer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError(`Too many attempts. Please wait ${lockTimer} seconds.`);
      return;
    }

    if (!email || !password || !masterKey) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Verify master key with backend first (public endpoint)
      const verifyResponse = await api.post('/system-admin-auth/verify-master-key', {
        email,
        masterKey,
      });

      if (!verifyResponse.data.success) {
        if (verifyResponse.data.locked) {
          setIsLocked(true);
          setLockTimer((verifyResponse.data.remainingMinutes || 15) * 60);
        }
        throw new Error(verifyResponse.data.error || 'Invalid master key');
      }

      // Step 2: Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Step 3: Full authentication with backend (Firebase token + master key)
      let authResponse;
      try {
        authResponse = await api.post('/system-admin-auth/authenticate', {
          firebaseToken: idToken,
          masterKey,
        });
      } catch (authErr: any) {
        // If authenticate fails, sign out of Firebase immediately
        await auth.signOut();
        throw authErr;
      }

      if (authResponse.data.success && authResponse.data.user?.role === 'SYSTEM_ADMIN') {
        // Success! Set flags to prevent any re-renders or duplicate redirects
        setIsRedirecting(true);
        setLoginSuccess(true);
        setError(''); // Clear any errors
        // Use window.location for a clean redirect without React state race conditions
        window.location.href = '/system-admin';
        return; // Exit early, keep loading state
      } else {
        await auth.signOut();
        throw new Error(authResponse.data.error || 'Account is not authorized for System Admin access');
      }
    } catch (err: any) {
      console.error('System Admin login error:', err);
      // Make sure we're signed out on any error
      try {
        await auth.signOut();
      } catch (signOutErr) {
        // Ignore signout errors
      }
      setLoading(false); // Only set loading false on error
      
      // Check if this is an API error with lockout info
      const apiError = err.response?.data;
      if (apiError?.locked) {
        setIsLocked(true);
        setLockTimer((apiError.remainingMinutes || 15) * 60);
        setError(apiError.error || 'Account locked due to too many failed attempts');
      } else {
        setError(getFirebaseErrorMessage(err, 'Authentication failed. Please try again.'));
      }
    }
  };

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show success state while redirecting
  if (loginSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-white text-lg font-medium">Authentication Successful</div>
          <div className="text-slate-400 text-sm">Redirecting to System Admin Portal...</div>
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mt-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-indigo-500/5 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Security grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFmMjkzNyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>

      <div className="relative z-10 w-full max-w-md p-4">
        {/* Login Card */}
        <div className="backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/25">
                <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/images/logo.png" 
                    alt="DASHMET" 
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-xl font-bold text-center bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              DASHMET Control Center
            </h1>
            <p className="text-sm text-center text-slate-400 mt-1">
              System Administrator Access
            </p>
          </div>

          {/* Security Notice */}
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>This portal is monitored. All access attempts are logged.</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-5">
            {error && !loginSuccess && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Administrator Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 transition-all"
                  placeholder="admin@dashmet.com"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 transition-all"
                  placeholder="••••••••••••"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Master Key */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Master Security Key
              </label>
              <div className="relative">
                <input
                  type={showMasterKey ? 'text' : 'password'}
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  disabled={isLocked}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 transition-all font-mono text-sm"
                  placeholder="Enter your 64-character security key"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterKey(!showMasterKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showMasterKey ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Contact DASHMET security team if you've lost your master key.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  <span>Authenticating...</span>
                </>
              ) : isLocked ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Locked ({lockTimer}s)</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Secure Login</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-800/30 border-t border-slate-700/50">
            <p className="text-xs text-center text-slate-500">
              Protected by DASHMET Security • Unauthorized access is prohibited
            </p>
          </div>
        </div>

        {/* Security info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            🔒 256-bit SSL Encrypted Connection
          </p>
        </div>
      </div>

      {/* System Admin Blocked Warning Modal */}
      <SystemAdminWarningModal
        isOpen={showBlockedWarning}
        onClose={() => setShowBlockedWarning(false)}
        onRedirect={() => setShowBlockedWarning(false)}
      />
    </div>
  );
}

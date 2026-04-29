'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { SESSION_EXPIRED_EVENT } from '@/lib/api';
import { useTheme } from '@/components/providers/ThemeProvider';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organizationName: string | null;
  theme: string;
  language: string;
  timezone?: string;
  profilePicture: string | null;
}

interface LegacyFirebaseUser {
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: LegacyFirebaseUser | null;
  loading: boolean;
  needsProfileSetup: boolean;
  logout: (redirectUrl?: string) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function resolveTheme(userTheme: string): 'light' | 'dark' {
  const themeMap: Record<string, string> = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };

  const resolved = themeMap[userTheme] || 'dark';
  return resolved === 'light' ? 'light' : 'dark';
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_IDLE_TIMEOUT_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MS,
  60 * 60 * 1000
);
const SYSTEM_ADMIN_IDLE_TIMEOUT_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_SYSTEM_ADMIN_IDLE_TIMEOUT_MS,
  15 * 60 * 1000
);
const DEFAULT_WARNING_WINDOW_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_SESSION_WARNING_WINDOW_MS,
  5 * 60 * 1000
);
const SYSTEM_ADMIN_WARNING_WINDOW_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_SYSTEM_ADMIN_WARNING_WINDOW_MS,
  2 * 60 * 1000
);
const ACTIVITY_THROTTLE_MS = 15 * 1000;

const getIdleTimeoutForRole = (role?: string): number =>
  role === 'SYSTEM_ADMIN' ? SYSTEM_ADMIN_IDLE_TIMEOUT_MS : DEFAULT_IDLE_TIMEOUT_MS;

const getWarningWindowForRole = (role?: string, idleTimeoutMs?: number): number => {
  const configured = role === 'SYSTEM_ADMIN' ? SYSTEM_ADMIN_WARNING_WINDOW_MS : DEFAULT_WARNING_WINDOW_MS;
  const idleLimit = idleTimeoutMs ?? getIdleTimeoutForRole(role);
  return Math.max(10 * 1000, Math.min(configured, idleLimit - 5 * 1000));
};

const getLoginRedirectForRole = (role?: string): string =>
  role === 'SYSTEM_ADMIN' ? '/dashmet-control/login' : '/login';

const isTransientAuthLookupError = (error: any): boolean => {
  const status = error?.response?.status;
  const code = String(error?.code || '');
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK'
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdownSeconds, setIdleCountdownSeconds] = useState(0);
  const [extendingSession, setExtendingSession] = useState(false);
  const { setTheme } = useTheme();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(0);

  const loadCurrentUser = useCallback(async () => {
    const response = await withTimeout(api.get('/auth/me', { timeout: 5000 }), 7000, 'Auth profile lookup');
    const userData = response.data.data.user;
    setTheme(resolveTheme(userData.theme));
    if (typeof window !== 'undefined' && userData.timezone) {
      window.localStorage.setItem('userTimezone', userData.timezone);
    }
    setUser(userData);
    setNeedsProfileSetup(false);
    return userData;
  }, [setTheme]);

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();

    if (!user || loading || sessionExpired) {
      return;
    }

    const idleTimeoutMs = getIdleTimeoutForRole(user.role);
    const warningWindowMs = getWarningWindowForRole(user.role, idleTimeoutMs);
    const warningDelayMs = Math.max(idleTimeoutMs - warningWindowMs, 0);

    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true);
      setIdleCountdownSeconds(Math.max(1, Math.ceil(warningWindowMs / 1000)));

      const warningEndsAt = Date.now() + warningWindowMs;
      countdownIntervalRef.current = setInterval(() => {
        const secondsRemaining = Math.max(0, Math.ceil((warningEndsAt - Date.now()) / 1000));
        setIdleCountdownSeconds(secondsRemaining);
        if (secondsRemaining <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);
    }, warningDelayMs);

    expiryTimerRef.current = setTimeout(() => {
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      setSessionExpired(true);
      clearIdleTimers();
    }, idleTimeoutMs);
  }, [clearIdleTimers, loading, sessionExpired, user]);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const userData = await loadCurrentUser();
        if (!mounted) return;
        setUser(userData);
        setSessionExpired(false);
        setShowIdleWarning(false);
        setIdleCountdownSeconds(0);
        lastActivityRef.current = Date.now();
      } catch {
        if (!mounted) return;
        setUser(null);
        setNeedsProfileSetup(false);
        setShowIdleWarning(false);
        setIdleCountdownSeconds(0);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      clearIdleTimers();
    };
  }, [clearIdleTimers, loadCurrentUser]);

  useEffect(() => {
    scheduleIdleTimers();
    return clearIdleTimers;
  }, [clearIdleTimers, scheduleIdleTimers]);

  const handleUserActivity = useCallback(() => {
    if (!user || loading || sessionExpired || showIdleWarning) return;

    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;

    lastActivityRef.current = now;
    scheduleIdleTimers();
  }, [loading, scheduleIdleTimers, sessionExpired, showIdleWarning, user]);

  useEffect(() => {
    if (!user || loading || sessionExpired) return;

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((eventName) => window.addEventListener(eventName, handleUserActivity));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleUserActivity));
    };
  }, [handleUserActivity, loading, sessionExpired, user]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      setSessionExpired(true);
      clearIdleTimers();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [clearIdleTimers]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await loadCurrentUser();
      setSessionExpired(false);
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      lastActivityRef.current = Date.now();
      scheduleIdleTimers();
      return userData;
    } catch (error) {
      if (isTransientAuthLookupError(error) && user) {
        console.warn('Transient profile refresh error; preserving active session state.', error);
        return user;
      }

      console.error('Failed to refresh user profile:', error);
      setUser(null);
      setNeedsProfileSetup(false);
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      return null;
    }
  }, [loadCurrentUser, scheduleIdleTimers, user]);

  const handleStaySignedIn = useCallback(async () => {
    setExtendingSession(true);
    try {
      await api.post('/auth/refresh');
      setSessionExpired(false);
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      lastActivityRef.current = Date.now();
      scheduleIdleTimers();
    } catch (error) {
      console.error('Session extension failed:', error);
      if (isTransientAuthLookupError(error)) {
        setSessionExpired(false);
        setShowIdleWarning(false);
        setIdleCountdownSeconds(0);
        lastActivityRef.current = Date.now();
        scheduleIdleTimers();
        return;
      }
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      setSessionExpired(true);
      clearIdleTimers();
    } finally {
      setExtendingSession(false);
    }
  }, [clearIdleTimers, scheduleIdleTimers]);

  const logout = async (redirectUrl?: string) => {
    const targetUrl = redirectUrl || getLoginRedirectForRole(user?.role);

    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Backend logout failed; clearing local auth state anyway:', error);
    } finally {
      setUser(null);
      setNeedsProfileSetup(false);
      setSessionExpired(false);
      setShowIdleWarning(false);
      setIdleCountdownSeconds(0);
      clearIdleTimers();
      window.location.href = targetUrl;
    }
  };

  // Compatibility shim for older call sites while we migrate them from bearer
  // tokens to cookie-authenticated requests.
  const getIdToken = useCallback(async (): Promise<string | null> => {
    return user ? 'cookie-session' : null;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: null,
        loading,
        needsProfileSetup,
        logout,
        refreshUser,
        getIdToken,
      }}
    >
      {children}
      {showIdleWarning && user && !sessionExpired && (
        <div className="fixed inset-0 z-[9998] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-gray-900/95 shadow-2xl p-6 sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-timeout-warning-title"
            aria-describedby="session-timeout-warning-description"
          >
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 id="session-timeout-warning-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              Session timeout warning
            </h2>
            <p id="session-timeout-warning-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Your session will expire soon due to inactivity.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              Time remaining: {Math.max(0, idleCountdownSeconds)}s
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStaySignedIn}
                disabled={extendingSession}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-4 py-2.5 transition-colors"
              >
                {extendingSession ? 'Extending session...' : 'Stay signed in'}
              </button>
              <button
                onClick={() => logout(getLoginRedirectForRole(user.role))}
                className="flex-1 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-medium px-4 py-2.5 transition-colors"
              >
                Sign out now
              </button>
            </div>
          </div>
        </div>
      )}
      {sessionExpired && user && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-gray-900/95 shadow-2xl p-6 sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
            aria-describedby="session-expired-description"
          >
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 mb-4">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h2 id="session-expired-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              Session expired
            </h2>
            <p id="session-expired-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Your secure session has ended. For protection, access is now locked. Please sign in again to continue.
            </p>
            <button
              onClick={() => logout(getLoginRedirectForRole(user.role))}
              className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 transition-colors"
            >
              Sign in again
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Phase 1.1: Auth Provider (Firebase Authentication)

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

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
  profilePicture: string | null;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  needsProfileSetup: boolean;
  logout: (redirectUrl?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let fetchAttemptCount = 0;
    let isCurrentlyFetching = false;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    // Set timeout to prevent infinite loading - reduced to 3 seconds
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('Auth loading timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 3000);

    // Helper function to calculate backoff delay
    const getBackoffDelay = (attempts: number) => Math.min(1000 * Math.pow(2, attempts), 30000); // Max 30 seconds

    // Helper function to fetch user profile with retry logic
    const fetchUserProfile = async (firebaseUser: any, attempt = 0) => {
      if (!mounted || isCurrentlyFetching || attempt >= 3) {
        return; // Max 3 attempts to prevent infinite loop
      }

      isCurrentlyFetching = true;
      fetchAttemptCount = attempt;

      try {
        // Get Firebase ID token with force refresh on retry
        const token = await withTimeout<string>(
          firebaseUser.getIdToken(attempt > 0),
          5000,
          'Firebase getIdToken'
        );
        localStorage.setItem('firebaseToken', token);

        // Fetch user profile from PostgreSQL
        const response = await api.get('/firebase-auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          // Don't block the entire app on a slow/unreachable profile lookup.
          // The global axios timeout is 30s; this keeps the UI responsive.
          timeout: 5000,
        });

        const userData = response.data.data.user;
        if (mounted) {
          setUser(userData);
          setNeedsProfileSetup(false);
          applyTheme(userData.theme);
          fetchAttemptCount = 0; // Reset on success
        }
      } catch (error: any) {
        console.error(`Failed to fetch user profile (attempt ${attempt + 1}):`, error);
        
        if (mounted) {
          // Check if it's a rate limit error (429) or authentication error (401)
          const isRateLimited = error?.response?.status === 429;
          const isAuthError = error?.response?.status === 401;
          const isNetworkError = !error?.response;
          const rawErrorMessage = error?.response?.data?.error;
          const errorMessage = typeof rawErrorMessage === 'string' ? rawErrorMessage : '';
          
          // Check if user needs to set up profile (has Firebase auth but no PostgreSQL profile)
          const isUserNotFoundInDb = errorMessage.includes('User not found in database') || 
                                     errorMessage.includes('User not found');

          if (isRateLimited || isNetworkError) {
            // For rate limiting or network errors, retry with backoff
            const delay = getBackoffDelay(attempt);
            console.log(`Retrying user profile fetch in ${delay}ms...`);
            
            retryTimeout = setTimeout(() => {
              if (mounted) {
                fetchUserProfile(firebaseUser, attempt + 1);
              }
            }, delay);
          } else if (isAuthError && isUserNotFoundInDb) {
            // User has Firebase auth but needs to create PostgreSQL profile
            console.log('User authenticated with Firebase but needs profile setup');
            setUser(null);
            setNeedsProfileSetup(true);
            // Keep the Firebase token for profile creation
          } else if (isAuthError) {
            // For other auth errors, sign out the user
            console.log('Authentication failed, signing out user');
            setUser(null);
            setNeedsProfileSetup(false);
            localStorage.removeItem('firebaseToken');
            await auth.signOut();
          } else {
            // For other errors, set user to null but don't retry
            setUser(null);
            setNeedsProfileSetup(false);
          }
        }
      } finally {
        isCurrentlyFetching = false;
      }
    };

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('Firebase auth state changed:', fbUser ? 'User logged in' : 'No user');
      if (!mounted) return;
      clearTimeout(timeout);
      
      // Clear any pending retry timeout
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }

      if (fbUser) {
        setFirebaseUser(fbUser);
        await fetchUserProfile(fbUser);
      } else {
        if (mounted) {
          setUser(null);
          setFirebaseUser(null);
          setNeedsProfileSetup(false);
          localStorage.removeItem('firebaseToken');
          fetchAttemptCount = 0;
          isCurrentlyFetching = false;
        }
      }
      
      if (mounted) {
        console.log('Setting loading to false');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      unsubscribe();
    };
  }, []);

  const applyTheme = (userTheme: string) => {
    if (userTheme) {
      const themeMap: Record<string, string> = {
        'LIGHT': 'light',
        'DARK': 'dark',
        'SYSTEM': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      };
      const theme = themeMap[userTheme] || 'dark';
      localStorage.setItem('theme', theme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  };

  // Refresh user profile from backend (call after profile creation)
  const refreshUser = useCallback(async () => {
    const currentFirebaseUser = auth.currentUser;
    if (!currentFirebaseUser) {
      console.log('No Firebase user to refresh');
      return;
    }

    try {
      const token = await withTimeout<string>(currentFirebaseUser.getIdToken(true), 5000, 'Firebase getIdToken');
      localStorage.setItem('firebaseToken', token);

      const response = await api.get('/firebase-auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      const userData = response.data.data.user;
      setUser(userData);
      setNeedsProfileSetup(false);
      applyTheme(userData.theme);
      console.log('User profile refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  }, []);

  const logout = async (redirectUrl?: string) => {
    try {
      const targetUrl = redirectUrl || '/login';
      console.log('[AuthProvider] Logout called, redirecting to:', targetUrl);
      
      // Clear localStorage first
      localStorage.removeItem('firebaseToken');
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear React state
      setUser(null);
      setFirebaseUser(null);
      setNeedsProfileSetup(false);
      
      // Use window.location for immediate hard redirect that can't be overridden
      // This prevents race conditions with ProtectedRoute effects
      window.location.href = targetUrl;
    } catch (error) {
      console.error('Logout error:', error);
      // Still try to redirect even on error
      window.location.href = redirectUrl || '/login';
    }
  };

  // Get Firebase ID token for API calls
  const getIdToken = useCallback(async (): Promise<string | null> => {
    const currentFirebaseUser = auth.currentUser;
    if (!currentFirebaseUser) {
      // Try to get from localStorage as fallback
      const storedToken = localStorage.getItem('firebaseToken');
      return storedToken;
    }

    try {
      const token = await withTimeout<string>(currentFirebaseUser.getIdToken(true), 5000, 'Firebase getIdToken');
      localStorage.setItem('firebaseToken', token);
      return token;
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return localStorage.getItem('firebaseToken');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, needsProfileSetup, logout, refreshUser, getIdToken }}>
      {children}
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

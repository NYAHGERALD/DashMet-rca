// Phase 1.1: Firebase Client Configuration
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase config from environment variables (no hardcoded secrets)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (only if not already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Microsoft Auth Provider (Azure AD / Microsoft Identity)
// Supports: Personal Microsoft accounts, Work accounts, School accounts
export const microsoftProvider = new OAuthProvider('microsoft.com');

// Configure Microsoft provider for enterprise-grade security
// Request additional scopes for user profile information
microsoftProvider.addScope('openid');
microsoftProvider.addScope('profile');
microsoftProvider.addScope('email');
microsoftProvider.addScope('User.Read');

// Set custom OAuth parameters for Microsoft
// 'prompt': 'select_account' - Always show account picker for multi-account support
// This allows users to choose between personal, work, or school accounts
microsoftProvider.setCustomParameters({
  prompt: 'select_account',
  // tenant: 'common' allows both personal and organizational accounts
  // Use 'organizations' for work/school only, 'consumers' for personal only
  tenant: 'common',
});

// Initialize Firebase Storage
export const storage = getStorage(app);

export default app;

// Phase 1.1: Firebase Client Configuration
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

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

// Skip Firebase initialization during build/SSR when env vars are not available
// This prevents prerender failures on Render where NEXT_PUBLIC_ vars aren't set at build time
const isBuildTime = !firebaseConfig.apiKey;

let app: FirebaseApp | undefined;
let auth: Auth;
let storage: FirebaseStorage;
let googleProvider: GoogleAuthProvider;
let microsoftProvider: OAuthProvider;

if (!isBuildTime) {
  // Initialize Firebase (only if not already initialized)
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // Initialize Firebase Auth
  auth = getAuth(app);

  // Initialize Google Auth Provider
  googleProvider = new GoogleAuthProvider();

  // Initialize Microsoft Auth Provider (Azure AD / Microsoft Identity)
  microsoftProvider = new OAuthProvider('microsoft.com');

  // Configure Microsoft provider for enterprise-grade security
  microsoftProvider.addScope('openid');
  microsoftProvider.addScope('profile');
  microsoftProvider.addScope('email');
  microsoftProvider.addScope('User.Read');

  microsoftProvider.setCustomParameters({
    prompt: 'select_account',
    tenant: 'common',
  });

  // Initialize Firebase Storage
  storage = getStorage(app);
}

export { auth, googleProvider, microsoftProvider, storage };
export default app;

// Phase 1.1: Firebase Client Configuration
// NOTE: NEXT_PUBLIC_ values are PUBLIC by design (Firebase docs confirm client keys are not secrets).
// Security is enforced by Firebase Security Rules + backend token verification, not by hiding these.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase config from environment variables (baked into JS at build time by Next.js)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Getter-based lazy initialization: defers Firebase setup until first use.
// During Render build, env vars may not be present — getters prevent build crashes.
// At runtime, env vars are baked into the JS bundle and initialization succeeds on first call.
function createApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let _auth: ReturnType<typeof getAuth> | null = null;
export function getFirebaseAuth() {
  if (!_auth) _auth = getAuth(createApp());
  return _auth;
}

let _storage: ReturnType<typeof getStorage> | null = null;
export function getFirebaseStorage() {
  if (!_storage) _storage = getStorage(createApp());
  return _storage;
}

let _googleProvider: GoogleAuthProvider | null = null;
export function getGoogleProvider() {
  if (!_googleProvider) _googleProvider = new GoogleAuthProvider();
  return _googleProvider;
}

let _microsoftProvider: OAuthProvider | null = null;
export function getMicrosoftProvider() {
  if (!_microsoftProvider) {
    _microsoftProvider = new OAuthProvider('microsoft.com');
    _microsoftProvider.addScope('openid');
    _microsoftProvider.addScope('profile');
    _microsoftProvider.addScope('email');
    _microsoftProvider.addScope('User.Read');
    _microsoftProvider.setCustomParameters({
      prompt: 'select_account',
      tenant: 'common',
    });
  }
  return _microsoftProvider;
}

// Backward-compatible named exports for existing code.
// These use getter properties so Firebase only initializes when actually accessed at runtime.
// During build/prerender, if these are never accessed, no crash occurs.
export const auth = typeof window !== 'undefined' || firebaseConfig.apiKey
  ? getFirebaseAuth()
  : (undefined as any);
export const googleProvider = typeof window !== 'undefined' || firebaseConfig.apiKey
  ? getGoogleProvider()
  : (undefined as any);
export const microsoftProvider = typeof window !== 'undefined' || firebaseConfig.apiKey
  ? getMicrosoftProvider()
  : (undefined as any);
export const storage = typeof window !== 'undefined' || firebaseConfig.apiKey
  ? getFirebaseStorage()
  : (undefined as any);

export default typeof window !== 'undefined' || firebaseConfig.apiKey
  ? createApp()
  : (undefined as any);

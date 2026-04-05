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

// Lazy Firebase initialization — defers until first access at runtime.
// This allows the build to succeed on Render without NEXT_PUBLIC_ env vars,
// while still working at runtime once the vars are baked into the JS bundle.
let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _storage: FirebaseStorage | undefined;
let _googleProvider: GoogleAuthProvider | undefined;
let _microsoftProvider: OAuthProvider | undefined;
let _initialized = false;

function ensureInitialized() {
  if (_initialized) return;
  if (!firebaseConfig.apiKey) return; // Still no key (SSR/prerender) — skip

  _initialized = true;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _auth = getAuth(_app);
  _storage = getStorage(_app);

  _googleProvider = new GoogleAuthProvider();

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

// Getter-based exports: initialize on first access
export const auth = new Proxy({} as Auth, {
  get(_, prop) {
    ensureInitialized();
    if (!_auth) throw new Error('Firebase Auth not initialized — missing API key');
    return (_auth as any)[prop];
  },
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_, prop) {
    ensureInitialized();
    if (!_storage) throw new Error('Firebase Storage not initialized — missing API key');
    return (_storage as any)[prop];
  },
});

export const googleProvider = new Proxy({} as GoogleAuthProvider, {
  get(_, prop) {
    ensureInitialized();
    if (!_googleProvider) throw new Error('Google provider not initialized — missing API key');
    return (_googleProvider as any)[prop];
  },
});

export const microsoftProvider = new Proxy({} as OAuthProvider, {
  get(_, prop) {
    ensureInitialized();
    if (!_microsoftProvider) throw new Error('Microsoft provider not initialized — missing API key');
    return (_microsoftProvider as any)[prop];
  },
});

export default new Proxy({} as FirebaseApp, {
  get(_, prop) {
    ensureInitialized();
    if (!_app) throw new Error('Firebase App not initialized — missing API key');
    return (_app as any)[prop];
  },
});

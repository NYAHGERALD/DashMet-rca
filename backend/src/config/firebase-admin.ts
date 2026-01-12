// Phase 1.1: Firebase Admin SDK Configuration
import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  let credential: admin.credential.Credential;
  
  // Check for environment variable first (production - Render)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      credential = admin.credential.cert(serviceAccount);
      console.log('✅ Firebase Admin SDK initialized from environment variable');
    } catch (error) {
      console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
      throw error;
    }
  } else {
    // Fallback to file-based credentials (local development)
    const serviceAccountPath = path.join(process.cwd(), '..', 'firebase-adminsdk-fbsvc.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      credential = admin.credential.cert(serviceAccountPath);
      console.log('✅ Firebase Admin SDK initialized from file:', serviceAccountPath);
    } else {
      console.error('❌ Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON env var or provide firebase-adminsdk-fbsvc.json file');
      throw new Error('Firebase credentials not configured');
    }
  }
  
  admin.initializeApp({
    credential,
    storageBucket: 'dashmet-resolve-1ce6d.firebasestorage.app'
  });
}

export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
export const adminFirestore = admin.firestore();

export default admin;

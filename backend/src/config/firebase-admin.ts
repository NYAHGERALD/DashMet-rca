// Phase 1.1: Firebase Admin SDK Configuration
import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  let credential: admin.credential.Credential;
  
  // Check for base64 encoded credentials first
  const base64Creds = process.env.FIREBASE_CREDENTIALS_BASE64;
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  console.log('🔍 FIREBASE_CREDENTIALS_BASE64 exists:', !!base64Creds);
  console.log('🔍 GOOGLE_APPLICATION_CREDENTIALS_JSON exists:', !!jsonCreds);
  
  if (base64Creds) {
    try {
      const decoded = Buffer.from(base64Creds, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decoded);
      console.log('🔍 Parsed project_id:', serviceAccount.project_id);
      credential = admin.credential.cert(serviceAccount);
      console.log('✅ Firebase Admin SDK initialized from base64 environment variable');
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_CREDENTIALS_BASE64:', error);
      throw error;
    }
  } else if (jsonCreds) {
    try {
      const serviceAccount = JSON.parse(jsonCreds);
      console.log('🔍 Parsed project_id:', serviceAccount.project_id);
      credential = admin.credential.cert(serviceAccount);
      console.log('✅ Firebase Admin SDK initialized from JSON environment variable');
    } catch (error) {
      console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
      throw error;
    }
  } else {
    // Fallback to file-based credentials
    // Try multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'firebase-adminsdk-fbsvc.json'),  // Same directory
      path.join(process.cwd(), '..', 'firebase-adminsdk-fbsvc.json'),  // Parent directory
      path.join(__dirname, '..', '..', 'firebase-adminsdk-fbsvc.json'),  // Relative to this file
    ];
    
    let foundPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }
    
    if (foundPath) {
      credential = admin.credential.cert(foundPath);
      console.log('✅ Firebase Admin SDK initialized from file:', foundPath);
    } else {
      console.error('❌ Firebase credentials not found. Tried:', possiblePaths);
      console.error('Set GOOGLE_APPLICATION_CREDENTIALS_JSON env var or provide firebase-adminsdk-fbsvc.json file');
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
export const adminMessaging = admin.messaging();

export default admin;

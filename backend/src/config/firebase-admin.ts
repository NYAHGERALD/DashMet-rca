// Phase 1.1: Firebase Admin SDK Configuration
import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  let credential: admin.credential.Credential;
  
  // Debug: Check environment variable
  const envJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  console.log('🔍 GOOGLE_APPLICATION_CREDENTIALS_JSON exists:', !!envJson);
  console.log('🔍 GOOGLE_APPLICATION_CREDENTIALS_JSON length:', envJson?.length || 0);
  console.log('🔍 First 50 chars:', envJson?.substring(0, 50));
  
  // Check for environment variable first (production)
  if (envJson) {
    try {
      const serviceAccount = JSON.parse(envJson);
      console.log('🔍 Parsed project_id:', serviceAccount.project_id);
      credential = admin.credential.cert(serviceAccount);
      console.log('✅ Firebase Admin SDK initialized from environment variable');
    } catch (error) {
      console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
      console.error('❌ Raw value (first 100 chars):', envJson?.substring(0, 100));
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

export default admin;

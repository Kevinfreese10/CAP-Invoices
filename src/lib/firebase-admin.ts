import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import path from 'path';
import fs from 'fs';

// Prevent multiple initializations in development
if (!getApps().length) {
  try {
    // Check if the service account file exists (for local development)
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      // Local development using the downloaded service account
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      initializeApp({
        credential: cert(serviceAccount),
        storageBucket: 'studio-2604127518-57889.appspot.com',
        projectId: 'studio-2604127518-57889'
      });
      console.log('Firebase Admin initialized with local service account.');
    } else {
      // Production (Firebase App Hosting / Cloud Run) using Application Default Credentials
      initializeApp({
        storageBucket: 'studio-2604127518-57889.appspot.com',
        projectId: 'studio-2604127518-57889'
      });
      console.log('Firebase Admin initialized with Application Default Credentials.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = getFirestore();
const adminStorage = getStorage();

export { adminDb, adminStorage };

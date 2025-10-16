
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence, memoryLocalCache } from 'firebase/firestore';

export const firebaseConfig = {
  "projectId": "studio-2604127518-57889",
  "appId": "1:248831476160:web:4ad085282b5fd36518c825",
  "storageBucket": "studio-2604127518-57889.firebasestorage.app",
  "apiKey": "AIzaSyD6-yfkYDj_ONK_tZdHhQy3RITU8F9zrU8",
  "authDomain": "studio-2604127518-57889.firebaseapp.com",
  "messagingSenderId": "248831476160"
};

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

// Use a global variable to ensure Firebase is initialized only once.
let firebaseServices: FirebaseServices | null = null;
let persistenceEnabled = false;

function initializeFirebase(): FirebaseServices {
  if (firebaseServices) {
    return firebaseServices;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (typeof window !== 'undefined' && !persistenceEnabled) {
    enableIndexedDbPersistence(db, {
      // For multiple tabs, use memory cache as a fallback.
      // This helps prevent the "failed-precondition" error.
      cacheSizeBytes: 104857600, // 100 MB
    }).then(() => {
        persistenceEnabled = true;
        console.log("Firestore persistence enabled.");
    }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open. Using memory cache.');
            // This is a valid scenario, no need to throw an error.
            // Firestore will work but without offline persistence for this tab.
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not supported in this browser.');
        } else {
            console.error("Error enabling Firestore persistence:", err);
        }
    });
  }

  firebaseServices = { app, auth, db };
  return firebaseServices;
}

// Immediately initialize and export the services.
const { app: firebaseApp, auth, db } = initializeFirebase();

export { firebaseApp, auth, db };

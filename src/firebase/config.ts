
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

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

let firebaseServices: FirebaseServices | null = null;
let persistenceEnabled = false;

function initializeFirebase(): FirebaseServices {
  if (!firebaseServices) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    
    if (!persistenceEnabled) {
      try {
        enableIndexedDbPersistence(db)
          .then(() => {
            persistenceEnabled = true;
            console.log("Firestore persistence enabled.");
          })
          .catch((err) => {
            if (err.code == 'failed-precondition') {
              console.warn("Firestore persistence failed: Multiple tabs open.");
            } else if (err.code == 'unimplemented') {
              console.warn("Firestore persistence failed: Browser does not support it.");
            }
          });
      } catch (error) {
          console.error("Error enabling Firestore persistence:", error);
      }
    }

    firebaseServices = { app, auth, db };
  }
  return firebaseServices;
}

const { app: firebaseApp, auth, db } = initializeFirebase();

export { firebaseApp, auth, db };

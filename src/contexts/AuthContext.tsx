
'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, User as FirebaseUser, signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<User | 'invalid_role' | 'invalid_credentials' | undefined>;
  reauthenticate: (firebaseUser: FirebaseUser) => Promise<User | 'invalid_credentials' | undefined>;
  logout: () => void;
  signup: (email: string, password: string, name: string) => Promise<User | string>;
  updateUser: (updatedUser: User | null) => void;
  isAuthenticated: boolean | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            if (user && firebaseUser.uid === user.uid) {
                if (isAuthenticated === false) setIsAuthenticated(true);
                return;
            }
            await reauthenticate(firebaseUser);
        } else {
            updateUser(null);
            setIsAuthenticated(false);
        }
    });

    return () => unsubscribe();
  }, []);
  
  const updateUser = (updatedUser: User | null) => {
    setUser(updatedUser);
    if (updatedUser) {
        localStorage.setItem('my-accountant-user', JSON.stringify(updatedUser));
    } else {
        localStorage.removeItem('my-accountant-user');
    }
  }

  const login = async (email: string, password?: string): Promise<User | 'invalid_role' | 'invalid_credentials' | undefined> => {
    if (!password) return 'invalid_credentials';
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return await reauthenticate(userCredential.user);
    } catch (error: any) {
        if (error.code !== 'permission-denied') { 
             console.error("Error logging in:", error.code, error.message);
        }

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             return 'invalid_credentials';
        }
        return undefined;
    }
  };

  const reauthenticate = async (firebaseUser: FirebaseUser): Promise<User | 'invalid_credentials' | undefined> => {
        if (!firebaseUser.email) return 'invalid_credentials';
        
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                 const foundUser = { ...userDocSnap.data(), id: userDocSnap.id, uid: userDocSnap.id } as User;
                 updateUser(foundUser);
                 setIsAuthenticated(true);
                 return foundUser;
            } else {
                console.warn(`User document not found for UID: ${firebaseUser.uid}. This may happen if the user was created in Auth but their Firestore document creation failed.`)
                await signOut(auth);
                return 'invalid_credentials';
            }

        } catch (serverError: any) {
            if (serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: `users/${firebaseUser.uid}`,
                    operation: 'get',
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            }
             console.error("Error re-authenticating:", serverError);
             return undefined;
        }
  }

  const logout = () => {
    signOut(auth);
    updateUser(null);
    setIsAuthenticated(false);
  };

  const signup = async (email: string, password?: string, name?: string): Promise<User | string> => {
    if (!password) return 'Password is required.';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        const newUserDocRef = doc(db, "users", firebaseUser.uid);
        const newUser: User = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: name || email,
            email: email,
            role: 'client',
        };

        await setDoc(newUserDocRef, newUser);
        updateUser(newUser);
        setIsAuthenticated(true);

        return newUser;
    } catch (error: any) {
        console.error("Error signing up:", error);
        if (error.code === 'auth/email-already-in-use') {
            return 'An account with this email already exists.';
        }
        return 'An unexpected error occurred during signup.';
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, login, reauthenticate, logout, signup, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);
  
  if(isAuthenticated === false) return null;
  if(isAuthenticated === true) return <>{children}</>;
  return null;
}

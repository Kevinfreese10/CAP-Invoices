

'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<User | 'invalid_role' | 'invalid_credentials' | undefined>;
  logout: () => void;
  signup: (name: string, email: string) => User;
  updateUser: (updatedUser: User | null) => void;
  isAuthenticated: boolean | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const storedUser = localStorage.getItem('my-accountant-user');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
        } catch (e) {
            console.error("Could not parse user from localStorage", e);
            setIsAuthenticated(false);
        }
    } else {
        setIsAuthenticated(false);
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("uid", "==", firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const foundUser = { ...userDoc.data(), id: userDoc.id, uid: firebaseUser.uid } as User;
                updateUser(foundUser);
                setIsAuthenticated(true);
            } else {
                // This case might happen if a user exists in Auth but not Firestore.
                // For this app's logic, we treat them as logged out.
                logout(); 
            }
        } else {
            logout();
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
        // Step 1: Authenticate with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Step 2: Fetch user profile from Firestore
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            // This case should ideally not happen if user creation is handled correctly
            await auth.signOut();
            return 'invalid_credentials';
        }

        const userDoc = querySnapshot.docs[0];
        const foundUser = { ...userDoc.data(), id: userDoc.id } as User;
        
        if (foundUser.role !== 'admin' && foundUser.role !== 'staff' && foundUser.role !== 'reseller') {
            await auth.signOut();
            return 'invalid_role';
        }

        // This is the critical fix: ensure the uid from Firebase Auth is on the user object
        const userWithUid = { ...foundUser, uid: firebaseUser.uid };
        
        updateUser(userWithUid);
        setIsAuthenticated(true);
        return userWithUid;

    } catch (error: any) {
        console.error("Error logging in:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             return 'invalid_credentials';
        }
        return undefined;
    }
  };

  const logout = () => {
    auth.signOut();
    updateUser(null);
    setIsAuthenticated(false);
  };

  const signup = (name: string, email: string) => {
    // This is a placeholder for client-side signup and doesn't create a real user.
    const newUser: User = { id: `new-user-${Date.now()}`, uid: `new-uid-${Date.now()}`, name, email, role: 'client' };
    console.log("New client signup (placeholder):", newUser);
    return newUser;
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, signup, updateUser, isAuthenticated }}>
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

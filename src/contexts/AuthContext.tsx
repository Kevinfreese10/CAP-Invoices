
'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { users } from '@/lib/data';

interface AuthContextType {
  user: User | null;
  login: (email: string, name?: string) => User | undefined;
  logout: () => void;
  signup: (name: string, email: string) => User;
  isAuthenticated: boolean | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // This is a mock persistence check. In a real app, you'd check a token.
    try {
      const storedUser = localStorage.getItem('my-accountant-user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      }
    } catch (error) {
      console.error("Could not parse user from localStorage", error);
    }
    setIsAuthenticated(!!localStorage.getItem('my-accountant-user'));
  }, []);
  
  const updateUserState = (user: User | null) => {
    setUser(user);
    setIsAuthenticated(!!user);
     if (user) {
      localStorage.setItem('my-accountant-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('my-accountant-user');
    }
  }

  const login = (email: string, name?: string) => {
    const foundUser = users.find(u => u.email === email);
    if (foundUser) {
      if (user?.id !== foundUser.id) { // Only update state if it's a new login
        updateUserState(foundUser);
      }
      return foundUser;
    }
    // If not found, and it's not a staff/admin/reseller, create a new client account
    if (!email.endsWith('@test.com')) {
      const newUser: User = { id: `new-user-${Date.now()}`, name: name || 'New Client', email, role: 'client'};
      (users as User[]).push(newUser); // Not persistent across reloads, but fine for demo session
      updateUserState(newUser);
      return newUser;
    }
    
    return undefined;
  };

  const logout = () => {
    updateUserState(null);
  };

  const signup = (name: string, email: string) => {
    // In a real app, this would create a new user in the DB.
    const newUser: User = { id: `new-user-${Date.now()}`, name, email, role: 'client' };
    (users as User[]).push(newUser); // Not persistent across reloads, but fine for demo session
    updateUserState(newUser);
    return newUser;
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, signup, isAuthenticated }}>
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

// A client component to protect routes
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
  // You can return a loader here while checking auth state
  return null;
}

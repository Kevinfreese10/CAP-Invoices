
'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';

// Mock users for demonstration
export const users: User[] = [
  { id: '1', name: 'John Doe', email: 'client@test.com', role: 'client' },
  { 
    id: '2', 
    name: 'Jane Admin', 
    email: 'admin@test.com', 
    role: 'admin',
    smtpDetails: {
        host: 'mail.myacc.co.za',
        port: '465',
        user: 'no_reply@myacc.co.za',
        pass: 'Thinkestry10$',
    }
  },
  { id: '3', name: 'Staff Member', email: 'staff@test.com', role: 'staff', department: 'Accounting and Tax' },
  { 
    id: '4', 
    name: 'Reseller Pro', 
    email: 'reseller@test.com', 
    role: 'reseller',
    companyName: 'Reseller Pro (Pty) Ltd',
    contactPerson: 'Alex King',
    contactNumber: '0721234567',
    address: {
        street: '123 Reseller Road',
        city: 'Johannesburg',
        province: 'Gauteng',
        zip: '2196',
    },
    bankingDetails: {
        bankName: 'Capitec',
        accountHolder: 'Reseller Pro (Pty) Ltd',
        accountNumber: '1234567890',
        branchCode: '470010',
    },
    smtpDetails: {
        host: 'mail.thinkestry.co.za',
        port: '465',
        user: 'no-reply@thinkestry.co.za',
        pass: 'Thinkestry10$',
    }
  },
];

interface AuthContextType {
  user: User | null;
  login: (email: string) => User | undefined;
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

  const login = (email: string) => {
    const foundUser = users.find(u => u.email === email);
    if (foundUser) {
      updateUserState(foundUser);
      return foundUser;
    }
    // For this demo, non-staff/admin emails will create/login as a client
    const newUser: User = { id: Date.now().toString(), name: 'New Client', email, role: 'client'};
    updateUserState(newUser);
    return newUser;
  };

  const logout = () => {
    updateUserState(null);
  };

  const signup = (name: string, email: string) => {
    // In a real app, this would create a new user in the DB.
    const newUser: User = { id: Date.now().toString(), name, email, role: 'client' };
    users.push(newUser); // Not persistent across reloads, but fine for demo session
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

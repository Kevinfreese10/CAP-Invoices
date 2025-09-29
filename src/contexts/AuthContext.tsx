

'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { users } from '@/lib/data';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => User | undefined;
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
        // Ensure we don't log in 'client' roles
        if (parsedUser.role !== 'client') {
            setUser(parsedUser);
            setIsAuthenticated(true);
        } else {
             setIsAuthenticated(false);
             localStorage.removeItem('my-accountant-user');
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Could not parse user from localStorage", error);
      setIsAuthenticated(false);
    }
  }, []);
  
  const updateUserState = (user: User | null) => {
    // Do not set user state for 'client' role
    if (user && user.role === 'client') {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('my-accountant-user');
        return;
    }
    
    setUser(user);
    setIsAuthenticated(!!user);
     if (user) {
      localStorage.setItem('my-accountant-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('my-accountant-user');
    }
  }

  const login = (email: string, password?: string) => {
    const foundUser = users.find(u => u.email === email);
    
    // For staff/admin/reseller login, password is required
    if (foundUser && foundUser.role !== 'client') {
        if (password && foundUser.password === password) {
            if (user?.id !== foundUser.id) {
                updateUserState(foundUser);
            }
            return foundUser;
        }
        return undefined; // Invalid password
    }

    // For other cases or if user not found with password
    if (foundUser && !password && foundUser.role !== 'client') {
        // This keeps the previous functionality for things that might still call login without a password
        if (user?.id !== foundUser.id) {
            updateUserState(foundUser);
        }
        return foundUser;
    }

    return undefined;
  };

  const logout = () => {
    updateUserState(null);
  };

  const signup = (name: string, email: string) => {
    const newUser: User = { id: `new-user-${Date.now()}`, name, email, role: 'client' };
    (users as User[]).push(newUser);
    // We don't log in the new client, just create their record.
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


'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardWelcome from "@/components/dashboard/DashboardWelcome";
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'staff')) {
      router.replace('/admin/dashboard');
    }
  }, [user, router]);
  
  if (user?.role === 'admin' || user?.role === 'staff') {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (user?.role === 'client') {
    return <DashboardWelcome />;
  }

  return null;
}

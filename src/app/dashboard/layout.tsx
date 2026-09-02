
'use client';

import { ReactNode, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

import MobileHeader from '@/components/layout/MobileHeader';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isAuthenticated && user?.role !== 'client' && user?.role !== 'ai_accountant') {
      // Redirect non-clients away from this dashboard
      if (user?.role === 'admin' || user?.role === 'staff') {
        router.push('/admin/dashboard');
      } else if (user?.role === 'reseller') {
        router.push('/reseller/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated === undefined || (isAuthenticated && user?.role !== 'client' && user?.role !== 'ai_accountant')) {
     return (
        <div className="flex min-h-screen">
            <Skeleton className="hidden md:block w-16 lg:w-64" />
            <div className="flex-1 p-3 sm:p-6 lg:p-8 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
      </div>
     );
  }

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen bg-background w-full">
          {user && (
            <Sidebar collapsible="icon" className="border-r">
              <DashboardNav user={user} />
            </Sidebar>
          )}
          <SidebarInset className="flex-1 min-w-0">
            <MobileHeader title="Client Dashboard" />
            <div className="p-3 sm:p-6 lg:p-8 max-w-full overflow-x-hidden pb-safe">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

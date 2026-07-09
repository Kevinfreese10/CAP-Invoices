
'use client';

import { ReactNode, useEffect } from 'react';
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  
  const hasAdminRole = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'cap_staff' || user?.role === 'cap_supervisor';
  const isMeinieAllowed = user?.email === 'meinie@carteblanche.co.za' && pathname === '/admin/cap-suppliers/private-payments';

  useEffect(() => {
    if (isAuthenticated && !hasAdminRole && !isMeinieAllowed) {
      router.push('/login');
    }
  }, [isAuthenticated, hasAdminRole, isMeinieAllowed, router]);
  
  if (isAuthenticated === undefined || (isAuthenticated && !hasAdminRole && !isMeinieAllowed)) {
     return (
        <div className="flex min-h-screen">
            <Skeleton className="hidden md:block w-16 lg:w-64" />
            <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
      </div>
     );
  }

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen bg-white">
          {user && (
            <Sidebar collapsible="icon" className="border-r">
              <DashboardNav user={user} />
            </Sidebar>
          )}
          <SidebarInset>
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-4 mb-4">
                    <SidebarTrigger className="md:hidden" />
                </div>
                {children}
              </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (isAuthenticated === undefined) {
    // While checking auth state, we can return null or a loader
    // to prevent server-client mismatch.
    return null;
  }

  const isDashboardPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/reseller');

  const shouldShowHeaderFooter = !(isDashboardPage);

  return (
    <div className="flex min-h-screen flex-col">
      {shouldShowHeaderFooter && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {shouldShowHeaderFooter && <Footer />}
    </div>
  );
}

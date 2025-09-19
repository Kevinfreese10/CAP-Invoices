'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isDashboardPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/reseller');
  
  const isNonClientUser = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'reseller';

  const shouldHideHeaderFooter = isDashboardPage && isNonClientUser;

  return (
    <div className="flex min-h-screen flex-col">
      {!shouldHideHeaderFooter && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {!shouldHideHeaderFooter && <Footer />}
    </div>
  );
}

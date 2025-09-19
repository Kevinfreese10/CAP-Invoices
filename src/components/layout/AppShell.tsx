'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isNonClientSection = user?.role === 'admin' || user?.role === 'staff';

  return (
    <div className="flex min-h-screen flex-col">
      {!isNonClientSection && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {!isNonClientSection && <Footer />}
    </div>
  );
}

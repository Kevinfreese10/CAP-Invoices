'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isAdminSection = user?.role === 'admin';

  return (
    <div className="flex min-h-screen flex-col">
      {!isAdminSection && <Header />}
      <main className="flex-grow bg-background">{children}</main>
      {!isAdminSection && <Footer />}
    </div>
  );
}

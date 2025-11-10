
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isDashboardPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/reseller');

  const shouldShowHeaderFooter = !isDashboardPage;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-grow bg-background">{children}</main>
    </div>
  );
}

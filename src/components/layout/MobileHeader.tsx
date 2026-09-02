'use client';

import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { User as UserIcon } from 'lucide-react';
import Link from 'next/link';

export default function MobileHeader({ title }: { title?: string }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex md:hidden items-center justify-between h-14 px-3 sm:px-4 bg-background/95 backdrop-blur-md border-b border-border shadow-2xs pt-safe">
      <div className="flex items-center gap-2 sm:gap-3">
        <SidebarTrigger className="h-10 w-10 p-2 touch-manipulation hover:bg-muted rounded-md focus-visible:ring-2 flex items-center justify-center" />
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight text-foreground truncate max-w-[160px] sm:max-w-none">
            {title || 'My Accountant'}
          </span>
        </Link>
      </div>

      {user && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] capitalize py-0.5 px-2 bg-muted/40 font-normal hidden sm:inline-flex">
            {user.role.replace('_', ' ')}
          </Badge>
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20">
            {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
          </div>
        </div>
      )}
    </header>
  );
}

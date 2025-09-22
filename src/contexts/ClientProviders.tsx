'use client';

import { CartProvider } from '@/contexts/CartContext';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';
import { BlogProvider } from './BlogContext';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <BlogProvider>
      <CartProvider>
        {children}
        <Toaster />
      </CartProvider>
    </BlogProvider>
  );
}

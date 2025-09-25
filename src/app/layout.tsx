import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'My Accountant',
  description: 'Professional Accounting & Tax Services for South Africa.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={cn("antialiased", bodyFont.variable, headlineFont.variable)}>
        <AuthProvider>
            <ClientProviders>
                <AppShell>
                {children}
                </AppShell>
            </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}

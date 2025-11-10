
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.myacc.co.za'),
  title: {
    default: 'My Accountant | Professional Accounting & Tax Services',
    template: '%s | My Accountant',
  },
  description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("antialiased", bodyFont.variable, headlineFont.variable)}>
        <AuthProvider>
            <ClientProviders>
                <FirebaseErrorListener />
                <AppShell>
                {children}
                </AppShell>
            </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}

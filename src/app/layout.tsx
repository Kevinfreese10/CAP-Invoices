
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';


export const metadata: Metadata = {
  title: {
    default: 'My Accountant | Professional Accounting & Tax Services',
    template: '%s | My Accountant',
  },
  description: 'Professional Accounting & Tax Services for South Africa. We handle SARS, CIPC, and all your compliance needs so you can focus on your business.',
  openGraph: {
    title: 'My Accountant | Professional Accounting & Tax Services',
    description: 'Simplify your finances with our expert accounting and tax solutions.',
    url: 'https://www.myacc.co.za',
    siteName: 'My Accountant',
    images: [
      {
        url: 'https://storage.googleapis.com/aai-web-samples/my-accountant-logo.png',
        width: 512,
        height: 512,
      },
    ],
    locale: 'en_ZA',
    type: 'website',
  },
   twitter: {
    card: 'summary_large_image',
    title: 'My Accountant | Professional Accounting & Tax Services',
    description: 'Simplify your finances with our expert accounting and tax solutions.',
    images: ['https://storage.googleapis.com/aai-web-samples/my-accountant-logo.png'],
  },
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
                <FirebaseErrorListener />
                <AppShell>
                {children}
                </AppShell>
                <WebsiteAIWidget />
            </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}

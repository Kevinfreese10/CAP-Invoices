
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ClientProviders from '@/contexts/ClientProviders';
import { bodyFont, headlineFont } from '@/app/fonts';
import { cn } from '@/lib/utils';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import Script from 'next/script';


export const metadata: Metadata = {
  metadataBase: new URL('https://www.myacc.co.za'),
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
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-KBTZN40DGY"
        />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-KBTZN40DGY');
          `}
        </Script>
        <Script src="https://apis.google.com/js/platform.js?onload=renderOptIn" async defer></Script>
        <Script id="google-reviews-opt-in">
          {`
            window.renderOptIn = function(order) {
              if (!order || !order.order_id || !order.email || !order.estimated_delivery_date) {
                return;
              }
              window.gapi.load('surveyoptin', function() {
                window.gapi.surveyoptin.render(
                  {
                    "merchant_id": 5394656984,
                    "order_id": order.order_id,
                    "email": order.email,
                    "delivery_country": "ZA",
                    "estimated_delivery_date": order.estimated_delivery_date
                  });
              });
            }
          `}
        </Script>
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

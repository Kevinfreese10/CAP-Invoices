import { Poppins, PT_Sans } from 'next/font/google';

export const headlineFont = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-headline',
});

export const bodyFont = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
});


import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: true,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_PAYFAST_MERCHANT_ID: "23836312",
    NEXT_PUBLIC_PAYFAST_MERCHANT_KEY: "h4fkhz6ouoksx",
    PAYFAST_PASSPHRASE: process.env.PAYFAST_PASSPHRASE,
    NEXT_PUBLIC_PAYFAST_URL: "https://www.payfast.co.za/eng/process",
    NEXT_PUBLIC_APP_URL: "https://www.myacc.co.za",
  },
};

export default nextConfig;

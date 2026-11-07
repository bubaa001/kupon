import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { AppToaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Kupon | Cafeteria orders and payments',
    template: '%s • Kupon',
  },
  description:
    'Kupon records cafeteria orders, collects direct mobile-money payments and issues verified meal coupons for Tanzanian universities.',
  applicationName: 'Kupon',
  keywords: [
    'Tanzania',
    'university',
    'cafeteria',
    'mobile money',
    'M-Pesa',
    'cafeteria sales records',
    'Kupon',
  ],
  authors: [{ name: 'Bubaa Comp' }],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kupon',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Kupon | Cafeteria orders and payments',
    description:
      'Pay for cafeteria meals directly with mobile money. Coupons appear after payment confirmation, and sales are recorded.',
    type: 'website',
    locale: 'sw_TZ',
    siteName: 'Kupon',
    images: [
      {
        url: '/og-kupon.jpg',
        width: 1200,
        height: 630,
        alt: 'Kupon cafeteria orders, direct mobile-money checkout and verified meal coupons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kupon | Cafeteria orders and payments',
    description:
      'Direct mobile-money checkout and verified meal coupons for Tanzanian university cafeterias.',
    images: ['/og-kupon.jpg'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <body>
        {children}
        <AppToaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { AppToaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Kupon | Trusted cafeteria orders',
    template: '%s • Kupon',
  },
  description:
    'Kupon records cafeteria orders and issues verified meal coupons after payment confirmation. Payments in this test build are simulated; no real money is collected.',
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
    title: 'Kupon | Trusted cafeteria orders',
    description:
      'Kupon records orders and payment stages before issuing meal coupons. Payments in this test build are simulated; no real money is collected.',
    type: 'website',
    locale: 'sw_TZ',
    siteName: 'Kupon',
    images: [
      {
        url: '/og-kupon.jpg',
        width: 1200,
        height: 630,
        alt: 'Kupon cafeteria orders, test gateway payment tracking and verified meal coupons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kupon | Trusted cafeteria orders',
    description:
      'Trusted cafeteria orders and verified meal coupons. Test gateway payments are simulated.',
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

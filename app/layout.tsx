import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { AppToaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Kupon — Digital campus wallet & cafeteria payments',
    template: '%s • Kupon',
  },
  description:
    'Kupon replaces paper coupons and ledgers in Tanzanian universities with a digital wallet, QR cafeteria payments and live profit intelligence.',
  applicationName: 'Kupon',
  keywords: [
    'Tanzania',
    'university',
    'cafeteria',
    'digital wallet',
    'mobile money',
    'M-Pesa',
    'campus payments',
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
    title: 'Kupon — Campus wallet, simplified',
    description:
      'Top up with mobile money, pay any campus cafeteria by QR, and give administrators real-time financial visibility.',
    type: 'website',
    locale: 'sw_TZ',
    siteName: 'Kupon',
    images: [
      {
        url: '/og-kupon.png',
        width: 1200,
        height: 630,
        alt: 'Kupon — digital campus wallet and QR cafeteria payments',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kupon — Campus wallet, simplified',
    description:
      'Mobile-money top-ups, 2-minute QR meal payments and live profit intelligence for Tanzanian universities.',
    images: ['/og-kupon.png'],
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

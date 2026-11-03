import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kupon — Campus Wallet',
    short_name: 'Kupon',
    description:
      'Digital campus wallet and QR cafeteria payments for Tanzanian universities. Top up with mobile money, pay vendors, track every shilling.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8FAFC',
    theme_color: '#10B981',
    lang: 'sw-TZ',
    categories: ['finance', 'food', 'education'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Pay with QR',
        short_name: 'Lipa',
        description: 'Open your 2-minute payment code',
        url: '/student/pay',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Top up wallet',
        short_name: 'Top up',
        description: 'Add money with mobile money',
        url: '/student/topup',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.NGROK_HOST
    ? { allowedDevOrigins: [process.env.NGROK_HOST] }
    : {}),
  experimental: {
    // Prisma's native engine must stay external to the server bundle.
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  // Retired wallet-era pages. Old bookmarks land on the page that replaced them.
  async redirects() {
    return [
      { source: '/student/topup', destination: '/student/pay', permanent: true },
      { source: '/student/withdrawals', destination: '/student/credit-requests', permanent: true },
      { source: '/student/refunds', destination: '/student/credit-requests', permanent: true },
      { source: '/admin/refunds', destination: '/admin', permanent: true },
      { source: '/admin/withdrawals', destination: '/admin', permanent: true },
      { source: '/admin/menu', destination: '/admin/vendors', permanent: true },
      { source: '/ussd', destination: '/student/pay', permanent: true },
    ];
  },
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          ...(process.env.VERCEL_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=15552000' }]
            : []),
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
    return headers;
  },
};

export default nextConfig;

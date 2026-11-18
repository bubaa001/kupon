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
    // Content-Security-Policy: a last line of defence against XSS. Scripts and
    // styles may only come from Kupon itself; images also from data:/blob:
    // (QR codes) and https (food photos). No external script origin can run,
    // and the page cannot be framed. 'unsafe-inline' stays because Next.js
    // injects inline bootstrap scripts without a nonce on static export.
    // Next.js dev (Fast Refresh) needs eval; production bundles never do.
    const scriptSrc =
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(process.env.VERCEL_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    ].join('; ');
    const headers = [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
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

import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/student',
          '/vendor',
          '/admin',
          '/super-admin',
          '/staff',
          '/signup',
          '/vendor-apply',
          '/vendor-pending',
          '/api',
          '/login',
          '/ussd',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

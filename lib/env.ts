import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  PAYMENT_PROVIDER: z.enum(['mock', 'selcom', 'azampay', 'ncard']).default('mock'),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(15).default(2.5),
  AGGREGATOR_FEE_PERCENT: z.coerce.number().min(0).max(15).default(1.5),
  UNIVERSITY_REVENUE_SHARE_PERCENT: z.coerce.number().min(0).max(100).default(20),
  MOCK_SETTLEMENT_DELAY_MS: z.coerce.number().min(0).max(60_000).default(2000),
  SMS_PROVIDER: z.enum(['mock']).default('mock'),
  USSD_SHORTCODE: z.string().default('*150*88#'),
  DEMO_MODE: booleanFromString,
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: optionalUrl,
  // Optional HTTPS callback for a public origin different from the canonical app URL.
  // Register this exact callback in Google Cloud Console when using it.
  GOOGLE_MOBILE_REDIRECT_URI: optionalUrl,
});

const parsed = EnvSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT,
  AGGREGATOR_FEE_PERCENT: process.env.AGGREGATOR_FEE_PERCENT,
  UNIVERSITY_REVENUE_SHARE_PERCENT: process.env.UNIVERSITY_REVENUE_SHARE_PERCENT,
  MOCK_SETTLEMENT_DELAY_MS: process.env.MOCK_SETTLEMENT_DELAY_MS,
  SMS_PROVIDER: process.env.SMS_PROVIDER,
  USSD_SHORTCODE: process.env.USSD_SHORTCODE,
  DEMO_MODE: process.env.DEMO_MODE,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_MOBILE_REDIRECT_URI: process.env.GOOGLE_MOBILE_REDIRECT_URI,
});

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
}

export const env = parsed.data;

if (env.JWT_SECRET === 'kupon-dev-only-secret-change-me-to-a-64-char-random-string') {
  console.warn('[kupon] Using the example JWT secret. Change it before deploying.');
}

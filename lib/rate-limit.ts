import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Shared fixed-window limiter. The database upsert is atomic, so every
 * serverless instance observes and increments the same bucket. Raw identifiers
 * (including phone numbers and IP addresses) are never persisted.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const bucketKey = createHmac('sha256', env.JWT_SECRET).update(key).digest('hex');
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${bucketKey}, 1, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN EXCLUDED."resetAt"
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;

  // Opportunistic bounded cleanup avoids requiring a separate cron job.
  if (Math.random() < 0.01) {
    await prisma.$executeRaw`
      DELETE FROM "RateLimitBucket"
      WHERE "resetAt" < NOW() - INTERVAL '1 day'
    `;
  }

  const bucket = rows[0];
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000)),
  };
}

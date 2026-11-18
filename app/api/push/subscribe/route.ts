import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(5).max(100),
  }),
});

/** POST: save this browser for order notifications. DELETE: stop them. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limit = await rateLimit(`push:subscribe:${user.id}`, 20, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many attempts. Try again later.');
    const body = await parseJson(request, subscriptionSchema);
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { userId: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
      update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });
    return ok({ subscribed: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const endpoint = new URL(request.url).searchParams.get('endpoint');
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    }
    return ok({ subscribed: false });
  } catch (error) {
    return fail(error);
  }
}

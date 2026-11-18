import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { tooManyRequests } from '@/lib/errors';
import { pushToUsers } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/test — sends a test notification to every device of the
 * signed-in person and reports what the push service said, so a cafeteria or
 * buyer can confirm alerts reach their phone with Kupon closed.
 */
export async function POST() {
  try {
    const user = await requireApiUser();
    const limit = await rateLimit(`push:test:${user.id}`, 6, 10 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many test alerts. Try again in a few minutes.');
    const counter = user.role === 'STAFF' || user.role === 'VENDOR' || user.role === 'FINANCE';
    const result = await pushToUsers([user.id], {
      title: 'Kupon test alert',
      body: counter
        ? 'New orders will arrive like this, even with Kupon closed.'
        : 'Order updates will arrive like this, even with Kupon closed.',
      url: '/',
      tag: 'kupon-test',
      audience: counter ? 'counter' : 'buyer',
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { tooManyRequests } from '@/lib/errors';
import { advanceKuponTestPayment } from '@/lib/payments/kupon-test-api';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const transitionSchema = z.object({
  stage: z.enum(['RECEIVED', 'CONFIRMED', 'FAILED', 'EXPIRED']),
  note: z.string().trim().max(250).optional(),
});

export async function POST(request: Request, { params }: { params: { reference: string } }) {
  try {
    const user = await requireApiUser(['FINANCE']);
    const limit = rateLimit(`finance:test-payment:${user.id}`, 60, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many test-payment actions. Try again shortly.');
    const body = await parseJson(request, transitionSchema);
    const result = await advanceKuponTestPayment({
      reference: params.reference,
      stage: body.stage,
      actorId: user.id,
      note: body.note,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

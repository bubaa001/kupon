import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { forbidden, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { cancelStudentOrder } from '@/lib/orders/cancel';
import { ORDER_CANCEL_REASONS } from '@/lib/orders/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cancelOrderSchema = z
  .object({
    reason: z.enum(ORDER_CANCEL_REASONS, {
      errorMap: () => ({ message: 'Choose a valid cancellation reason.' }),
    }),
    note: z
      .string()
      .trim()
      .max(200, 'The note can be at most 200 characters')
      .optional()
      .default(''),
  })
  .refine((value) => value.reason !== 'OTHER' || value.note.length >= 3, {
    message: 'Tell us why you are cancelling (at least 3 characters).',
    path: ['note'],
  });

/**
 * POST /api/student/orders/[id]/cancel
 *
 * A student cancels their own PENDING coupon before the vendor verifies it.
 * Reverses the wallet debit, the vendor pending credit and the fee journal in
 * one atomic claim, then writes a `CANCELLED_BY_STUDENT` audit entry.
 *
 * Idempotent by design: replaying the request returns the already-cancelled
 * order with `refunded: false` and never moves money twice. Verified coupons
 * cannot be cancelled.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    if (!user.universityId) throw forbidden('Your wallet is not linked to a university.');

    const limit = rateLimit(`student:cancel-order:${student.id}`, 10, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many cancellation attempts. Wait a minute and try again.');
    }

    const body = await parseJson(request, cancelOrderSchema);
    const result = await cancelStudentOrder({
      studentProfileId: student.id,
      universityId: user.universityId,
      actorId: user.id,
      orderId: params.id,
      reason: body.reason,
      note: body.note,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

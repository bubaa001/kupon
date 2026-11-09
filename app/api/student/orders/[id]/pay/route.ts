import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { processKuponTestGatewayPayments } from '@/lib/payments/kupon-test-gateway';
import { payApprovedOrder } from '@/lib/orders/pay-order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paySchema = z.object({ useCredit: z.boolean().optional() }).strict();

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    const limit = rateLimit(`student:pay-order:${student.id}`, 8, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many payment attempts. Wait a minute and try again.');
    const body = await parseJson(request, paySchema);
    const result = await payApprovedOrder({
      orderId: params.id,
      studentProfileId: student.id,
      actorId: user.id,
      useCredit: body.useCredit,
    });
    await processKuponTestGatewayPayments({ studentId: student.id });
    return ok(result, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

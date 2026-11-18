import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { forbidden, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { recordTestSettlement } from '@/lib/settlements/record-test-settlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const withdrawalSchema = z.object({
  amount: z.number().int().min(1).max(5_000_000),
  reason: z.string().trim().min(5).max(500),
}).strict();

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['FINANCE']);
    if (!user.managedVendor || !user.universityId) {
      throw forbidden('Emergency withdrawals require a Finance account assigned to one cafeteria.');
    }
    const limit = await rateLimit(`finance:emergency-withdrawal:${user.id}`, 3, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many emergency withdrawals. Try again later.');
    const body = await parseJson(request, withdrawalSchema);
    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emergencyWithdrawalLimit: true },
    });
    const authorizedLimit = account?.emergencyWithdrawalLimit ?? 0;
    if (authorizedLimit <= 0) {
      throw forbidden('The cafeteria owner has not allowed you to withdraw yet.');
    }
    const result = await recordTestSettlement({
      actorId: user.id,
      vendorId: user.managedVendor.id,
      universityId: user.universityId,
      amount: body.amount,
      emergencyReason: body.reason,
      emergencyLimit: authorizedLimit,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

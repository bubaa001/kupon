import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireManagedVendor } from '@/lib/auth';
import { notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const autoAcceptSchema = z.object({ enabled: z.boolean() }).strict();

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const limit = rateLimit(`staff:auto-accept:${vendor.id}`, 20, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many order settings changes. Try again shortly.');
    const body = await parseJson(request, autoAcceptSchema);
    const universityId = user.universityId;
    if (!universityId) throw notFound('Your cafeteria is not linked to a university.');

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.menuItem.updateMany({
        where: { vendorId: vendor.id },
        data: { autoAccept: body.enabled },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'STAFF_ORDER_AUTO_ACCEPT_BULK_UPDATED',
          entity: 'Vendor',
          entityId: vendor.id,
          metadata: { enabled: body.enabled, affectedItems: updated.count },
        },
        tx,
      );
      return updated.count;
    });

    return ok({ enabled: body.enabled, updated: result });
  } catch (error) {
    return fail(error);
  }
}

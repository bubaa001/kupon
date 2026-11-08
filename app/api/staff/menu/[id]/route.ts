import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireManagedVendor } from '@/lib/auth';
import { notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const availabilitySchema = z.object({ available: z.boolean() }).strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const limit = rateLimit(`staff:menu-availability:${vendor.id}`, 60, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many menu changes. Wait a minute and try again.');

    const body = await parseJson(request, availabilitySchema);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, vendorId: vendor.id },
      select: { id: true, universityId: true, name: true },
    });
    if (!item) throw notFound('This menu item does not belong to your cafeteria.');

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.menuItem.update({
        where: { id: item.id },
        data: { available: body.available },
        select: { id: true, name: true, available: true },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: item.universityId,
          action: 'STAFF_MENU_AVAILABILITY_UPDATED',
          entity: 'MenuItem',
          entityId: item.id,
          metadata: { available: saved.available, vendorId: vendor.id },
        },
        tx,
      );
      return saved;
    });

    return ok({ item: updated });
  } catch (error) {
    return fail(error);
  }
}

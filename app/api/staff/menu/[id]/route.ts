import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireManagedVendor } from '@/lib/auth';
import { notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const staffMenuPatchSchema = z
  .object({ available: z.boolean().optional(), autoAccept: z.boolean().optional() })
  .strict()
  .refine((value) => value.available !== undefined || value.autoAccept !== undefined);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const limit = rateLimit(`staff:menu-availability:${vendor.id}`, 60, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many menu changes. Wait a minute and try again.');

    const body = await parseJson(request, staffMenuPatchSchema);
    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, vendorId: vendor.id },
      select: { id: true, universityId: true, name: true },
    });
    if (!item) throw notFound('This menu item does not belong to your cafeteria.');

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.menuItem.update({
        where: { id: item.id },
        data: body,
        select: {
          id: true,
          name: true,
          category: true,
          emoji: true,
          price: true,
          available: true,
          autoAccept: true,
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: item.universityId,
          action: body.available !== undefined
            ? 'STAFF_MENU_AVAILABILITY_UPDATED'
            : 'STAFF_ORDER_AUTO_ACCEPT_UPDATED',
          entity: 'MenuItem',
          entityId: item.id,
          metadata: { ...body, vendorId: vendor.id },
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const limit = rateLimit(`staff:menu-availability:${vendor.id}`, 60, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many menu changes. Wait a minute and try again.');

    const item = await prisma.menuItem.findFirst({
      where: { id: params.id, vendorId: vendor.id },
      select: { id: true, universityId: true, name: true, price: true },
    });
    if (!item) throw notFound('This menu item does not belong to your cafeteria.');

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.delete({ where: { id: item.id } });
      await auditLog(
        {
          actorId: user.id,
          universityId: item.universityId,
          action: 'STAFF_MENU_ITEM_DELETED',
          entity: 'MenuItem',
          entityId: item.id,
          metadata: { name: item.name, price: item.price, vendorId: vendor.id },
        },
        tx,
      );
    });

    return ok({ deleted: true as const });
  } catch (error) {
    return fail(error);
  }
}

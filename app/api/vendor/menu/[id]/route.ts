import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { badRequest, notFound } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { menuPatchSchema } from '@/lib/validators';
import { requireVendorAccess } from '../../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/vendor/menu/[id]
 *
 * Vendors can edit only their own items. Foods are vendor-owned and go live
 * immediately; `approvalStatus` in the request body is ignored so a vendor can
 * never spoof a status transition, but the university admin no longer reviews
 * individual dishes (it vets the vendor itself).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();

    const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
    if (!item || item.vendorId !== vendor.id) {
      throw notFound('This menu item does not belong to your kitchen.');
    }

    const body = await parseJson(request, menuPatchSchema);
    const { approvalStatus: _ignored, ...rest } = body;
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updates).length === 0) {
      throw badRequest('Change at least one item detail before saving.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.menuItem.update({
        where: { id: item.id },
        data: {
          ...(updates as Prisma.MenuItemUpdateInput),
          approvalStatus: 'APPROVED',
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_MENU_ITEM_UPDATED',
          entity: 'MenuItem',
          entityId: item.id,
          metadata: { name: saved.name, changed: Object.keys(updates), vendorCode: vendor.code },
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

/**
 * DELETE /api/vendor/menu/[id]
 * Permanently removes one of the vendor's own menu items.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();

    const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
    if (!item || item.vendorId !== vendor.id) {
      throw notFound('This menu item does not belong to your kitchen.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.delete({ where: { id: item.id } });

      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_MENU_ITEM_DELETED',
          entity: 'MenuItem',
          entityId: item.id,
          metadata: { name: item.name, price: item.price, vendorCode: vendor.code },
        },
        tx,
      );
    });

    return ok({ deleted: true as const });
  } catch (error) {
    return fail(error);
  }
}

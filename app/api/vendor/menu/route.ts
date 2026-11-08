import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { menuItemSchema } from '@/lib/validators';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/menu
 * The vendor's own menu, plus counters the menu screen shows as filter chips.
 */
export async function GET() {
  try {
    const { vendor } = await requireVendorAccess();

    const items = await prisma.menuItem.findMany({
      where: { vendorId: vendor.id },
      orderBy: [{ available: 'desc' }, { createdAt: 'desc' }],
    });

    return ok({
      items,
      summary: {
        total: items.length,
        available: items.filter((item) => item.available).length,
        hidden: items.filter((item) => !item.available).length,
        // Foods are vendor-owned; university admins approve vendors, not dishes.
        pendingApproval: 0,
        rejected: 0,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/vendor/menu
 * Food is owned by the vendor. New dishes go live immediately; the university
 * admin controls the vendor account (onboarding, suspension), not each dish.
 */
export async function POST(request: Request) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();

    const body = await parseJson(request, menuItemSchema);

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          vendorId: vendor.id,
          universityId,
          name: body.name,
          price: body.price,
          category: body.category,
          description: body.description,
          imageUrl: body.imageUrl,
          available: body.available,
          autoAccept: body.autoAccept,
          approvalStatus: 'APPROVED',
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_MENU_ITEM_CREATED',
          entity: 'MenuItem',
          entityId: created.id,
          metadata: { name: created.name, price: created.price, vendorCode: vendor.code },
        },
        tx,
      );

      return created;
    });

    return ok({ item }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

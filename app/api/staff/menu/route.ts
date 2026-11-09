import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireManagedVendor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { forbidden, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { staffMenuItemSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const items = await prisma.menuItem.findMany({
      where: { vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        category: true,
        emoji: true,
        price: true,
        available: true,
        autoAccept: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const universityId = vendor.universityId;
    if (!user.universityId || user.universityId !== universityId) {
      throw forbidden('Staff account is not linked to this cafeteria’s university.');
    }

    const limit = rateLimit(`staff:menu-create:${vendor.id}`, 20, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many menu changes. Wait a minute and try again.');
    }

    const body = await parseJson(request, staffMenuItemSchema);
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          vendorId: vendor.id,
          universityId,
          name: body.name,
          price: body.price,
          category: body.category,
          description: body.description,
          emoji: body.emoji,
          available: true,
          autoAccept: false,
          approvalStatus: 'APPROVED',
        },
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
          universityId,
          action: 'STAFF_MENU_ITEM_CREATED',
          entity: 'MenuItem',
          entityId: created.id,
          metadata: { name: created.name, price: created.price, vendorId: vendor.id },
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

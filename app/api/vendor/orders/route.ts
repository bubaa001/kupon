import { startOfDay } from 'date-fns';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, searchParams } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { orderInclude, serializeVendorOrder } from '@/lib/orders/serialize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['AWAITING_ACCEPTANCE', 'PENDING', 'VERIFIED', 'ALL']).default('ALL'),
});

/**
 * GET /api/vendor/orders
 * The vendor order desk. Incoming orders and verified coupons are scoped to the
 * signed-in vendor; no cross-tenant order can ever be read here.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');

    const params = searchParams(request);
    const query = querySchema.parse({
      status: params.get('status')?.toUpperCase() ?? undefined,
    });

    const where = {
      vendorId: vendor.id,
      universityId: user.universityId,
      ...(query.status !== 'ALL'
        ? {
            status: query.status,
            ...(query.status === 'PENDING' ? { expiresAt: { gt: new Date() } } : {}),
          }
        : {}),
    };

    const [orders, pending, awaitingAcceptance, verified, today] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.order.count({
        where: {
          vendorId: vendor.id,
          universityId: user.universityId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.order.count({
        where: {
          vendorId: vendor.id,
          universityId: user.universityId,
          status: 'AWAITING_ACCEPTANCE',
        },
      }),
      prisma.order.count({ where: { vendorId: vendor.id, universityId: user.universityId, status: 'VERIFIED' } }),
      prisma.order.count({
        where: {
          vendorId: vendor.id,
          universityId: user.universityId,
          createdAt: { gte: startOfDay(new Date()) },
        },
      }),
    ]);

    return ok({
      orders: orders.map(serializeVendorOrder),
      counts: { awaitingAcceptance, pending, verified, today },
    });
  } catch (error) {
    return fail(error);
  }
}

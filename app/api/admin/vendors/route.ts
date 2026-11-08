import { startOfDay } from 'date-fns';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { forbidden } from '@/lib/errors';
import { resolveTenantScope, tenantWhere } from '@/lib/tenant';
import { parseQuery, requireAdmin } from '../_lib/scope';
import { serializeVendor } from '../_lib/serializers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const vendorQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  universityId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, vendorQuerySchema);
    const scope = resolveTenantScope(user, query.universityId);
    const where: Prisma.VendorWhereInput = {
      ...tenantWhere(user, query.universityId),
    };
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { code: { contains: query.q } },
        { user: { is: { name: { contains: query.q } } } },
      ];
    }

    const todayStart = startOfDay(new Date());
    const scopeWhere = tenantWhere(user, query.universityId);

    const [vendors, salesToday, university] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              phone: true,
              vendorApplication: { select: { phone: true } },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      prisma.transaction.groupBy({
        by: ['vendorId'],
        where: {
          ...scopeWhere,
          type: 'PAYMENT',
          status: 'SETTLED',
          isTest: false,
          createdAt: { gte: todayStart },
          vendorId: { not: null },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      scope
        ? prisma.university.findUnique({
            where: { id: scope },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
    ]);

    const salesByVendor = new Map(
      salesToday.map((row) => [
        row.vendorId ?? '',
        { salesToday: row._sum.amount ?? 0, transactionsToday: row._count._all },
      ]),
    );

    const rows = vendors.map((vendor) => {
      const ownerPhone = vendor.user.phone ?? vendor.user.vendorApplication?.phone;
      if (!ownerPhone) throw new Error('A vendor account is missing its required contact phone number.');
      return serializeVendor(
        { ...vendor, user: { ...vendor.user, phone: ownerPhone } },
        salesByVendor.get(vendor.id) ?? { salesToday: 0, transactionsToday: 0 },
      );
    });

    return ok({
      university,
      vendors: rows,
      summary: {
        total: rows.length,
        pending: rows.filter((vendor) => vendor.status === 'PENDING').length,
        active: rows.filter((vendor) => vendor.status === 'ACTIVE').length,
        suspended: rows.filter((vendor) => vendor.status === 'SUSPENDED').length,
        salesToday: rows.reduce((sum, vendor) => sum + vendor.salesToday, 0),
        pendingSettlement: rows.reduce((sum, vendor) => sum + vendor.pendingBalance, 0),
        transactionsToday: rows.reduce((sum, vendor) => sum + vendor.transactionsToday, 0),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    await requireAdmin();
    throw forbidden(
      'Cafeteria owners must apply with Google and be approved by a platform admin.',
    );
  } catch (error) {
    return fail(error);
  }
}

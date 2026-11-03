import bcrypt from 'bcryptjs';
import { startOfDay } from 'date-fns';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { vendorSchema } from '@/lib/validators';
import { resolveTenantScope, tenantWhere } from '@/lib/tenant';
import { parseQuery, requireAdmin, requireUniversityId } from '../_lib/scope';
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
        include: { user: { select: { name: true, phone: true } } },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      prisma.transaction.groupBy({
        by: ['vendorId'],
        where: {
          ...scopeWhere,
          type: 'PAYMENT',
          status: 'SETTLED',
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

    const rows = vendors.map((vendor) =>
      serializeVendor(
        vendor,
        salesByVendor.get(vendor.id) ?? { salesToday: 0, transactionsToday: 0 },
      ),
    );

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

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, vendorSchema);
    const universityId = requireUniversityId(user, request);

    const university = await prisma.university.findUnique({
      where: { id: universityId },
      select: { id: true, code: true, name: true },
    });
    if (!university) throw notFound('University not found.');

    const expectedPrefix = `V-${university.code}-`;
    if (!body.code.startsWith(expectedPrefix)) {
      throw badRequest(
        `Vendor codes for ${university.code} start with ${expectedPrefix}, e.g. ${expectedPrefix}004.`,
      );
    }

    const [existingCode, existingPhone] = await Promise.all([
      prisma.vendor.findUnique({ where: { code: body.code }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: body.phone }, select: { id: true } }),
    ]);
    if (existingCode) throw conflict(`Vendor code ${body.code} is already registered.`);
    if (existingPhone) {
      throw conflict('That phone number is already linked to a Kupon account.');
    }

    const pinHash = await bcrypt.hash(body.pin, 10);

    const vendorId = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name: body.ownerName,
          phone: body.phone,
          role: 'VENDOR',
          universityId,
        },
      });
      const vendor = await tx.vendor.create({
        data: {
          userId: owner.id,
          universityId,
          name: body.name,
          code: body.code,
          pin: pinHash,
          description: body.description,
          settlementAccount: body.settlementAccount,
        },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_CREATED',
          entity: 'Vendor',
          entityId: vendor.id,
          metadata: {
            code: vendor.code,
            name: vendor.name,
            ownerName: body.ownerName,
            phone: body.phone,
          },
        },
        tx,
      );
      return vendor.id;
    });

    const created = await prisma.vendor.findUniqueOrThrow({
      where: { id: vendorId },
      include: { user: { select: { name: true, phone: true } } },
    });

    return ok(
      {
        vendor: serializeVendor(created, { salesToday: 0, transactionsToday: 0 }),
        message: `${created.name} can now sign in with code ${created.code}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(error);
  }
}

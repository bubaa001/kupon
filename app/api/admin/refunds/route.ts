import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { tenantWhere } from '@/lib/tenant';
import {
  adminMoneyRequestInclude,
  serializeAdminMoneyRequest,
  summarizeRequestGroups,
} from '@/lib/payments/money-requests';
import type { MoneyRequestListData } from '@/lib/payments/money-request-types';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const refundsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  universityId: z.string().min(1).optional(),
  /** Dashboard health cards only need the counts; skip the row payload. */
  summaryOnly: z.enum(['1', 'true']).optional(),
});

/**
 * GET /api/admin/refunds
 *
 * The ORDER-REFUND queue. Strictly `kind = REFUND`: withdrawals never appear here
 * and the summary counts are refund-only. Each row carries the reversed order and
 * its original payment reference so an admin can see exactly what is being undone.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, refundsQuerySchema);
    const tenant = tenantWhere(user, query.universityId);

    const where: Prisma.RefundRequestWhereInput = { ...tenant, kind: 'REFUND' };
    if (query.status) where.status = query.status;
    const summaryOnly = Boolean(query.summaryOnly);

    const [requests, grouped] = await Promise.all([
      summaryOnly
        ? Promise.resolve([])
        : prisma.refundRequest.findMany({
            where,
            include: adminMoneyRequestInclude,
            orderBy: { createdAt: 'desc' },
            take: 200,
          }),
      prisma.refundRequest.groupBy({
        by: ['status'],
        where: { ...tenant, kind: 'REFUND' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const rows = requests
      .map(serializeAdminMoneyRequest)
      .sort((a, b) =>
        a.status === 'PENDING' && b.status !== 'PENDING'
          ? -1
          : b.status === 'PENDING' && a.status !== 'PENDING'
            ? 1
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const data: MoneyRequestListData = {
      requests: rows,
      summary: summarizeRequestGroups(grouped),
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

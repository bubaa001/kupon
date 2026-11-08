import { subDays, startOfDay } from 'date-fns';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, searchParams } from '@/lib/api';
import { TX_STATUSES, TX_TYPES } from '@/lib/constants';
import type { TransactionsData } from '@/app/student/_lib/types';
import { processKuponTestGatewayPayments } from '@/lib/payments/kupon-test-gateway';
import { getStudentContext, serializeTransaction } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  range: z.enum(['today', 'week', 'month']).default('month'),
  type: z.enum(TX_TYPES).optional(),
  status: z.enum(TX_STATUSES).optional(),
});

function rangeStart(range: 'today' | 'week' | 'month', now: Date): Date {
  if (range === 'today') return startOfDay(now);
  // Demo-friendly rolling windows: the seeded history lives inside 14 days.
  if (range === 'week') return startOfDay(subDays(now, 6));
  return startOfDay(subDays(now, 29));
}

/**
 * GET /api/student/transactions?range=&type=&status=
 *
 * Returns up to 100 transactions for the signed-in student, plus totals and
 * status counts so the history screen can render real numbers without a second
 * round trip.
 */
export async function GET(request: Request) {
  try {
    const { user, student } = await getStudentContext();
    await processKuponTestGatewayPayments({ studentId: student.id });
    const params = searchParams(request);
    const rawType = params.get('type');
    const rawStatus = params.get('status');

    const query = querySchema.parse({
      range: params.get('range') ?? 'month',
      type: rawType ? rawType : undefined,
      status: rawStatus ? rawStatus : undefined,
    });

    const start = rangeStart(query.range, new Date());
    const baseWhere = {
      studentId: student.id,
      createdAt: { gte: start },
      NOT: {
        isTest: true,
        type: 'PAYMENT',
        paymentEvents: { some: { stage: 'EXPIRED' } },
      },
      ...(query.type ? { type: query.type } : {}),
    };

    const [rows, statusGroups, settledByType] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          ...baseWhere,
          ...(query.status ? { status: query.status } : {}),
        },
        include: { vendor: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.transaction.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { ...baseWhere, status: 'SETTLED' },
        _sum: { amount: true },
      }),
    ]);

    const counts = { total: 0, settled: 0, pending: 0, failed: 0 };
    for (const group of statusGroups) {
      const count = group._count._all;
      counts.total += count;
      if (group.status === 'SETTLED') counts.settled = count;
      if (group.status === 'PENDING') counts.pending = count;
      if (group.status === 'FAILED') counts.failed = count;
    }

    let totalIn = 0;
    let totalOut = 0;
    for (const group of settledByType) {
      const sum = group._sum.amount ?? 0;
      if (group.type === 'TOPUP' || group.type === 'ADJUSTMENT_CREDIT') {
        totalIn += sum;
      } else {
        totalOut += sum;
      }
    }

    const data: TransactionsData = {
      transactions: rows.map(serializeTransaction),
      counts,
      totalIn,
      totalOut,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

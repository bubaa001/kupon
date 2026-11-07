import { format } from 'date-fns';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { resolveTenantScope } from '@/lib/tenant';
import { dayKey, dayLabel, getLastNDays, getRange, type RangeKey } from '@/lib/dates';
import { reportQuerySchema } from '@/lib/validators';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reportsQuerySchema = reportQuerySchema.extend({
  universityId: z.string().min(1).optional(),
});

type DailyBucket = {
  date: string;
  label: string;
  revenue: number;
  transactions: number;
  profit: number;
};

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, reportsQuerySchema);
    const scope = resolveTenantScope(user, query.universityId);
    const tenant = scope ? { universityId: scope } : {};
    const range = getRange(query.range as RangeKey);
    const dateFilter = { gte: range.start, lte: range.end };

    const [payments, failed, pending, refundGroups] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...tenant, type: 'PAYMENT', status: 'SETTLED', isTest: false, createdAt: dateFilter },
        select: {
          amount: true,
          platformFee: true,
          aggregatorFee: true,
          universityRevenue: true,
          vendorSettlement: true,
          vendorId: true,
          createdAt: true,
        },
      }),
      prisma.transaction.aggregate({
        where: { ...tenant, type: 'PAYMENT', status: 'FAILED', isTest: false, createdAt: dateFilter },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.transaction.aggregate({
        where: { ...tenant, type: 'PAYMENT', status: 'PENDING', isTest: false, createdAt: dateFilter },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.refundRequest.groupBy({
        by: ['status'],
        // Reports measure order refunds. Student cash-outs are withdrawals, not
        // refunded revenue, and must not reduce the refunded/leakage figures.
        where: { ...tenant, kind: 'REFUND', createdAt: dateFilter },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    // Day (or hour) buckets, pre-filled so the chart never has gaps.
    const points: Array<{ key: string; label: string }> = [];
    if (range.groupBy === 'hour') {
      for (let hour = 0; hour < 24; hour += 1) {
        const label = `${String(hour).padStart(2, '0')}:00`;
        points.push({ key: `hour-${hour}`, label });
      }
    } else {
      for (const day of getLastNDays(range.days)) {
        // Short ranges read better as weekday names; long ranges as dates.
        points.push({
          key: dayKey(day),
          label: range.days > 7 ? format(day, 'd MMM') : dayLabel(day),
        });
      }
    }
    const buckets = new Map<string, DailyBucket>(
      points.map((point) => [
        point.key,
        { date: point.key, label: point.label, revenue: 0, transactions: 0, profit: 0 },
      ]),
    );

    const vendorRevenue = new Map<string, { revenue: number; transactions: number }>();
    let gross = 0;
    let platformFees = 0;
    let aggregatorCost = 0;
    let universityRevenue = 0;
    let platformNet = 0;
    let vendorPayouts = 0;

    for (const payment of payments) {
      gross += payment.amount;
      platformFees += payment.platformFee;
      aggregatorCost += payment.aggregatorFee;
      universityRevenue += payment.universityRevenue;
      platformNet += Math.max(
        0,
        payment.platformFee - payment.universityRevenue - payment.aggregatorFee,
      );
      vendorPayouts += payment.vendorSettlement;

      const key =
        range.groupBy === 'hour'
          ? `hour-${payment.createdAt.getHours()}`
          : dayKey(payment.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue += payment.amount;
        bucket.transactions += 1;
        bucket.profit += payment.universityRevenue;
      }

      if (payment.vendorId) {
        const current = vendorRevenue.get(payment.vendorId) ?? { revenue: 0, transactions: 0 };
        current.revenue += payment.amount;
        current.transactions += 1;
        vendorRevenue.set(payment.vendorId, current);
      }
    }

    const vendorIds = [...vendorRevenue.keys()];
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const topVendors = [...vendorRevenue.entries()]
      .map(([vendorId, value]) => ({
        id: vendorId,
        name: vendorById.get(vendorId)?.name ?? 'Unknown vendor',
        code: vendorById.get(vendorId)?.code ?? '—',
        revenue: value.revenue,
        transactions: value.transactions,
        share: gross > 0 ? Math.round((value.revenue / gross) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const refunds = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    const refundAmounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    for (const group of refundGroups) {
      refunds[group.status] = group._count._all;
      refundAmounts[group.status] = group._sum.amount ?? 0;
    }

    const failedAmount = failed._sum.amount ?? 0;
    const failedCount = failed._count._all;
    const pendingAmount = pending._sum.amount ?? 0;
    const pendingCount = pending._count._all;
    const refundedAmount = refundAmounts.APPROVED;
    const transactionCount = payments.length;
    const attemptedVolume = gross + failedAmount + pendingAmount;

    return ok({
      range: {
        key: query.range,
        label: range.label,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      summary: {
        grossRevenue: gross,
        platformFees,
        vendorPayouts,
        universityRevenue,
        platformNet,
        aggregatorCost,
        transactions: transactionCount,
        averageTicket: transactionCount > 0 ? Math.round(gross / transactionCount) : 0,
        activeVendors: vendorIds.length,
        refundedAmount,
      },
      daily: [...buckets.values()],
      fees: {
        platform: platformFees,
        aggregator: aggregatorCost,
        university: universityRevenue,
        net: platformNet,
      },
      leakage: {
        failedCount,
        failedAmount,
        pendingCount,
        pendingAmount,
        refundedCount: refunds.APPROVED,
        refundedAmount,
        leakageRate:
          attemptedVolume > 0
            ? Math.round(((failedAmount + pendingAmount) / attemptedVolume) * 1000) / 10
            : 0,
      },
      topVendors,
    });
  } catch (error) {
    return fail(error);
  }
}

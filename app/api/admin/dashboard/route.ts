import { startOfDay, subDays } from 'date-fns';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { resolveTenantScope } from '@/lib/tenant';
import { dayKey, dayLabel, getLastNDays } from '@/lib/dates';
import { parseMetadata, serializeTx, txInclude } from '../_lib/serializers';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dashboardQuerySchema = z.object({
  universityId: z.string().min(1).optional(),
});

type MealBucket = { name: string; orders: number; revenue: number };

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, dashboardQuerySchema);
    const scope = resolveTenantScope(user, query.universityId);
    const scopeWhere = scope ? { universityId: scope } : {};
    const scopeWhereWith = <T extends object>(fragment: T) => ({ ...scopeWhere, ...fragment });

    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = subDays(todayStart, 1);
    // Compare "today so far" with the same window yesterday so the delta is honest.
    const yesterdayWindowEnd = new Date(
      yesterdayStart.getTime() + (now.getTime() - todayStart.getTime()),
    );
    const weekStart = startOfDay(subDays(now, 6));
    const days = getLastNDays(7);

    const [
      university,
      revenueToday,
      mealPaymentsToday,
      transactionsToday,
      revenueYesterday,
      transactionsYesterday,
      activeStudentRows,
      totalStudents,
      pendingRefundCount,
      pendingRefundAmount,
      weekPayments,
      liveFeed,
      menuItems,
    ] = await Promise.all([
      scope
        ? prisma.university.findUnique({
            where: { id: scope },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
      prisma.transaction.aggregate({
        where: scopeWhereWith({ type: 'PAYMENT', status: 'SETTLED', createdAt: { gte: todayStart } }),
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: scopeWhereWith({ type: 'PAYMENT', status: 'SETTLED', createdAt: { gte: todayStart } }),
      }),
      prisma.transaction.count({ where: scopeWhereWith({ createdAt: { gte: todayStart } }) }),
      prisma.transaction.aggregate({
        where: scopeWhereWith({
          type: 'PAYMENT',
          status: 'SETTLED',
          createdAt: { gte: yesterdayStart, lte: yesterdayWindowEnd },
        }),
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: scopeWhereWith({
          createdAt: { gte: yesterdayStart, lte: yesterdayWindowEnd },
        }),
      }),
      prisma.transaction.groupBy({
        by: ['studentId'],
        where: scopeWhereWith({ createdAt: { gte: weekStart } }),
      }),
      prisma.studentProfile.count({ where: scopeWhere }),
      prisma.refundRequest.count({
        where: scopeWhereWith({ status: 'PENDING', kind: 'REFUND' }),
      }),
      prisma.refundRequest.aggregate({
        where: scopeWhereWith({ status: 'PENDING', kind: 'REFUND' }),
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: scopeWhereWith({
          type: 'PAYMENT',
          status: 'SETTLED',
          createdAt: { gte: weekStart },
        }),
        select: { amount: true, universityRevenue: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: scopeWhere,
        include: txInclude,
        orderBy: { createdAt: 'desc' },
        take: 9,
      }),
      prisma.menuItem.findMany({
        where: scopeWhere,
        select: { name: true, emoji: true },
      }),
    ]);

    const buckets = new Map<string, { revenue: number; transactions: number; profit: number }>();
    for (const day of days) {
      buckets.set(dayKey(day), { revenue: 0, transactions: 0, profit: 0 });
    }
    const meals = new Map<string, MealBucket>();
    for (const payment of weekPayments) {
      const key = dayKey(payment.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue += payment.amount;
        bucket.transactions += 1;
        bucket.profit += payment.universityRevenue;
      }
      const metadata = parseMetadata(payment.metadata);
      const name = typeof metadata.item === 'string' && metadata.item ? metadata.item : 'Other';
      const meal = meals.get(name) ?? { name, orders: 0, revenue: 0 };
      meal.orders += 1;
      meal.revenue += payment.amount;
      meals.set(name, meal);
    }

    const emojiByName = new Map(menuItems.map((item) => [item.name, item.emoji]));
    const topMeals = [...meals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((meal) => ({
        name: meal.name,
        orders: meal.orders,
        revenue: meal.revenue,
        emoji: emojiByName.get(meal.name) ?? '🍽️',
      }));

    const chart = days.map((day) => {
      const key = dayKey(day);
      const bucket = buckets.get(key) ?? { revenue: 0, transactions: 0, profit: 0 };
      return {
        date: key,
        label: dayLabel(day),
        revenue: bucket.revenue,
        transactions: bucket.transactions,
        profit: bucket.profit,
      };
    });

    return ok({
      university,
      stats: {
        revenueToday: revenueToday._sum.amount ?? 0,
        revenueYesterday: revenueYesterday._sum.amount ?? 0,
        transactionsToday,
        transactionsYesterday,
        mealPaymentsToday,
        activeStudents: activeStudentRows.length,
        totalStudents,
        pendingRefunds: pendingRefundCount,
        pendingRefundAmount: pendingRefundAmount._sum.amount ?? 0,
      },
      chart,
      topMeals,
      liveFeed: liveFeed.map(serializeTx),
    });
  } catch (error) {
    return fail(error);
  }
}

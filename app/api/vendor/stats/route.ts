import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { requireVendorAccess } from '../_lib/access';
import {
  aggregateTopItems,
  emojiLookup,
  paymentSelect,
  rangeBounds,
  saleRow,
  studentSummarySelect,
} from '../_lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/stats
 * Today's till: gross sales, transaction counts, top sellers, settlement
 * balances and the latest six sales for the home screen.
 */
export async function GET() {
  try {
    const { vendor, universityId } = await requireVendorAccess();

    const { start, end } = rangeBounds('today');
    const baseWhere = {
      vendorId: vendor.id,
      universityId,
      type: 'PAYMENT',
    } as const;

    const [todayPayments, recentPayments, snapshot, menuItems] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...baseWhere, createdAt: { gte: start, lte: end } },
        select: paymentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.findMany({
        where: baseWhere,
        select: { ...paymentSelect, student: { select: studentSummarySelect } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.vendor.findUnique({
        where: { id: vendor.id },
        select: {
          name: true,
          code: true,
          pendingBalance: true,
          totalSettled: true,
          university: { select: { name: true, code: true } },
        },
      }),
      prisma.menuItem.findMany({
        where: { vendorId: vendor.id },
        select: { name: true, emoji: true },
      }),
    ]);

    if (!snapshot) {
      throw notFound('Vendor account no longer exists.');
    }

    const settled = todayPayments.filter((payment) => payment.status === 'SETTLED');
    const todaySales = settled.reduce((sum, payment) => sum + payment.amount, 0);
    const transactionCount = settled.length;

    return ok({
      vendor: {
        name: snapshot.name,
        code: snapshot.code,
        university: snapshot.university,
      },
      todaySales,
      transactionCount,
      averageSale: transactionCount ? Math.round(todaySales / transactionCount) : 0,
      topItems: aggregateTopItems(settled, emojiLookup(menuItems), 5),
      pendingBalance: snapshot.pendingBalance,
      totalSettled: snapshot.totalSettled,
      recentSales: recentPayments.map(saleRow),
      counts: {
        settled: transactionCount,
        pending: todayPayments.filter((payment) => payment.status === 'PENDING').length,
        failed: todayPayments.filter((payment) => payment.status === 'FAILED').length,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

import { subDays, startOfDay } from 'date-fns';
import { fail, ok, searchParams } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANGES = { today: 0, '7d': 7, '30d': 30, all: null } as const;
type RangeKey = keyof typeof RANGES;

/**
 * GET /api/super-admin/money?range=30d&tests=1
 * Where every shilling went: paid by buyers, kept by Snippe, earned by Kupon,
 * owed to cafeterias and paid out to them, overall and per cafeteria.
 */
export async function GET(request: Request) {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const params = searchParams(request);
    const rangeParam = params.get('range') ?? '30d';
    const range: RangeKey = rangeParam in RANGES ? (rangeParam as RangeKey) : '30d';
    const includeTests = params.get('tests') !== '0';
    const days = RANGES[range];
    const since = days === null ? undefined : days === 0 ? startOfDay(new Date()) : subDays(new Date(), days);

    const [payments, payouts, vendors] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          type: 'PAYMENT',
          status: 'SETTLED',
          ...(includeTests ? {} : { isTest: false }),
          ...(since ? { settledAt: { gte: since } } : {}),
        },
        select: {
          vendorId: true,
          amount: true,
          aggregatorFee: true,
          platformFee: true,
          vendorSettlement: true,
          isTest: true,
        },
      }),
      prisma.settlement.findMany({
        where: since ? { createdAt: { gte: since } } : {},
        select: { vendorId: true, amount: true, feeAmount: true, apiFee: true, kuponFee: true, netAmount: true },
      }),
      prisma.vendor.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          pendingBalance: true,
          university: { select: { code: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const totals = {
      buyersPaid: 0,
      snippeCollections: 0,
      kuponOrderFees: 0,
      cafeteriaEarnings: 0,
      orders: payments.length,
      testOrders: 0,
      payouts: payouts.length,
      paidOut: 0,
      snippePayoutFees: 0,
      kuponPayoutFees: 0,
    };
    const byVendor = new Map<string, { orders: number; sales: number; kupon: number; snippe: number; paidOut: number }>();
    const row = (id: string) => {
      const existing = byVendor.get(id);
      if (existing) return existing;
      const fresh = { orders: 0, sales: 0, kupon: 0, snippe: 0, paidOut: 0 };
      byVendor.set(id, fresh);
      return fresh;
    };

    for (const payment of payments) {
      totals.buyersPaid += payment.amount;
      totals.snippeCollections += payment.aggregatorFee;
      totals.kuponOrderFees += payment.platformFee;
      totals.cafeteriaEarnings += payment.vendorSettlement;
      if (payment.isTest) totals.testOrders += 1;
      if (payment.vendorId) {
        const entry = row(payment.vendorId);
        entry.orders += 1;
        entry.sales += payment.amount - payment.aggregatorFee;
        entry.kupon += payment.platformFee;
        entry.snippe += payment.aggregatorFee;
      }
    }
    for (const payout of payouts) {
      totals.paidOut += payout.netAmount;
      totals.snippePayoutFees += payout.apiFee;
      totals.kuponPayoutFees += payout.kuponFee;
      const entry = row(payout.vendorId);
      entry.paidOut += payout.netAmount;
      entry.snippe += payout.apiFee;
      entry.kupon += payout.kuponFee;
    }

    return ok({
      range,
      includeTests,
      totals: {
        ...totals,
        kuponEarned: totals.kuponOrderFees + totals.kuponPayoutFees,
        snippeEarned: totals.snippeCollections + totals.snippePayoutFees,
        cafeteriaBalances: vendors.reduce((sum, vendor) => sum + vendor.pendingBalance, 0),
      },
      cafeterias: vendors
        .map((vendor) => {
          const entry = byVendor.get(vendor.id) ?? { orders: 0, sales: 0, kupon: 0, snippe: 0, paidOut: 0 };
          return {
            id: vendor.id,
            name: vendor.name,
            code: vendor.code,
            campus: vendor.university.code,
            status: vendor.status,
            balance: vendor.pendingBalance,
            ...entry,
          };
        })
        .sort((a, b) => b.sales - a.sales),
    });
  } catch (error) {
    return fail(error);
  }
}

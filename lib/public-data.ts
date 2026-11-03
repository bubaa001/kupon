import { startOfDay } from 'date-fns';
import { prisma } from '@/lib/db';

export type PublicCoupon = {
  reference: string;
  couponCode: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: string;
  vendor: { name: string; code: string };
  university: { name: string; code: string; paymentRouteCode: string };
  studentBalance: number;
  items: { name: string; imageUrl: string | null; quantity: number }[];
};

export type PublicTransaction = {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  createdAt: string;
  vendorName: string | null;
};

export type PublicLedgerEntry = {
  account: string;
  debit: number;
  credit: number;
};

export type PublicLedger = {
  reference: string;
  university: { name: string; code: string; paymentRouteCode: string } | null;
  entries: PublicLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
};

export type LandingData = {
  stats: {
    universities: number;
    vendors: number;
    students: number;
    settledVolume: number;
    ledgerEntries: number;
    ledgerBalanced: boolean;
  };
  walletFloat: number;
  mealsToday: number;
  university: { name: string; code: string; paymentRouteCode: string } | null;
  coupon: PublicCoupon | null;
  transactions: PublicTransaction[];
  ledger: PublicLedger | null;
};

/**
 * Single read model for the public landing page.
 *
 * The marketing page renders live aggregates and a real recent coupon from the
 * database, so it can never drift from the demo seed or production data. No
 * balances, counts, names, references or coupon codes are hardcoded in the UI.
 */
export async function getLandingData(): Promise<LandingData> {
  const todayStart = startOfDay(new Date());

  const [
    universities,
    vendors,
    students,
    volume,
    wallets,
    mealsToday,
    latestOrder,
    recentTransactions,
    ledgerTransaction,
    ledgerRows,
  ] = await Promise.all([
    prisma.university.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, paymentRouteCode: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vendor.count({ where: { status: 'ACTIVE' } }),
    prisma.studentProfile.count(),
    prisma.transaction.aggregate({
      where: { type: 'PAYMENT', status: 'SETTLED' },
      _sum: { amount: true },
    }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        vendor: { select: { name: true, code: true } },
        university: { select: { name: true, code: true, paymentRouteCode: true } },
        student: { include: { wallet: { select: { balance: true } } } },
      },
    }),
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: { vendor: { select: { name: true } } },
    }),
    prisma.transaction.findFirst({
      where: { type: 'PAYMENT', status: 'SETTLED' },
      orderBy: { createdAt: 'desc' },
      include: {
        ledger: true,
        university: { select: { name: true, code: true, paymentRouteCode: true } },
      },
    }),
    prisma.ledgerEntry.groupBy({
      by: ['transactionId'],
      _sum: { debit: true, credit: true },
    }),
  ]);

  const ledgerBalanced = ledgerRows.every(
    (row) => (row._sum.debit ?? 0) === (row._sum.credit ?? 0),
  );

  const preferredUniversity =
    universities.find((university) => university.code === 'UDSM') ?? universities[0] ?? null;

  return {
    stats: {
      universities: universities.length,
      vendors,
      students,
      settledVolume: volume._sum.amount ?? 0,
      ledgerEntries: ledgerRows.length,
      ledgerBalanced,
    },
    walletFloat: wallets._sum.balance ?? 0,
    mealsToday,
    university: preferredUniversity
      ? {
          name: preferredUniversity.name,
          code: preferredUniversity.code,
          paymentRouteCode: preferredUniversity.paymentRouteCode,
        }
      : null,
    coupon: latestOrder
      ? {
          reference: latestOrder.reference,
          couponCode: latestOrder.couponCode,
          status: latestOrder.status,
          total: latestOrder.total,
          itemCount: latestOrder.itemCount,
          createdAt: latestOrder.createdAt.toISOString(),
          vendor: latestOrder.vendor,
          university: latestOrder.university,
          studentBalance: latestOrder.student.wallet?.balance ?? latestOrder.student.walletBalance,
          items: latestOrder.items.map((item) => ({
            name: item.name,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
          })),
        }
      : null,
    transactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      reference: transaction.reference,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      createdAt: transaction.createdAt.toISOString(),
      vendorName: transaction.vendor?.name ?? null,
    })),
    ledger: ledgerTransaction
      ? {
          reference: ledgerTransaction.reference,
          university: ledgerTransaction.university,
          entries: ledgerTransaction.ledger.map((entry) => ({
            account: entry.account,
            debit: entry.debit,
            credit: entry.credit,
          })),
          totalDebit: ledgerTransaction.ledger.reduce((sum, entry) => sum + entry.debit, 0),
          totalCredit: ledgerTransaction.ledger.reduce((sum, entry) => sum + entry.credit, 0),
          balanced:
            ledgerTransaction.ledger.reduce((sum, entry) => sum + entry.debit, 0) ===
            ledgerTransaction.ledger.reduce((sum, entry) => sum + entry.credit, 0),
        }
      : null,
  };
}

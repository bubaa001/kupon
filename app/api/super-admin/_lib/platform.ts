import type { Prisma } from '@prisma/client';
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { prisma } from '@/lib/db';
import { maskPhone } from '@/lib/utils';
import type {
  InvoiceLite,
  LedgerCheck,
  SliceTotals,
  TenantHealth,
  TenantSummary,
  TxSlice,
} from '@/app/super-admin/_components/types';

/**
 * Server-only aggregation helpers for the platform console.
 *
 * The fee model mirrors `lib/fees.ts` (every rate comes from `lib/env.ts`):
 *   gross sale → platformFee → university share (% of the fee) +
 *   aggregator rail cost + Kupon transaction net.
 * Top-ups generate no platform fee; any rail cost recorded on a top-up is still
 * counted as a platform cost. Rail costs are only recognised once a transaction
 * settles, so platform net reconciles exactly with the settled ledger.
 */

export type TimedTxSlice = TxSlice & { ts: number };

/** University fields required to build a tenant summary. */
export const tenantInclude = {
  users: {
    where: { role: 'ADMIN' },
    select: { name: true, phone: true },
    take: 1,
  },
  _count: {
    select: { studentProfiles: true, vendors: true },
  },
} satisfies Prisma.UniversityInclude;

export type UniversityRecord = Prisma.UniversityGetPayload<{ include: typeof tenantInclude }>;

export type SaasInvoiceRecord = {
  id: string;
  reference: string;
  universityId: string;
  amount: number;
  period: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
};

export type InvoiceTotals = {
  billed: number;
  collected: number;
  outstanding: number;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  latestByTenant: Record<string, InvoiceLite>;
};

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function fetchTxSlices(
  where: Prisma.TransactionWhereInput,
  isTest = false,
): Promise<TimedTxSlice[]> {
  const rows = await prisma.transaction.findMany({
    where: { ...where, isTest },
    select: {
      universityId: true,
      amount: true,
      platformFee: true,
      aggregatorFee: true,
      universityRevenue: true,
      type: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    universityId: row.universityId,
    amount: row.amount,
    platformFee: row.platformFee,
    aggregatorFee: row.aggregatorFee,
    universityRevenue: row.universityRevenue,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    ts: row.createdAt.getTime(),
  }));
}

export function summarize(slices: TxSlice[]): SliceTotals {
  const totals: SliceTotals = {
    gmv: 0,
    platformFee: 0,
    universityRevenue: 0,
    aggregatorFee: 0,
    topupVolume: 0,
    transactions: 0,
    settled: 0,
    failed: 0,
    pending: 0,
  };

  for (const slice of slices) {
    const isPayment = slice.type === 'PAYMENT';
    const isTopUp = slice.type === 'TOPUP';

    if (isPayment && slice.status === 'SETTLED') {
      totals.gmv += slice.amount;
      totals.platformFee += slice.platformFee;
      totals.universityRevenue += slice.universityRevenue;
      totals.transactions += 1;
    }
    if (isTopUp && slice.status === 'SETTLED') {
      totals.topupVolume += slice.amount;
    }
    // Only settled rail charges count: pending/failed attempts have not been
    // charged by the aggregator and must not reduce platform P&L.
    if ((isPayment || isTopUp) && slice.status === 'SETTLED') {
      totals.aggregatorFee += slice.aggregatorFee;
    }
    if (slice.status === 'SETTLED') totals.settled += 1;
    if (slice.status === 'FAILED') totals.failed += 1;
    if (slice.status === 'PENDING') totals.pending += 1;
  }

  return totals;
}

/** Platform transaction margin: fees minus university share and rail costs. */
export function feeNet(totals: Pick<SliceTotals, 'platformFee' | 'universityRevenue' | 'aggregatorFee'>) {
  return totals.platformFee - totals.universityRevenue - totals.aggregatorFee;
}

/** Settled / (settled + failed) payment attempts, as a percentage. */
export function paymentSuccessRate(slices: TxSlice[]): number {
  let settled = 0;
  let failed = 0;
  for (const slice of slices) {
    if (slice.type !== 'PAYMENT') continue;
    if (slice.status === 'SETTLED') settled += 1;
    else if (slice.status === 'FAILED') failed += 1;
  }
  const attempts = settled + failed;
  if (attempts === 0) return 100;
  return Math.round((settled / attempts) * 1000) / 10;
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function groupByTenant(slices: TxSlice[]): Map<string, TxSlice[]> {
  const grouped = new Map<string, TxSlice[]>();
  for (const slice of slices) {
    const bucket = grouped.get(slice.universityId);
    if (bucket) bucket.push(slice);
    else grouped.set(slice.universityId, [slice]);
  }
  return grouped;
}

export function within(slices: TxSlice[], fromMs: number, toMs?: number): TxSlice[] {
  return slices.filter((slice) => {
    const ts = new Date(slice.createdAt).getTime();
    return ts >= fromMs && (toMs === undefined || ts <= toMs);
  });
}

/** Explicit `{ok,data}`-friendly ledger invariant check. */
export async function ledgerCheck(): Promise<LedgerCheck> {
  const aggregate = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });
  const debits = aggregate._sum.debit ?? 0;
  const credits = aggregate._sum.credit ?? 0;
  return {
    debits,
    credits,
    difference: debits - credits,
    balanced: debits === credits,
    entries: aggregate._count._all,
  };
}

export type TimeBucket = {
  key: string;
  label: string;
  start: number;
  end: number;
};

export function dayBuckets(days: number): TimeBucket[] {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), days - 1));
  return eachDayOfInterval({ start, end }).map((date) => ({
    key: format(date, 'yyyy-MM-dd'),
    label: format(date, 'EEE'),
    start: startOfDay(date).getTime(),
    end: endOfDay(date).getTime(),
  }));
}

export function monthBuckets(months: number): TimeBucket[] {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = startOfMonth(subMonths(now, months - 1 - index));
    return {
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      start: startOfMonth(date).getTime(),
      end: endOfMonth(date).getTime(),
    };
  });
}

export async function saasInvoices(): Promise<SaasInvoiceRecord[]> {
  const rows = await prisma.saasInvoice.findMany({ orderBy: { issuedAt: 'desc' } });
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    universityId: row.universityId,
    amount: row.amount,
    period: row.period,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
  }));
}

export function invoiceTotals(invoices: SaasInvoiceRecord[]): InvoiceTotals {
  let billed = 0;
  let collected = 0;
  let outstanding = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let paidCount = 0;
  const latestByTenant: Record<string, InvoiceLite> = {};

  for (const invoice of invoices) {
    billed += invoice.amount;
    if (invoice.status === 'PAID') {
      collected += invoice.amount;
      paidCount += 1;
    } else {
      outstanding += invoice.amount;
      if (invoice.status === 'OVERDUE') overdueCount += 1;
      else pendingCount += 1;
    }
    if (!latestByTenant[invoice.universityId]) {
      // Invoices are ordered newest-first, so the first match is the latest.
      latestByTenant[invoice.universityId] = {
        id: invoice.id,
        reference: invoice.reference,
        period: invoice.period,
        amount: invoice.amount,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
      };
    }
  }

  return {
    billed,
    collected,
    outstanding,
    pendingCount,
    overdueCount,
    paidCount,
    latestByTenant,
  };
}

export type TenantTotals = {
  total: number;
  active: number;
  suspended: number;
  students: number;
  vendors: number;
  saasMrr: number;
};

export async function buildTenantSummaries(): Promise<{
  tenants: TenantSummary[];
  totals: TenantTotals;
  invoices: InvoiceTotals;
}> {
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const monthStart = startOfMonth(now).getTime();
  const weekStart = startOfDay(subDays(now, 6)).getTime();
  const thirtyDayStart = startOfDay(subDays(now, 29)).getTime();

  const [universities, slices, invoiceRows] = await Promise.all([
    prisma.university.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: tenantInclude,
    }),
    fetchTxSlices({ createdAt: { gte: startOfDay(subDays(now, 30)) } }),
    saasInvoices(),
  ]);

  const invoices = invoiceTotals(invoiceRows);
  const byTenant = groupByTenant(slices);

  const tenants: TenantSummary[] = universities.map((university) => {
    const rows = byTenant.get(university.id) ?? [];
    const today = summarize(within(rows, todayStart));
    const month = summarize(within(rows, monthStart));
    const last30 = summarize(within(rows, thirtyDayStart));
    const last7 = summarize(within(rows, weekStart));
    const successRate7d = paymentSuccessRate(within(rows, weekStart));
    const lastInvoice = invoices.latestByTenant[university.id] ?? null;
    const admin = university.users[0] ?? null;

    const health: TenantHealth =
      university.status === 'SUSPENDED'
        ? 'SUSPENDED'
        : successRate7d < 90 || last7.failed >= 4
          ? 'DEGRADED'
          : 'OPERATIONAL';

    return {
      id: university.id,
      name: university.name,
      code: university.code,
      city: university.city,
      routeCode: university.paymentRouteCode,
      status: university.status,
      saasFee: university.saasFee,
      brandColor: university.brandColor,
      createdAt: university.createdAt.toISOString(),
      students: university._count.studentProfiles,
      vendors: university._count.vendors,
      adminName: admin?.name ?? null,
      adminPhone: admin ? maskPhone(admin.phone) : null,
      gmvToday: today.gmv,
      revenueToday: today.gmv,
      transactionsToday: today.transactions,
      gmv30d: last30.gmv,
      monthlyRevenue: month.gmv,
      platformFee30d: last30.platformFee,
      universityRevenue30d: last30.universityRevenue,
      aggregatorFee30d: last30.aggregatorFee,
      topupVolume30d: last30.topupVolume,
      transactionNet30d: feeNet(last30),
      successRate7d,
      failed7d: last7.failed,
      health,
      lastInvoice,
    };
  });

  const totals: TenantTotals = {
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.status === 'ACTIVE').length,
    suspended: tenants.filter((tenant) => tenant.status !== 'ACTIVE').length,
    students: tenants.reduce((sum, tenant) => sum + tenant.students, 0),
    vendors: tenants.reduce((sum, tenant) => sum + tenant.vendors, 0),
    saasMrr: tenants
      .filter((tenant) => tenant.status === 'ACTIVE')
      .reduce((sum, tenant) => sum + tenant.saasFee, 0),
  };

  return { tenants, totals, invoices };
}

/** Serialises a University row for POST / PATCH responses. */
export function serializeTenantCore(university: {
  id: string;
  name: string;
  code: string;
  city: string;
  paymentRouteCode: string;
  status: string;
  saasFee: number;
  brandColor: string;
  createdAt: Date;
}) {
  return {
    id: university.id,
    name: university.name,
    code: university.code,
    city: university.city,
    routeCode: university.paymentRouteCode,
    status: university.status,
    saasFee: university.saasFee,
    brandColor: university.brandColor,
    createdAt: university.createdAt.toISOString(),
  };
}

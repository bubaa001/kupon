import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type {
  MonthPoint,
  RevenueData,
  RevenueTotals,
  TenantRevenue,
} from '@/app/super-admin/_components/types';
import {
  feeNet,
  fetchTxSlices,
  groupByTenant,
  invoiceTotals,
  ledgerCheck,
  monthBuckets,
  saasInvoices,
  summarize,
} from '../_lib/platform';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/revenue
 *
 * All-time platform P&L across every tenant: merchant volume, platform fee
 * revenue, the university share, mobile-money rail costs, SaaS invoices and
 * the resulting platform net revenue. Also returns a six-month revenue series,
 * a per-tenant breakdown and the live ledger invariant check.
 */
export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);

    const [universities, slices, invoiceRows, ledger] = await Promise.all([
      prisma.university.findMany({
        select: { id: true, name: true, code: true, status: true },
        orderBy: { name: 'asc' },
      }),
      fetchTxSlices({}),
      saasInvoices(),
      ledgerCheck(),
    ]);

    const totals = summarize(slices);
    const invoices = invoiceTotals(invoiceRows);
    const byTenant = groupByTenant(slices);

    const invoiceByTenant = new Map<string, { billed: number; collected: number }>();
    for (const invoice of invoiceRows) {
      const bucket = invoiceByTenant.get(invoice.universityId) ?? { billed: 0, collected: 0 };
      bucket.billed += invoice.amount;
      if (invoice.status === 'PAID') bucket.collected += invoice.amount;
      invoiceByTenant.set(invoice.universityId, bucket);
    }

    const perTenant: TenantRevenue[] = universities
      .map((university) => {
        const tenantTotals = summarize(byTenant.get(university.id) ?? []);
        const billing = invoiceByTenant.get(university.id) ?? { billed: 0, collected: 0 };
        const transactionNet = feeNet(tenantTotals);
        return {
          id: university.id,
          name: university.name,
          code: university.code,
          status: university.status,
          gmv: tenantTotals.gmv,
          platformFee: tenantTotals.platformFee,
          universityRevenue: tenantTotals.universityRevenue,
          aggregatorFee: tenantTotals.aggregatorFee,
          transactionNet,
          saasCollected: billing.collected,
          saasBilled: billing.billed,
          platformNet: transactionNet + billing.collected,
          transactions: tenantTotals.transactions,
          topupVolume: tenantTotals.topupVolume,
        };
      })
      .sort((a, b) => b.gmv - a.gmv);

    const series: MonthPoint[] = monthBuckets(6).map((bucket) => {
      const monthSlices = slices.filter((slice) => {
        const ts = new Date(slice.createdAt).getTime();
        return ts >= bucket.start && ts <= bucket.end;
      });
      const monthTotals = summarize(monthSlices);
      let saasCollected = 0;
      let saasBilled = 0;
      for (const invoice of invoiceRows) {
        const ts = new Date(invoice.issuedAt).getTime();
        if (ts < bucket.start || ts > bucket.end) continue;
        saasBilled += invoice.amount;
        if (invoice.status === 'PAID') saasCollected += invoice.amount;
      }
      const transactionNet = feeNet(monthTotals);
      return {
        period: bucket.key,
        label: bucket.label,
        gmv: monthTotals.gmv,
        platformFee: monthTotals.platformFee,
        saas: saasBilled,
        saasCollected,
        aggregatorFee: monthTotals.aggregatorFee,
        universityRevenue: monthTotals.universityRevenue,
        platformNet: transactionNet + saasCollected,
        transactions: monthTotals.transactions,
        topupVolume: monthTotals.topupVolume,
      };
    });

    const transactionNet = feeNet(totals);
    const failedPayments = slices.filter(
      (slice) => slice.type === 'PAYMENT' && slice.status === 'FAILED',
    ).length;

    const totalsBlock: RevenueTotals = {
      saasCollected: invoices.collected,
      saasBilled: invoices.billed,
      saasOutstanding: invoices.outstanding,
      platformTransactionNet: transactionNet,
      totalPlatformRevenue: totals.platformFee + invoices.collected,
      topupVolume: totals.topupVolume,
      transactionCount: totals.transactions,
      failedPayments,
      pendingInvoices: invoices.pendingCount,
    };

    const data: RevenueData = {
      generatedAt: new Date().toISOString(),
      grossVolume: totals.gmv,
      transactionFees: totals.platformFee,
      platformNet: transactionNet + invoices.collected,
      saasRevenue: invoices.billed,
      aggregatorCosts: totals.aggregatorFee,
      universityRevenue: totals.universityRevenue,
      feeModel: {
        platformFeePercent: env.PLATFORM_FEE_PERCENT,
        aggregatorFeePercent: env.AGGREGATOR_FEE_PERCENT,
        universitySharePercent: env.UNIVERSITY_REVENUE_SHARE_PERCENT,
      },
      totals: totalsBlock,
      series,
      perTenant,
      ledger,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

import { startOfDay, subDays } from 'date-fns';
import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { ChartPoint, OverviewData, PlatformPulse } from '@/app/super-admin/_components/types';
import {
  buildTenantSummaries,
  dayBuckets,
  fetchTxSlices,
  ledgerCheck,
  paymentSuccessRate,
  percentChange,
  summarize,
  within,
} from '../_lib/platform';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/overview
 *
 * Cross-tenant platform overview. Super-admin only — this is the one endpoint
 * that is intentionally not tenant scoped, but it never returns student PII:
 * only aggregate tenant numbers and a masked admin contact.
 */
export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);

    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const yesterdayStart = startOfDay(subDays(now, 1)).getTime();
    const weekStart = startOfDay(subDays(now, 6)).getTime();
    const prevWeekStart = startOfDay(subDays(now, 13)).getTime();

    const [{ tenants, totals, invoices }, recent, testRecent, ledger, pendingRefunds] =
      await Promise.all([
        buildTenantSummaries(),
        fetchTxSlices({ createdAt: { gte: startOfDay(subDays(now, 14)) } }),
        fetchTxSlices({ createdAt: { gte: startOfDay(subDays(now, 14)) } }, 'test'),
        ledgerCheck(),
        prisma.refundRequest.count({ where: { status: 'PENDING' } }),
      ]);

    const today = summarize(within(recent, todayStart));
    const yesterday = summarize(within(recent, yesterdayStart, todayStart - 1));
    const last7 = summarize(within(recent, weekStart));
    const prev7 = summarize(within(recent, prevWeekStart, weekStart - 1));
    const testToday = summarize(within(testRecent, todayStart));
    const test7d = summarize(within(testRecent, weekStart));

    const gmv30d = tenants.reduce((sum, tenant) => sum + tenant.gmv30d, 0);
    const platformFee30d = tenants.reduce((sum, tenant) => sum + tenant.platformFee30d, 0);
    const universityRevenue30d = tenants.reduce(
      (sum, tenant) => sum + tenant.universityRevenue30d,
      0,
    );
    const aggregatorCosts30d = tenants.reduce((sum, tenant) => sum + tenant.aggregatorFee30d, 0);
    const topupVolume30d = tenants.reduce((sum, tenant) => sum + tenant.topupVolume30d, 0);

    const platform: PlatformPulse = {
      gmvToday: today.gmv,
      gmvYesterday: yesterday.gmv,
      gmv7d: last7.gmv,
      gmv30d,
      testGmvToday: testToday.gmv,
      testGmv7d: test7d.gmv,
      testPaymentsToday: testToday.transactions,
      testPayments7d: test7d.transactions,
      gmvChangePercent: percentChange(today.gmv, yesterday.gmv),
      platformFeeToday: today.platformFee,
      platformFee7d: last7.platformFee,
      platformFeePrev7d: prev7.platformFee,
      platformFee30d,
      platformFeeChangePercent: percentChange(last7.platformFee, prev7.platformFee),
      transactionNet30d: platformFee30d - universityRevenue30d - aggregatorCosts30d,
      aggregatorCosts30d,
      universityRevenue30d,
      topupVolume30d,
      saasMrr: totals.saasMrr,
      saasCollected: invoices.collected,
      saasOutstanding: invoices.outstanding,
      activeTenants: totals.active,
      totalTenants: totals.total,
      totalStudents: totals.students,
      totalVendors: totals.vendors,
      transactionsToday: today.transactions,
      successRate7d: paymentSuccessRate(within(recent, weekStart)),
      successRateToday: paymentSuccessRate(within(recent, todayStart)),
      failedToday: today.failed,
      pendingRefunds,
      ledgerBalanced: ledger.balanced,
    };

    const chart: ChartPoint[] = dayBuckets(7).map((bucket) => {
      const day = summarize(within(recent, bucket.start, bucket.end));
      return {
        date: bucket.key,
        label: bucket.label,
        revenue: day.platformFee,
        transactions: day.transactions,
        gmv: day.gmv,
      };
    });

    const data: OverviewData = {
      generatedAt: now.toISOString(),
      universities: tenants,
      platform,
      chart,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

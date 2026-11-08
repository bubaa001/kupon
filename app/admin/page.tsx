'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  ReceiptText,
  RefreshCw,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { RevenueAreaChart } from '@/components/charts/revenue-area-chart';
import { TopMealsBarChart } from '@/components/charts/top-meals-bar-chart';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { formatCompactTZS, formatNumber, formatTZS, percentage } from '@/lib/utils';
import type { DashboardData, TxRow } from './_components/types';
import { useApiData } from './_components/hooks';
import { SectionCard } from './_components/ui-bits';
import { TransactionTable } from './_components/transaction-table';
import { TransactionDetailDialog } from './_components/transaction-detail-dialog';

function delta(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export default function AdminDashboardPage() {
  const { data, error, loading, reload } = useApiData<DashboardData>('/api/admin/dashboard');
  const [selected, setSelected] = useState<TxRow | null>(null);

  const stats = data?.stats;
  const chart = data?.chart ?? [];
  const totalRevenue = chart.reduce((sum, point) => sum + point.revenue, 0);
  const hasChartData = totalRevenue > 0 || chart.some((point) => point.transactions > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Campus overview"
        title="Good to see you"
        description={
          data?.university
            ? `Sales, orders, vendors and student activity for ${data.university.name}.`
            : 'Sales, orders, vendors and student activity for your campus.'
        }
        actions={
          <>
            <Badge variant="success" dot className="hidden sm:inline-flex">
              Live
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/transactions">
                Open ledger
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant="danger" title="Could not load the dashboard">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageSkeleton />
      ) : error && !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Revenue today"
              value={formatCompactTZS(stats?.revenueToday ?? 0)}
              icon={CircleDollarSign}
              accent="emerald"
              delta={delta(stats?.revenueToday ?? 0, stats?.revenueYesterday ?? 0)}
              hint={`vs ${formatCompactTZS(stats?.revenueYesterday ?? 0)} same time yesterday`}
            />
            <StatCard
              label="Transactions today"
              value={formatNumber(stats?.transactionsToday ?? 0)}
              icon={ReceiptText}
              accent="sky"
              delta={delta(
                stats?.transactionsToday ?? 0,
                stats?.transactionsYesterday ?? 0,
              )}
              hint={`${formatNumber(stats?.mealPaymentsToday ?? 0)} settled meal payments`}
            />
            <StatCard
              label="Active students"
              value={formatNumber(stats?.activeStudents ?? 0)}
              icon={Users}
              accent="violet"
              hint={`${formatNumber(stats?.totalStudents ?? 0)} enrolled in this campus`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Revenue trend"
              description="Settled meal payments over the last 7 days."
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                  Settled revenue
                </span>
                <span className="ml-auto font-medium text-slate-600">
                  {formatTZS(totalRevenue)} in the last 7 days
                </span>
              </div>
              {hasChartData ? (
                <RevenueAreaChart data={chart} height={286} />
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No settled payments yet"
                  description="As soon as students order from a vendor menu, the revenue trend appears here."
                  compact
                />
              )}
            </SectionCard>

            <SectionCard
              title="Top selling meals"
              description="By revenue in the last 7 days."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/vendors">Vendors</Link>
                </Button>
              }
            >
              {data && data.topMeals.length > 0 ? (
                <ul className="space-y-3.5">
                  {data.topMeals.map((meal) => (
                    <li key={meal.name}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs font-medium text-slate-800">
                            {meal.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold tabular text-slate-700">
                          {formatCompactTZS(meal.revenue)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress
                          value={percentage(meal.revenue, data.topMeals[0]?.revenue ?? meal.revenue)}
                          className="h-1.5"
                        />
                        <span className="w-14 shrink-0 text-right text-[10px] text-slate-400">
                          {meal.orders} orders
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={UtensilsCrossed}
                  title="No meal sales yet"
                  description="Approved menu items will rank here once students start paying."
                  compact
                />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <SectionCard
              className="xl:col-span-2"
              title="Meal revenue mix"
              description="Which dishes are actually driving the campus economy."
            >
              {data && data.topMeals.length > 0 ? (
                <TopMealsBarChart data={data.topMeals} height={300} />
              ) : (
                <EmptyState
                  icon={UtensilsCrossed}
                  title="Nothing to chart yet"
                  description="This chart fills in after the first settled meal payments."
                  compact
                />
              )}
            </SectionCard>

            <SectionCard
              className="xl:col-span-3"
              title="Live transaction feed"
              description="Order payments and their latest status, newest first."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/transactions">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
              contentClassName="p-0 sm:p-0"
            >
              {loading && !data ? (
                <div className="p-5">
                  <PageSkeleton />
                </div>
              ) : data && data.liveFeed.length > 0 ? (
                <div className="overflow-x-auto">
                  <TransactionTable rows={data.liveFeed} dense onSelect={setSelected} />
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    icon={ReceiptText}
                    title="No transactions yet"
                    description="Confirmed order payments will appear here."
                    compact
                  />
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}

      <TransactionDetailDialog
        row={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

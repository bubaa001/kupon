'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Info,
  Percent,
  RefreshCw,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { RevenueAreaChart } from '@/components/charts/revenue-area-chart';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, formatCompactTZS, formatNumber, formatTZS } from '@/lib/utils';
import type { ReportData } from '../_components/types';
import { useApiData } from '../_components/hooks';
import { percent } from '../_components/format';
import {
  ExportActions,
  PrintHeader,
  RangeTabs,
  SectionCard,
  TableEmpty,
} from '../_components/ui-bits';

type RangeValue = 'today' | '7d' | '30d' | 'mtd';

const RANGE_OPTIONS: { value: RangeValue; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'mtd', label: 'Month to date' },
];

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeValue>('7d');
  const { data, error, loading, reload } = useApiData<ReportData>(
    `/api/admin/reports?range=${range}`,
  );

  const summary = data?.summary;
  const fees = data?.fees;
  const leakage = data?.leakage;

  const [generatedAt, setGeneratedAt] = useState('');
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GB'));
  }, []);
  const hasData = (summary?.transactions ?? 0) > 0;

  return (
    <div className="space-y-5">
      <PrintHeader
        title="Campus financial report"
        subtitle={`${data?.range.label ?? 'Last 7 days'}${
          generatedAt ? ` • Generated ${generatedAt}` : ''
        }`}
      />

      <PageHeader
        eyebrow="Financial intelligence"
        title="Reports"
        description="Revenue, profit and loss, fee distribution and payment leakage for your campus."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <RangeTabs value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <ExportActions
              csvHref={`/api/admin/transactions/export?range=${range}`}
              onPrint={() => window.print()}
            />
          </div>
        }
      />

      {error ? (
        <Alert variant="danger" title="Could not load the report">
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
      ) : error && !data ? null : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross revenue"
              value={formatCompactTZS(summary?.grossRevenue ?? 0)}
              icon={TrendingUp}
              accent="emerald"
              hint={`${formatNumber(summary?.transactions ?? 0)} settled payments`}
            />
            <StatCard
              label="Platform fees"
              value={formatCompactTZS(summary?.platformFees ?? 0)}
              icon={Percent}
              accent="amber"
              hint={`${percent(summary?.platformFees ?? 0, summary?.grossRevenue ?? 0)}% of gross`}
            />
            <StatCard
              label="University share"
              value={formatCompactTZS(summary?.universityRevenue ?? 0)}
              icon={Wallet}
              accent="sky"
              hint="Your campus revenue from fees"
            />
            <StatCard
              label="Kupon net"
              value={formatCompactTZS(summary?.platformNet ?? 0)}
              icon={Store}
              accent="violet"
              hint={`Average ticket ${formatTZS(summary?.averageTicket ?? 0)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Revenue trend"
              description={`Settled meal volume • ${data.range.label.toLowerCase()}.`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                  Settled revenue
                </span>
                <span className="ml-auto font-medium text-slate-600">
                  {formatTZS(summary?.grossRevenue ?? 0)}
                </span>
              </div>
              {hasData ? (
                <RevenueAreaChart data={data.daily} height={300} />
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No settled payments in this period"
                  description="Pick a wider range or wait for vendors to charge students."
                  compact
                />
              )}
            </SectionCard>

            <SectionCard
              title="Where the fee goes"
              description={`${formatTZS(fees?.platform ?? 0)} platform fees distributed.`}
            >
              {fees ? (
                <div className="space-y-4">
                  {[
                    {
                      label: 'Aggregator rail cost',
                      value: fees.aggregator,
                      tone: 'bg-amber-400',
                    },
                    {
                      label: 'University revenue',
                      value: fees.university,
                      tone: 'bg-sky-400',
                    },
                    { label: 'Kupon net', value: fees.net, tone: 'bg-primary-500' },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600">{row.label}</span>
                        <span className="font-semibold tabular text-slate-900">
                          {formatTZS(row.value)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress
                          value={percent(row.value, fees.platform || 1)}
                          className="h-1.5"
                          indicatorClassName={row.tone}
                        />
                        <span className="w-9 shrink-0 text-right text-[10px] text-slate-400">
                          {percent(row.value, fees.platform || 1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] leading-relaxed text-slate-500">
                    Vendors keep{' '}
                    <span className="font-semibold text-slate-800">
                      {formatTZS(summary?.vendorPayouts ?? 0)}
                    </span>{' '}
                    of the gross volume; the rest is the {percent(fees.platform, summary?.grossRevenue ?? 1)}
                    % platform fee shared above.
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Profit & loss"
              description="How gross volume becomes campus and platform revenue."
            >
              <ul className="divide-y divide-slate-100">
                <ProfitRow label="Settled meal volume" value={summary?.grossRevenue ?? 0} strong />
                <ProfitRow
                  label="Less platform fee"
                  value={-(summary?.platformFees ?? 0)}
                  tone="red"
                  hint={`${percent(summary?.platformFees ?? 0, summary?.grossRevenue ?? 1)}% of gross`}
                />
                <ProfitRow
                  label="Vendor payouts"
                  value={summary?.vendorPayouts ?? 0}
                  hint="Owed to cafeteria operators"
                />
                <ProfitRow
                  label="Aggregator rail cost"
                  value={summary?.aggregatorCost ?? 0}
                  muted
                  hint="Paid out of the platform fee"
                />
                <ProfitRow
                  label="University revenue"
                  value={summary?.universityRevenue ?? 0}
                  tone="emerald"
                  hint="Credited to this campus"
                />
                <ProfitRow
                  label="Kupon net revenue"
                  value={summary?.platformNet ?? 0}
                  tone="emerald"
                />
              </ul>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2.5">
                <span className="text-xs font-semibold text-primary-800">
                  Campus + platform from fees
                </span>
                <span className="text-sm font-semibold tabular text-primary-900">
                  {formatTZS((summary?.universityRevenue ?? 0) + (summary?.platformNet ?? 0))}
                </span>
              </div>
            </SectionCard>

            <SectionCard
              title="Payment leakage"
              description="Attempted money that has not settled yet."
              action={
                <Badge
                  variant={
                    (leakage?.leakageRate ?? 0) > 3
                      ? 'danger'
                      : (leakage?.leakageRate ?? 0) > 0
                        ? 'warning'
                        : 'success'
                  }
                  dot
                >
                  {(leakage?.leakageRate ?? 0).toFixed(1)}% leakage
                </Badge>
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <LeakTile
                  label="Failed"
                  count={leakage?.failedCount ?? 0}
                  amount={leakage?.failedAmount ?? 0}
                  tone="red"
                />
                <LeakTile
                  label="Pending"
                  count={leakage?.pendingCount ?? 0}
                  amount={leakage?.pendingAmount ?? 0}
                  tone="amber"
                />
                <LeakTile
                  label="Refunded"
                  count={leakage?.refundedCount ?? 0}
                  amount={leakage?.refundedAmount ?? 0}
                  tone="neutral"
                />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Share of attempted volume stuck or failed</span>
                  <span className="font-semibold text-slate-700">
                    {(leakage?.leakageRate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, leakage?.leakageRate ?? 0)}
                  className="mt-1.5 h-2"
                  indicatorClassName={
                    (leakage?.leakageRate ?? 0) > 3 ? 'bg-red-500' : 'bg-amber-400'
                  }
                />
              </div>
              <div className="mt-4">
                <Alert
                  variant={(leakage?.failedCount ?? 0) > 0 ? 'warning' : 'success'}
                  title={
                    (leakage?.failedCount ?? 0) > 0
                      ? 'Some payments failed at the rail'
                      : 'No failed payments in this period'
                  }
                >
                  <span className="text-xs leading-relaxed">
                    {(leakage?.failedCount ?? 0) > 0
                      ? `${leakage?.failedCount} payments worth ${formatTZS(
                          leakage?.failedAmount ?? 0,
                        )} did not settle. Review the transaction feed for failure reasons.`
                      : 'Refunds are tracked separately and do not count as leakage.'}
                  </span>
                </Alert>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Top vendors by revenue"
            description={`${summary?.activeVendors ?? 0} vendors took payments in this period.`}
          >
            {data.topVendors.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[620px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                      <TableHead>Share of campus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topVendors.map((vendor, index) => (
                      <TableRow key={vendor.id}>
                        <TableCell>
                          <span
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-semibold',
                              index === 0
                                ? 'bg-primary-100 text-primary-800'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-semibold text-slate-800">{vendor.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{vendor.code}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-semibold tabular text-slate-900">
                            {formatTZS(vendor.revenue)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs tabular text-slate-600">
                            {formatNumber(vendor.transactions)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={vendor.share} className="h-1.5 w-24" />
                            <span className="text-[10px] text-slate-500">{vendor.share}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <TableEmpty
                icon={Store}
                title="No vendor revenue yet"
                description="When vendors settle their first payments in this period, they rank here."
              />
            )}
          </SectionCard>

          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Figures are computed from settled ledger transactions. Failed and pending attempts
            are reported under leakage; refunds reduce the student wallet, not the fee revenue.
            {leakage && leakage.failedCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {leakage.failedCount} failed attempts need a look.
              </span>
            ) : null}
          </p>
        </>
      ) : null}
    </div>
  );
}

function ProfitRow({
  label,
  value,
  hint,
  strong = false,
  muted = false,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
  muted?: boolean;
  tone?: 'emerald' | 'red';
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p
          className={cn(
            'text-xs',
            strong ? 'font-semibold text-slate-900' : 'font-medium text-slate-600',
            muted && 'text-slate-500',
          )}
        >
          {label}
        </p>
        {hint ? <p className="text-[10px] text-slate-400">{hint}</p> : null}
      </div>
      <span
        className={cn(
          'shrink-0 text-xs font-semibold tabular',
          tone === 'emerald' && 'text-emerald-700',
          tone === 'red' && 'text-red-600',
          !tone && 'text-slate-900',
        )}
      >
        {value < 0 ? `- ${formatTZS(Math.abs(value))}` : formatTZS(value)}
      </span>
    </li>
  );
}

function LeakTile({
  label,
  count,
  amount,
  tone,
}: {
  label: string;
  count: number;
  amount: number;
  tone: 'red' | 'amber' | 'neutral';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-semibold tabular',
          tone === 'red' && 'text-red-600',
          tone === 'amber' && 'text-amber-700',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {formatTZS(amount)}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">
        {count} {count === 1 ? 'payment' : 'payments'}
      </p>
    </div>
  );
}

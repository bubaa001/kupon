'use client';

import { useMemo, useState } from 'react';
import {
  Banknote,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import { useApiData } from '../_lib/use-api';
import type { SalesResponse, VendorRange } from '../_lib/types';
import { SaleList } from './sale-list';
import { TopItemsList } from './top-items-list';
import { LoadError } from './feedback';
import { CardBlockSkeleton, StatCardsSkeleton } from './skeletons';

const RANGES: { value: VendorRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

type StatusFilter = 'ALL' | 'SETTLED' | 'PENDING' | 'FAILED';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
];

export function SalesView() {
  const [range, setRange] = useState<VendorRange>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, loading, error, reload } = useApiData<SalesResponse>(
    `/api/vendor/sales?range=${range}`,
  );

  const counts = data?.counts ?? { total: 0, settled: 0, pending: 0, failed: 0 };
  const payments = useMemo(() => {
    const rows = data?.payments ?? [];
    if (statusFilter === 'ALL') return rows;
    return rows.filter((payment) => payment.status === statusFilter);
  }, [data, statusFilter]);

  const countFor = (filter: StatusFilter) =>
    filter === 'ALL' ? counts.total : counts[filter.toLowerCase() as 'settled' | 'pending' | 'failed'];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sales"
        title="Sales report"
        description="Order payments recorded in Kupon — settled, pending and failed."
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={range} onValueChange={(value) => setRange(value as VendorRange)}>
          <TabsList className="grid w-full grid-cols-3 sm:w-72">
            {RANGES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-[11px] text-slate-500">
          {data ? `${data.rangeLabel} • ${formatTZS(data.summary.gross)} gross` : 'Loading window…'}
        </p>
      </div>

      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <>
          <StatCardsSkeleton count={4} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" />
          <div className="grid gap-4 lg:grid-cols-3">
            <CardBlockSkeleton rows={4} />
            <div className="lg:col-span-2">
              <CardBlockSkeleton rows={6} />
            </div>
          </div>
        </>
      ) : null}

      {data ? (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Gross sales"
              value={formatTZS(data.summary.gross)}
              icon={Banknote}
              accent="emerald"
              hint={`${data.summary.transactions} settled payments`}
            />
            <StatCard
              label="Payments"
              value={String(data.summary.transactions)}
              icon={ReceiptText}
              accent="sky"
              hint={`${counts.pending} pending • ${counts.failed} failed`}
            />
            <StatCard
              label="Average sale"
              value={formatTZS(data.summary.average)}
              icon={TrendingUp}
              accent="violet"
              hint="Per settled payment"
            />
            <StatCard
              label="Net settlement"
              value={formatTZS(data.summary.netSettlement)}
              icon={Wallet}
              accent="amber"
              hint={`After ${formatTZS(data.summary.fees)} Kupon fee`}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <section className="card-surface min-w-0 overflow-hidden p-5">
              <SectionHeading
                title="Top sellers"
                description={data.rangeLabel.toLowerCase()}
              />
              <div className="mt-4 min-w-0">
                <TopItemsList
                  items={data.topItems}
                  emptyState={
                    <EmptyState
                      icon={TrendingUp}
                      title="No sales in this window"
                      description="Once payments start flowing, your best-selling dishes are ranked here by revenue."
                      compact
                    />
                  }
                />
              </div>
            </section>

            <section className="card-surface min-w-0 overflow-hidden lg:col-span-2">
              <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">Payments</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {payments.length} of {counts.total} payments
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter payments by status">
                  {FILTERS.map((filter) => {
                    const active = statusFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setStatusFilter(filter.value)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                          active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                        )}
                      >
                        {filter.label}
                        <span
                          className={cn(
                            'tabular rounded-full px-1.5 py-0.5 text-[10px]',
                            active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {countFor(filter.value)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 lg:hidden">
                <SaleList
                  sales={payments}
                  emptyState={
                    <EmptyState
                      icon={ReceiptText}
                      title="No payments to show"
                      description="Try another time window or clear the status filter to see more sales."
                      compact
                      action={
                        statusFilter !== 'ALL' ? (
                          <Button variant="outline" size="sm" onClick={() => setStatusFilter('ALL')}>
                            Clear filter
                          </Button>
                        ) : undefined
                      }
                    />
                  }
                />
              </div>

              <div className="hidden lg:block">
                {payments.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={ReceiptText}
                      title="No payments to show"
                      description="Try another time window or clear the status filter to see more sales."
                      compact
                      action={
                        statusFilter !== 'ALL' ? (
                          <Button variant="outline" size="sm" onClick={() => setStatusFilter('ALL')}>
                            Clear filter
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">You earn</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-500">
                            {payment.reference}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {payment.studentName}
                            </p>
                            {payment.studentNumber ? (
                              <p className="truncate text-[11px] text-slate-400">{payment.studentNumber}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <p className="truncate text-sm text-slate-700">
                              {payment.item ?? 'Meal payment'}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-slate-500">
                            {formatDateTime(payment.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={payment.amount} />
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.status === 'SETTLED' ? (
                              <Money amount={payment.net} tone="emerald" />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={payment.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
                Kupon keeps a 1% transaction share on settled payments. Students see a separate
                2.5% API fee at checkout. The remainder lands in your
                pending settlement balance for payout.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LiveIndicator } from '@/components/ui/live-indicator';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionSkeleton } from '@/components/ui/skeleton';
import type { TxStatus } from '@/lib/constants';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { cn, formatDate, formatTZS } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { useT } from '@/lib/i18n';
import { ErrorState } from '../_components/error-state';
import { TransactionRow } from '../_components/transaction-row';
import type { StudentTx, TransactionsData } from '../_lib/types';

// Loaded only when a buyer opens an order, to keep the first screen light.
const OrderSheet = dynamic(
  () => import('@/components/student/order-sheet').then((mod) => mod.OrderSheet),
  { ssr: false },
);

type RangeKey = 'today' | 'week' | 'month';

const RANGES: { value: RangeKey; label: string; period: string }[] = [
  { value: 'today', label: 'Today', period: 'today' },
  { value: 'week', label: '7 days', period: 'in the last 7 days' },
  { value: 'month', label: 'Month', period: 'this month' },
];

type StatusKey = '' | TxStatus;

const STATUS_CHIPS: {
  value: StatusKey;
  label: string;
  count: keyof TransactionsData['counts'];
  dot: string | null;
}[] = [
  { value: '', label: 'All', count: 'total', dot: null },
  { value: 'SETTLED', label: 'Completed', count: 'settled', dot: 'bg-emerald-500' },
  { value: 'PENDING', label: 'Pending', count: 'pending', dot: 'bg-amber-500' },
  { value: 'FAILED', label: 'Failed', count: 'failed', dot: 'bg-red-500' },
];

export default function HistoryPage() {
  const [range, setRange] = useState<RangeKey>('week');
  const [status, setStatus] = useState<StatusKey>('');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { t } = useT();

  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setSyncing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range });
        if (status) params.set('status', status);
        setData(await apiFetch<TransactionsData>(`/api/student/transactions?${params.toString()}`));
      } catch (err) {
        if (!silent) setError(err instanceof ApiClientError ? err.message : 'We could not load your history.');
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [range, status],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, StudentTx[]>();
    for (const tx of data.transactions) {
      const key = formatDate(tx.createdAt, 'yyyy-MM-dd');
      const existing = byDay.get(key);
      if (existing) existing.push(tx);
      else byDay.set(key, [tx]);
    }
    return Array.from(byDay.entries()).map(([key, transactions]) => ({
      key,
      label: formatDate(transactions[0].createdAt, 'EEEE, dd MMM'),
      total: transactions.reduce((sum, tx) => sum + (tx.status === 'SETTLED' ? tx.amount : 0), 0),
      transactions,
    }));
  }, [data]);

  const period = RANGES.find((item) => item.value === range)?.period ?? '';
  const settled = data?.counts.settled ?? 0;
  const average = data && settled > 0 ? Math.round(data.totalSpent / settled) : 0;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{t('history.title')}</h1>

      {/* Summary: period, total and live sync in one navy card. */}
      <section className="relative isolate overflow-hidden rounded-2xl bg-navy p-5 text-white shadow-card sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-gold/10 blur-3xl"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">History</p>
            <p className="mt-2 text-xl font-medium leading-tight tracking-[-0.04em] sm:text-2xl">
              {t('history.title')}
            </p>
          </div>
          <LiveIndicator syncing={syncing} tone="dark" />
        </div>

        <div
          role="group"
          aria-label="Period"
          className="mt-5 grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.06] p-1"
        >
          {RANGES.map((item) => {
            const active = item.value === range;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(item.value)}
                className={cn(
                  'min-h-9 rounded-full px-3 text-sm font-medium transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  active ? 'bg-gold text-navy shadow-sm' : 'text-navy-200 hover:text-white',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">
            Spent on meals {period}
          </p>
          <p className="mt-1.5 text-[2rem] font-medium leading-none tracking-[-0.05em] tabular sm:text-4xl">
            {loading || !data ? (
              <span className="inline-block h-8 w-40 rounded-lg bg-white/10 motion-safe:animate-pulse" />
            ) : (
              formatTZS(data.totalSpent)
            )}
          </p>
          <dl className="mt-5 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
            <div className="pr-4">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-300">Meals</dt>
              <dd className="mt-1 text-base font-medium tabular">{loading ? '—' : settled}</dd>
            </div>
            <div className="pl-4">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-300">
                Average meal
              </dt>
              <dd className="mt-1 text-base font-medium tabular">
                {loading ? '—' : average ? formatTZS(average) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Status filter: chips with live counts replace the old dropdown. */}
      <div
        role="radiogroup"
        aria-label="Filter by status"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {STATUS_CHIPS.map((chip) => {
          const active = chip.value === status;
          const count = data?.counts[chip.count] ?? 0;
          return (
            <button
              key={chip.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setStatus(chip.value)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                active
                  ? 'border-navy bg-navy text-white'
                  : 'border-navy/10 bg-white text-navy hover:border-navy/25',
              )}
            >
              {chip.dot ? <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} aria-hidden /> : null}
              {chip.label}
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular',
                  active ? 'bg-white/15 text-white' : 'bg-navy-50 text-ink-muted',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <Card className="rounded-2xl p-4 shadow-card sm:p-6">
          <TransactionSkeleton />
        </Card>
      ) : !data || data.transactions.length === 0 ? (
        <Card className="rounded-2xl p-4 shadow-card sm:p-6">
          <EmptyState
            icon={Receipt}
            title={status ? 'Nothing here' : 'No orders yet'}
            description={
              status
                ? `No ${STATUS_CHIPS.find((chip) => chip.value === status)?.label.toLowerCase()} orders ${period}.`
                : `You have no orders ${period}. Your meals and payments will show up here.`
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {status ? (
                  <Button variant="outline" size="sm" onClick={() => setStatus('')}>
                    Show all
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <Link href="/student/pay">Order a meal</Link>
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <section
              key={group.key}
              aria-labelledby={`day-${group.key}`}
              className="animate-fade-up overflow-hidden rounded-2xl border border-navy/[0.06] bg-white shadow-card motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
            >
              <header className="flex items-baseline justify-between gap-3 border-b border-navy/[0.06] bg-navy-50/60 px-4 py-3 sm:px-6">
                <h2
                  id={`day-${group.key}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.13em] text-navy"
                >
                  {group.label}
                </h2>
                <p className="text-[11px] text-ink-muted">
                  {group.transactions.length} {group.transactions.length === 1 ? 'order' : 'orders'}
                  {group.total > 0 ? (
                    <>
                      {' · '}
                      <span className="font-semibold tabular text-navy">{formatTZS(group.total)}</span>
                    </>
                  ) : null}
                </p>
              </header>
              <div className="divide-y divide-navy/[0.06] px-4 sm:px-6">
                {group.transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onOpen={setOpenOrderId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <OrderSheet orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

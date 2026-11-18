'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Receipt, RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionSkeleton } from '@/components/ui/skeleton';
import { STATUS_BADGE, TX_STATUSES } from '@/lib/constants';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { formatDate, formatTZS } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { useT } from '@/lib/i18n';
import dynamic from 'next/dynamic';
// Loaded only when a buyer opens an order, to keep the first screen light.
const OrderSheet = dynamic(
  () => import('@/components/student/order-sheet').then((mod) => mod.OrderSheet),
  { ssr: false },
);
import { ErrorState } from '../_components/error-state';
import { TransactionRow } from '../_components/transaction-row';
import type { StudentTx, TransactionsData } from '../_lib/types';

type RangeKey = 'today' | 'week' | 'month';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: 'Month' },
];

export default function HistoryPage() {
  const [range, setRange] = useState<RangeKey>('week');
  const [status, setStatus] = useState('');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { t } = useT();

  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (status) params.set('status', status);
      setData(await apiFetch<TransactionsData>(`/api/student/transactions?${params.toString()}`));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'We could not load your history.');
    } finally {
      setLoading(false);
    }
  }, [range, status]);

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
      transactions,
    }));
  }, [data]);

  const hasFilters = status.length > 0;

  function resetFilters() {
    setStatus('');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="History"
        title={t('history.title')}
        description={t('history.lead')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCcw aria-hidden />
            Refresh
          </Button>
        }
      />

      <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
        <TabsList className="grid w-full grid-cols-3">
          {RANGES.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={range} className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by payment status"
            >
              <option value="">All statuses</option>
              {TX_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_BADGE[item].label}
                </option>
              ))}
            </Select>
          </div>

          <Card className="overflow-hidden rounded-2xl p-4 shadow-card sm:p-6">
            <div>
              <p className="eyebrow">Total spent on meals</p>
              <p className="mt-1 text-2xl font-medium tracking-[-0.04em] tabular text-navy">
                {loading || !data ? '—' : formatTZS(data.totalSpent)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">All {data?.counts.total ?? 0}</Badge>
              <Badge variant="success" dot>
                Completed {data?.counts.settled ?? 0}
              </Badge>
              <Badge variant="warning" dot>
                Pending {data?.counts.pending ?? 0}
              </Badge>
              <Badge variant="danger" dot>
                Failed {data?.counts.failed ?? 0}
              </Badge>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto text-xs font-semibold text-primary-700 hover:text-primary-800"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </Card>

          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : (
            <Card className="overflow-hidden rounded-2xl p-4 shadow-card sm:p-6">
              {loading ? (
                <TransactionSkeleton />
              ) : !data || data.transactions.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No transactions"
                  description={
                    hasFilters
                      ? 'Nothing matches the filters you chose. Try clearing them.'
                      : 'You have not ordered yet. Your orders and payments will show up here.'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {hasFilters ? (
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                          Clear filters
                        </Button>
                      ) : null}
                      <Button asChild size="sm">
                        <Link href="/student/pay">Order a meal</Link>
                      </Button>
                    </div>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {groups.map((group) => (
                    <section key={group.key}>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
                          {group.label}
                        </h2>
                        <span className="text-[11px] text-ink-muted">
                          {group.transactions.length}{' '}
                          {group.transactions.length === 1 ? 'transaction' : 'transactions'}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {group.transactions.map((tx) => (
                          <TransactionRow key={tx.id} tx={tx} onOpen={setOpenOrderId} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <OrderSheet orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

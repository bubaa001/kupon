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
import { STATUS_BADGE, TX_STATUSES, TX_TYPE_LABEL, TX_TYPES } from '@/lib/constants';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { formatDate, formatTZS } from '@/lib/utils';
import { ErrorState } from '../_components/error-state';
import { TransactionRow } from '../_components/transaction-row';
import type { StudentTx, TransactionsData } from '../_lib/types';

type RangeKey = 'today' | 'week' | 'month';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Leo' },
  { value: 'week', label: 'Siku 7' },
  { value: 'month', label: 'Mwezi' },
];

export default function HistoryPage() {
  const [range, setRange] = useState<RangeKey>('week');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      setData(await apiFetch<TransactionsData>(`/api/student/transactions?${params.toString()}`));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Imeshindikana kupakia historia yako.',
      );
    } finally {
      setLoading(false);
    }
  }, [range, type, status]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const hasFilters = type.length > 0 || status.length > 0;

  function resetFilters() {
    setType('');
    setStatus('');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions • Historia"
        title="Historia ya wallet"
        description="Miamala yote ya wallet yako: top-ups, malipo ya chakula na refunds."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCcw aria-hidden />
            Sasisha
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
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Chuja kwa aina ya muamala"
            >
              <option value="">Aina zote</option>
              {TX_TYPES.map((item) => (
                <option key={item} value={item}>
                  {TX_TYPE_LABEL[item]}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Chuja kwa hali ya muamala"
            >
              <option value="">Hali zote</option>
              {TX_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_BADGE[item].label}
                </option>
              ))}
            </Select>
          </div>

          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                  Pesa zilizoingia
                </p>
                <p className="mt-1 text-lg font-semibold tabular text-emerald-700">
                  {loading || !data ? '—' : formatTZS(data.totalIn)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                  Pesa zilizotoka
                </p>
                <p className="mt-1 text-lg font-semibold tabular text-slate-900">
                  {loading || !data ? '—' : formatTZS(data.totalOut)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">Jumla {data?.counts.total ?? 0}</Badge>
              <Badge variant="success" dot>
                Zilizokamilika {data?.counts.settled ?? 0}
              </Badge>
              <Badge variant="warning" dot>
                Zinasubiri {data?.counts.pending ?? 0}
              </Badge>
              <Badge variant="danger" dot>
                Zilizoshindikana {data?.counts.failed ?? 0}
              </Badge>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto text-[11px] font-semibold text-primary-700 hover:text-primary-800"
                >
                  Ondoa vichujio
                </button>
              ) : null}
            </div>
          </Card>

          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : (
            <Card className="p-5">
              {loading ? (
                <TransactionSkeleton />
              ) : !data || data.transactions.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Hakuna miamala"
                  description={
                    hasFilters
                      ? 'Hakuna muamala unaolingana na vichujio ulivyochagua. Jaribu kuviondoa.'
                      : 'Bado hujaweka pesa wala kuagiza chakula. Miamala yako itaonekana hapa mara moja.'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {hasFilters ? (
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                          Ondoa vichujio
                        </Button>
                      ) : null}
                      <Button asChild size="sm">
                        <Link href="/student/topup">Weka pesa</Link>
                      </Button>
                    </div>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {groups.map((group) => (
                    <section key={group.key}>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                          {group.label}
                        </h2>
                        <span className="text-[10px] text-slate-400">
                          {group.transactions.length} miamala
                        </span>
                      </div>
                      <div className="mt-1 divide-y divide-slate-100">
                        {group.transactions.map((tx) => (
                          <TransactionRow key={tx.id} tx={tx} />
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
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ChevronRight, LifeBuoy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { formatDateTime, formatTZS } from '@/lib/utils';

type FinanceCase = {
  id: string;
  reference: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  student: { user: { name: string } };
};

type FinanceOverview = {
  creditRequests: FinanceCase[];
  emergencySettlement: { pendingBalance: number; authorizedLimit: number } | null;
};

const DECISION: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PENDING_FINANCE: { label: 'To decide', variant: 'warning' },
  APPROVED: { label: 'Credit given', variant: 'success' },
  CASH_REFUNDED: { label: 'Money back', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'neutral' },
};

/** Finance at a glance: the cafeteria's money, cases waiting, and what was decided. */
export default function FinancePage() {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<FinanceOverview>('/api/finance/requests'));
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Finance data did not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load();
  });

  const open = data?.creditRequests.filter((item) => item.status === 'PENDING_FINANCE') ?? [];
  const recent = data?.creditRequests.slice(0, 5) ?? [];
  const money = data?.emergencySettlement ?? null;

  return (
    <div className="space-y-5">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!data ? (
        <>
          <Skeleton className="h-[176px] w-full rounded-2xl" />
          <Skeleton className="h-[96px] w-full rounded-2xl" />
        </>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl bg-navy p-5 text-white sm:p-6" aria-label="Cafeteria money">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              Cafeteria balance
            </p>
            <p className="mt-3 text-[2.25rem] font-medium leading-none tracking-[-0.05em] tabular">
              {money ? formatTZS(money.pendingBalance) : '—'}
            </p>
            <p className="mt-2 text-sm text-navy-300">
              {money && money.authorizedLimit > 0
                ? `You can withdraw up to ${formatTZS(money.authorizedLimit)} a day. The owner sees every withdrawal.`
                : 'Withdrawals are off for you. Ask the owner to set a daily limit.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="gold" size="sm">
                <Link href="/finance/requests">Cases and withdrawals</Link>
              </Button>
            </div>
          </section>

          <Link
            href="/finance/requests"
            className={`flex items-center gap-3 rounded-2xl border bg-white p-4 transition-colors hover:bg-navy-50 ${open.length ? 'border-gold' : 'border-navy/[0.09]'}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy">
              <LifeBuoy className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy">
                {open.length ? `${open.length} meal ${open.length === 1 ? 'case' : 'cases'} to decide` : 'No meal cases waiting'}
              </span>
              <span className="block text-xs text-ink-muted">
                {open.length ? 'Give credit, money back, or reject.' : 'New cases from the counter appear here.'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden />
          </Link>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-navy">Latest cases</h2>
              <Link href="/finance/test-payments" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                Payment activity
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No cases yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-navy/[0.07]">
                {recent.map((item) => {
                  const decision = DECISION[item.status] ?? { label: item.status, variant: 'neutral' as const };
                  return (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{item.student.user.name}</p>
                        <p className="line-clamp-1 text-xs text-ink-muted">{item.reason}</p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">{formatDateTime(item.createdAt)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular text-navy">{formatTZS(item.amount)}</p>
                        <Badge variant={decision.variant} dot className="mt-1">
                          {decision.label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleDollarSign, Clock3, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';

type TestPayment = {
  reference: string;
  amount: number;
  status: string;
  stage: string;
  createdAt: string;
  order: { reference: string; status: string } | null;
  student: { studentId: string; user: { name: string } };
  vendor: { name: string; code: string } | null;
  university: { name: string; code: string };
  events: Array<{ stage: string; source: string; note: string | null; createdAt: string }>;
};

const STAGE_STYLE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  INITIATED: 'warning',
  RECEIVED: 'warning',
  CONFIRMED: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
};

export default function FinanceTestPaymentsPage() {
  const [transactions, setTransactions] = useState<TestPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReference, setBusyReference] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ transactions: TestPayment[] }>('/api/finance/test-payments');
      setTransactions(result.transactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load test payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance(payment: TestPayment, stage: 'RECEIVED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED') {
    setBusyReference(payment.reference);
    try {
      await postJson(`/api/finance/test-payments/${encodeURIComponent(payment.reference)}`, {
        stage,
      });
      toast.success(`Test payment marked ${stage.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not update this test payment.',
      );
    } finally {
      setBusyReference(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Kupon internal API"
        title="Test payments"
        description="Advance test order payments through their auditable lifecycle. No external gateway or money movement is involved."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        These are test transactions only. Confirming one makes its coupon available, but does not
        mean a student paid real money.
      </Alert>

      {loading && transactions.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">Loading test transactions…</Card>
      ) : transactions.length === 0 ? (
        <Card className="p-8 text-center">
          <CircleDollarSign className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">No test payments yet</p>
          <p className="mt-1 text-xs text-slate-500">
            A student order creates an initiated payment here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((payment) => {
            const busy = busyReference === payment.reference;
            const final = ['CONFIRMED', 'FAILED', 'EXPIRED'].includes(payment.stage);
            return (
              <Card key={payment.reference} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-slate-900">
                        {payment.reference}
                      </p>
                      <Badge variant={STAGE_STYLE[payment.stage] ?? 'neutral'}>
                        {payment.stage}
                      </Badge>
                      <Badge variant="neutral">TEST ONLY</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatTZS(payment.amount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {payment.student.user.name} · {payment.student.studentId} ·{' '}
                      {payment.vendor?.name ?? 'Cafeteria'} · {payment.university.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Order {payment.order?.reference ?? '—'} · Created{' '}
                      {formatDateTime(payment.createdAt)}
                    </p>

                    <ol className="mt-4 flex flex-wrap gap-2">
                      {payment.events.map((event, index) => (
                        <li
                          key={`${event.stage}-${event.createdAt}`}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600"
                        >
                          {event.stage === 'CONFIRMED' ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Clock3 className="h-3 w-3 text-slate-400" />
                          )}
                          <span>{event.stage}</span>
                          <span className="text-slate-400">{formatDateTime(event.createdAt)}</span>
                          {index < payment.events.length - 1 ? null : null}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {!final ? (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {payment.stage === 'INITIATED' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void advance(payment, 'RECEIVED')}
                        >
                          <Check className="h-4 w-4" />
                          Record received
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void advance(payment, 'CONFIRMED')}
                        >
                          <Check className="h-4 w-4" />
                          Confirm test payment
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void advance(payment, 'FAILED')}
                      >
                        <X className="h-4 w-4" />
                        Fail
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void advance(payment, 'EXPIRED')}
                      >
                        Expire
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

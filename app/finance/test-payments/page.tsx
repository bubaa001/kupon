'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleDollarSign, Clock3, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { apiFetch } from '@/lib/client-api';
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
  const pollErrorShown = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await apiFetch<{ transactions: TestPayment[] }>('/api/finance/test-payments');
      setTransactions(result.transactions);
      pollErrorShown.current = false;
    } catch (error) {
      if (!silent || !pollErrorShown.current) {
        toast.error(error instanceof Error ? error.message : 'Could not load test payments.');
      }
      pollErrorShown.current = true;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 2500);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Kupon test gateway"
        title="Payment activity"
        description="Read-only view of the lifecycle automatically recorded by Kupon's test gateway."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        These test transactions do not charge a phone or represent cash received. Kupon advances
        each payment automatically; Finance cannot confirm or reject a student checkout.
      </Alert>

      {loading && transactions.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">Loading test transactions…</Card>
      ) : transactions.length === 0 ? (
        <Card className="p-8 text-center">
          <CircleDollarSign className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">No test payments yet</p>
          <p className="mt-1 text-xs text-slate-500">
            A student checkout creates an initiated payment. Kupon advances it automatically.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((payment) => {
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
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatTZS(payment.amount)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {payment.student.user.name} · {payment.student.studentId} ·{' '}
                      {payment.vendor?.name ?? 'Cafeteria'} · {payment.university.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Order {payment.order?.reference ?? '—'} · Created{' '}
                      {formatDateTime(payment.createdAt)}
                    </p>

                    <ol className="mt-4 flex flex-wrap gap-2">
                      {payment.events.map((event) => (
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
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

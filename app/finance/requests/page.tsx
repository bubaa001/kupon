'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, patchJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';

type CreditRequest = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  order: { reference: string; status: string; expiresAt: string };
  student: { studentId: string; user: { name: string } };
  vendor: { name: string; code: string };
  university: { name: string; code: string };
  supportTicket: { reference: string; status: string; feeAmount: number } | null;
};

type SupportTicket = {
  id: string;
  reference: string;
  status: string;
  feeAmount: number;
  reason: string;
  createdAt: string;
  order: { reference: string; total: number };
  student: { studentId: string; user: { name: string } };
  vendor: { name: string; code: string };
  university: { name: string; code: string };
};

type FinanceRequests = { creditRequests: CreditRequest[]; supportTickets: SupportTicket[] };

export default function FinanceRequestsPage() {
  const [data, setData] = useState<FinanceRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<FinanceRequests>('/api/finance/requests'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decideSupport(ticket: SupportTicket, decision: 'APPROVE' | 'REJECT') {
    const note = window.prompt(`Finance note for ${ticket.reference}:`, '');
    if (note === null) return;
    if (note.trim().length < 5) {
      toast.error('Enter a review note with at least 5 characters.');
      return;
    }
    setBusy(ticket.id);
    try {
      const result = await patchJson<{ message: string }>(
        `/api/finance/requests/support/${encodeURIComponent(ticket.id)}`,
        { decision, note },
      );
      toast.success(result.message);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not review the ticket.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finance operations"
        title="Support cases"
        description="Review escalated support tickets. New cafeteria credit requests are decided by the platform admin."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        Store credit is cafeteria-specific and requires platform-admin approval. The TZS 1,500
        escalation charge is test-recorded against the cafeteria; no cash refund is sent here.
      </Alert>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Credit decisions · history</h2>
        {loading && !data ? (
          <Card className="p-5 text-sm text-slate-500">Loading requests…</Card>
        ) : data?.creditRequests.length ? (
          data.creditRequests.map((item) => (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{item.reference}</span>
                    <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}>
                      {item.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatTZS(item.amount)} · {item.vendor.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.student.user.name} ({item.student.studentId}) · {item.university.name} ·
                    Order {item.order.reference}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.kind.replaceAll('_', ' ')} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-slate-500">No credit requests.</Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Escalation tickets</h2>
        {data?.supportTickets.length ? (
          data.supportTickets.map((ticket) => (
            <Card key={ticket.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{ticket.reference}</span>
                    <Badge variant={ticket.status === 'OPEN' ? 'warning' : 'neutral'}>
                      {ticket.status}
                    </Badge>
                    <Badge variant="neutral">TEST FEE {formatTZS(ticket.feeAmount)}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {ticket.student.user.name} · {ticket.vendor.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.university.name} · Order {ticket.order.reference} ·{' '}
                    {formatTZS(ticket.order.total)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{ticket.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(ticket.createdAt)}</p>
                </div>
                {ticket.status === 'OPEN' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={busy === ticket.id} onClick={() => void decideSupport(ticket, 'APPROVE')}>
                      <Check className="h-4 w-4" /> Approve case
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === ticket.id} onClick={() => void decideSupport(ticket, 'REJECT')}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-slate-500">No escalation tickets.</Card>
        )}
      </section>
    </div>
  );
}

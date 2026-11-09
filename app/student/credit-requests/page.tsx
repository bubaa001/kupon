'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';
import type { OrderView, StudentOrdersData } from '@/lib/orders/types';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type CreditCase = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  vendor: { name: string; code: string };
  order: { reference: string; total: number; expiresAt: string };
  supportTicket: { reference: string; status: string; feeAmount: number } | null;
};

type StudentCredits = {
  credits: Array<{ vendorId: string; vendor: { name: string; code: string }; balance: number }>;
  requests: CreditCase[];
  tickets: Array<{
    reference: string;
    status: string;
    feeAmount: number;
    reason: string;
    createdAt: string;
    adminNote: string | null;
    order: { reference: string };
  }>;
};

export default function StudentCreditRequestsPage() {
  const [data, setData] = useState<StudentCredits | null>(null);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [creditData, orderData] = await Promise.all([
        apiFetch<StudentCredits>('/api/student/credit-requests'),
        apiFetch<StudentOrdersData>('/api/student/orders?status=PENDING'),
      ]);
      setData(creditData);
      setOrders(orderData.orders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load credit requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId || reason.trim().length < 5) {
      toast.error('Choose an active coupon and explain what went wrong.');
      return;
    }
    setSubmitting(true);
    try {
      await postJson('/api/student/credit-requests', { orderId, reason });
      setOrderId('');
      setReason('');
      toast.success('Your request was sent to the cafeteria.');
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function escalate(item: CreditCase) {
    const confirmed = window.confirm(
      'Open a further-measures ticket? A TZS 1,500 test charge will be recorded against the cafeteria. This test system cannot send a cash refund.',
    );
    if (!confirmed) return;
    setBusy(item.id);
    try {
      const ticketReason = window.prompt('Describe why you need further review:', '');
      if (ticketReason === null) return;
      await postJson(`/api/student/credit-requests/${encodeURIComponent(item.id)}/escalate`, {
        reason: ticketReason,
      });
      toast.success('Escalation ticket opened. No real money was moved.');
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not open the ticket.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cafeteria support"
        title="Credit & support"
        description="Ask the cafeteria to resolve an unfulfilled order. Approved credit appears here and can be used at that cafeteria."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        This is a test system. Credits and the TZS 1,500 ticket charge are internal records only;
        there is no cash refund or mobile-money collection.
      </Alert>

      {data ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Your cafeteria credit</h2>
            <p className="mt-1 text-xs text-slate-500">
              Credit approved by a cafeteria owner appears here. It is not cash and can only be
              used at the cafeteria that issued it.
            </p>
          </div>
          {data.credits.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.credits.map((credit) => (
                <Card key={credit.vendorId} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <CircleDollarSign className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{credit.vendor.name}</p>
                    <p className="text-[11px] text-slate-500">Only usable at this cafeteria</p>
                  </div>
                  <p className="text-sm font-bold tabular text-slate-900">{formatTZS(credit.balance)}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-sm text-slate-500">
              No cafeteria credit is available yet. If a cafeteria owner approves a request, the
              balance will appear here.
            </Card>
          )}
        </section>
      ) : null}

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Report food you could not collect</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Select an active, unexpired coupon. The cafeteria reviews the claim; if accepted, credit is
          tied to that cafeteria and the order amount.
        </p>
        <form onSubmit={submitRequest} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="credit-order">Active coupon</Label>
            <Select id="credit-order" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">Select an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.vendor.name} · {order.reference} · {formatTZS(order.total)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-reason">What happened?</Label>
            <Textarea
              id="credit-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              placeholder="Tell the cafeteria which item was unavailable."
              className="min-h-[84px]"
            />
          </div>
          <Button type="submit" disabled={!orderId || submitting} loading={submitting}>
            Send credit request
          </Button>
        </form>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Your requests</h2>
        {data?.requests.length ? (
          data.requests.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs font-semibold">{item.reference}</p>
                <Badge variant={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {item.status.replaceAll('_', ' ')}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {item.vendor.name} · {formatTZS(item.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Order {item.order.reference}</p>
              <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
              {item.status === 'APPROVED' && item.kind === 'STUDENT_UNFULFILLED' ? (
                item.supportTicket ? (
                  <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                    Escalation {item.supportTicket.reference} · {item.supportTicket.status} ·{' '}
                    {formatTZS(item.supportTicket.feeAmount)} test charge
                  </p>
                ) : (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={busy === item.id}
                    onClick={() => void escalate(item)}
                  >
                    <RotateCcw className="h-4 w-4" /> Open further-measures ticket · TZS 1,500
                  </Button>
                )
              ) : null}
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-slate-500">
            {loading ? 'Loading requests…' : 'No credit requests yet.'}
          </Card>
        )}
      </section>

      {data?.tickets.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Escalations</h2>
          {data.tickets.map((ticket) => (
            <Card key={ticket.reference} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs font-semibold">{ticket.reference}</p>
                <Badge variant={ticket.status === 'OPEN' ? 'warning' : 'neutral'}>{ticket.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">Order {ticket.order.reference} · {formatTZS(ticket.feeAmount)} test charge</p>
              <p className="mt-1 text-xs text-slate-500">{ticket.reason}</p>
              {ticket.adminNote ? <p className="mt-2 text-xs text-slate-500">Finance: {ticket.adminNote}</p> : null}
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}

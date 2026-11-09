'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LifeBuoy, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiFetch, patchJson, postJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type OrderOption = {
  id: string;
  reference: string;
  status: string;
  total: number;
  expiresAt: string;
  student: { name: string; studentId: string };
};

type CreditRequest = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  reason: string;
  vendorNote: string | null;
  createdAt: string;
  order: { reference: string; total: number; expiresAt: string };
  student: { studentId: string; user: { name: string } };
};

export default function VendorCreditRequestsPage() {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const pollErrorShown = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [orderData, requestData] = await Promise.all([
        apiFetch<{ orders: OrderOption[] }>('/api/vendor/orders?status=PENDING'),
        apiFetch<{ requests: CreditRequest[] }>('/api/vendor/credit-requests'),
      ]);
      setOrders(orderData.orders);
      setRequests(requestData.requests);
      pollErrorShown.current = false;
    } catch (error) {
      if (!silent || !pollErrorShown.current) {
        toast.error(error instanceof Error ? error.message : 'Could not load credit cases.');
      }
      pollErrorShown.current = true;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

  async function submitClosingRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId || reason.trim().length < 5) {
      toast.error('Choose an active order and add a reason.');
      return;
    }
    setSubmitting(true);
    try {
      await postJson('/api/vendor/credit-requests', { orderId, reason });
      setOrderId('');
      setReason('');
      toast.success('Closing-time credit request sent to Finance.');
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function review(request: CreditRequest, decision: 'ACCEPT' | 'REJECT') {
    setBusy(request.id);
    try {
      await patchJson(`/api/vendor/credit-requests/${encodeURIComponent(request.id)}`, {
        decision,
        note: decision === 'REJECT' ? 'Not approved by cafeteria.' : undefined,
      });
      toast.success(
        decision === 'ACCEPT'
          ? 'Credit case sent to Finance for a decision.'
          : 'Credit request declined.',
      );
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not review this request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cafeteria operations"
        title="Credit cases"
        description="Review a student’s unfulfilled-order claim or send an operational credit case to Finance. Finance decides the credit; platform admins can see the full audit trail."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        Approved credit is limited to this cafeteria and is non-transferable. This environment
        records test transactions only; no cash is moved.
      </Alert>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Plus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Request closing-time credit</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              For an active paid coupon you cannot fulfill near closing. Finance must approve it.
              Expired coupons are not eligible.
            </p>
            <form onSubmit={submitClosingRequest} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="credit-order">Active unverified order</Label>
                <Select id="credit-order" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">Select an order</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.reference} · {order.student.name} · {formatTZS(order.total)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closing-reason">Reason</Label>
                <Textarea
                  id="closing-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value.slice(0, 500))}
                  placeholder="Explain why the order could not be fulfilled."
                  className="min-h-[84px]"
                />
              </div>
              <Button type="submit" loading={submitting} disabled={submitting || !orderId}>
                Send to Finance
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Student requests & submitted cases</h2>
        {requests.length ? (
          requests.map((request) => (
            <Card key={request.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{request.reference}</span>
                    <Badge variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'}>
                      {request.status.replaceAll('_', ' ')}
                    </Badge>
                    <Badge variant="neutral">{request.kind.replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {request.student.user.name} · {formatTZS(request.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Order {request.order.reference}</p>
                  <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(request.createdAt)}</p>
                </div>
                {request.kind === 'STUDENT_UNFULFILLED' && request.status === 'PENDING_VENDOR' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={busy === request.id} onClick={() => void review(request, 'ACCEPT')}>
                    <Check className="h-4 w-4" /> Accept & send to Finance
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === request.id} onClick={() => void review(request, 'REJECT')}>
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-6 text-center">
            <LifeBuoy className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {loading ? 'Loading requests…' : 'No credit requests yet.'}
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}

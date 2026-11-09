'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiFetch, patchJson, postJson } from '@/lib/client-api';
import { MIN_WITHDRAWAL } from '@/lib/constants';
import { formatDateTime, formatTZS } from '@/lib/utils';

type CreditRequest = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  reason: string;
  adminNote: string | null;
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

type FinanceRequests = {
  creditRequests: CreditRequest[];
  supportTickets: SupportTicket[];
  emergencySettlement: { pendingBalance: number; authorizedLimit: number } | null;
};

type ReviewTarget = {
  id: string;
  reference: string;
  kind: 'credit' | 'support';
  decision: 'APPROVE' | 'REJECT';
};

export default function FinanceRequestsPage() {
  const [data, setData] = useState<FinanceRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

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
    setReviewNote('');
    setReviewTarget({ id: ticket.id, reference: ticket.reference, kind: 'support', decision });
  }

  async function decideCredit(request: CreditRequest, decision: 'APPROVE' | 'REJECT') {
    setReviewNote('');
    setReviewTarget({ id: request.id, reference: request.reference, kind: 'credit', decision });
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewTarget || reviewNote.trim().length < 5) {
      toast.error('Enter a decision note with at least 5 characters.');
      return;
    }
    setBusy(reviewTarget.id);
    setSubmittingReview(true);
    try {
      if (reviewTarget.kind === 'credit') {
        const result = await patchJson<{ status: string }>(
          `/api/finance/requests/credits/${encodeURIComponent(reviewTarget.id)}`,
          { decision: reviewTarget.decision, note: reviewNote.trim() },
        );
        toast.success(
          result.status === 'APPROVED'
            ? 'Cafeteria credit issued. The platform admin can see your note.'
            : 'Credit case rejected. The platform admin can see your note.',
        );
      } else {
        const result = await patchJson<{ message: string }>(
          `/api/finance/requests/support/${encodeURIComponent(reviewTarget.id)}`,
          { decision: reviewTarget.decision, note: reviewNote.trim() },
        );
        toast.success(result.message);
      }
      setReviewTarget(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not complete the Finance review.',
      );
    } finally {
      setBusy(null);
      setSubmittingReview(false);
    }
  }

  async function requestEmergencyWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(withdrawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast.error('Enter a valid whole-shilling amount.');
      return;
    }
    setWithdrawing(true);
    try {
      const result = await postJson<{ message: string }>('/api/finance/withdrawals', {
        amount,
        reason: withdrawReason,
      });
      toast.success(result.message);
      setWithdrawAmount('');
      setWithdrawReason('');
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not record the emergency withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finance operations"
        title="Credit cases & support"
        description="Review cafeteria credit requests for your assigned cafeteria, plus support cases. Platform admins can see every decision and its note."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="warning">
        Approved credit is limited to the originating cafeteria; it is not cash or a student wallet. Finance decisions require a note and are visible to the platform admin. The TZS 1,500 escalation charge is test-recorded; no cash refund is sent here.
      </Alert>

      {data?.emergencySettlement ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Emergency cafeteria withdrawal</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              This is available only when a platform admin sets a limit for your account. Every request
              requires a reason and is recorded for admin review. The current system only simulates
              settlements; it does not send money.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700">
              Pending balance: {formatTZS(data.emergencySettlement.pendingBalance)} · Your limit:{' '}
              {formatTZS(data.emergencySettlement.authorizedLimit)}
            </p>
          </div>
          {data.emergencySettlement.authorizedLimit > 0 ? (
            <form onSubmit={requestEmergencyWithdrawal} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emergency-amount">Amount (TZS)</Label>
                <Input
                  id="emergency-amount"
                  type="number"
                  min={MIN_WITHDRAWAL}
                  max={Math.min(
                    data.emergencySettlement.pendingBalance,
                    data.emergencySettlement.authorizedLimit,
                  )}
                  step={1}
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergency-reason">Emergency reason</Label>
                <Input
                  id="emergency-reason"
                  value={withdrawReason}
                  onChange={(event) => setWithdrawReason(event.target.value)}
                  minLength={5}
                  maxLength={500}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    withdrawing ||
                    data.emergencySettlement.pendingBalance < MIN_WITHDRAWAL ||
                    Number(withdrawAmount) > data.emergencySettlement.authorizedLimit
                  }
                  loading={withdrawing}
                >
                  Record emergency test withdrawal
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Emergency withdrawal is disabled. Ask the platform admin to assign an account-specific
              limit if this access is needed.
            </p>
          )}
        </Card>
      ) : null}

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
                  {item.adminNote ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      Finance note: {item.adminNote}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.kind.replaceAll('_', ' ')} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                {item.status === 'PENDING_FINANCE' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={busy === item.id} onClick={() => void decideCredit(item, 'APPROVE')}>
                      <Check className="h-4 w-4" /> Issue credit
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void decideCredit(item, 'REJECT')}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                ) : null}
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
      <Dialog
        open={reviewTarget !== null}
        onOpenChange={(open) => {
          if (!open && !submittingReview) setReviewTarget(null);
        }}
      >
        <DialogContent>
          <form onSubmit={submitReview} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {reviewTarget?.decision === 'APPROVE' ? 'Approve' : 'Reject'}{' '}
                {reviewTarget?.kind === 'credit' ? 'credit case' : 'support case'}
              </DialogTitle>
              <DialogDescription>
                Record a decision note for {reviewTarget?.reference}. Platform admins can review it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="finance-review-note">Decision note</Label>
              <Textarea
                id="finance-review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                minLength={5}
                maxLength={500}
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submittingReview}
                onClick={() => setReviewTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReview} loading={submittingReview}>
                Confirm decision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
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
import { formatDateTime, formatTZS } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { LiveIndicator } from '@/components/ui/live-indicator';

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
  decision: 'APPROVE' | 'CASH' | 'REJECT';
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
  const pollErrorShown = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await apiFetch<FinanceRequests>('/api/finance/requests'));
      pollErrorShown.current = false;
    } catch (error) {
      if (!silent || !pollErrorShown.current) {
        toast.error(error instanceof Error ? error.message : 'Could not load cases.');
      }
      pollErrorShown.current = true;
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

  async function decideSupport(ticket: SupportTicket, decision: 'APPROVE' | 'REJECT') {
    setReviewNote('');
    setReviewTarget({ id: ticket.id, reference: ticket.reference, kind: 'support', decision });
  }

  async function decideCredit(request: CreditRequest, decision: 'APPROVE' | 'CASH' | 'REJECT') {
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
            ? 'Credit given. The owner can see your note.'
            : result.status === 'CASH_REFUNDED'
              ? 'Money-back recorded. The owner can see your note.'
              : 'Case rejected. The owner can see your note.',
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
        description="When a paid meal cannot be served, you decide: credit at this cafeteria or money back. The owner sees every decision and withdrawal."
        actions={
          <LiveIndicator syncing={loading} />
        }
      />

      <Alert variant="warning">
        Prefer credit: money back costs the cafeteria the meal price plus the withdrawal charge. Test gateway: decisions are recorded, but no real money moves.
      </Alert>

      {data?.emergencySettlement ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Withdraw for the cafeteria</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              For when the owner is away, for example to buy ingredients. The owner sets your daily
              limit and sees every withdrawal. Test gateway: no real money is sent.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700">
              Cafeteria balance: {formatTZS(data.emergencySettlement.pendingBalance)} · Your daily limit:{' '}
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
                <Label htmlFor="emergency-reason">What it is for</Label>
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
                    Number(withdrawAmount) > data.emergencySettlement.authorizedLimit
                  }
                  loading={withdrawing}
                >
                  Withdraw
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Withdrawals are off for you. Ask the cafeteria owner to set a daily limit.
            </p>
          )}
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Meal cases</h2>
        {loading && !data ? (
          <Card className="p-5 text-sm text-slate-500">Loading requests…</Card>
        ) : data?.creditRequests.length ? (
          data.creditRequests.map((item) => (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{item.reference}</span>
                    <Badge variant={item.status === 'APPROVED' || item.status === 'CASH_REFUNDED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'}>
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
                  <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex">
                    <Button size="sm" disabled={busy === item.id} onClick={() => void decideCredit(item, 'APPROVE')}>
                      <Check className="h-4 w-4" /> Give credit
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void decideCredit(item, 'CASH')}>
                      Money back
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => void decideCredit(item, 'REJECT')}>
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
                {reviewTarget?.kind === 'credit'
                  ? reviewTarget.decision === 'APPROVE'
                    ? 'Give cafeteria credit'
                    : reviewTarget.decision === 'CASH'
                      ? 'Give the money back'
                      : 'Reject this case'
                  : `${reviewTarget?.decision === 'APPROVE' ? 'Approve' : 'Reject'} support case`}
              </DialogTitle>
              <DialogDescription>
                {reviewTarget?.decision === 'CASH' ? 'The cafeteria pays the meal price plus the withdrawal charge. ' : ''}Add a short note for {reviewTarget?.reference}; the owner can see it.
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

'use client';

import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Smartphone, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefundStatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, patchJson } from '@/lib/client-api';
import { PAYOUT_STATUS_LABEL } from '@/lib/constants';
import { cn, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import type { AdminMoneyRequestView } from '@/lib/payments/money-request-types';
import { DetailRow } from '../../_components/ui-bits';

type Decision = 'APPROVED' | 'REJECTED';

type DecisionResponse = {
  request: AdminMoneyRequestView;
  payout?: {
    reference: string;
    status: string;
    provider: string;
    balance: number;
    transactionReference: string;
  };
};

export function WithdrawalReviewDialog({
  withdrawal,
  open,
  onOpenChange,
  onReviewed,
}: {
  withdrawal: AdminMoneyRequestView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDecision(null);
      setNote('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const insufficient = withdrawal ? withdrawal.amount > withdrawal.student.balance : false;

  async function submit() {
    if (!withdrawal || !decision) return;
    if (decision === 'REJECTED' && note.trim().length < 5) {
      setError('Add a short note so the student understands why the cash-out was declined.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await patchJson<DecisionResponse>(
        `/api/admin/withdrawals/${withdrawal.id}`,
        { decision, adminNote: note.trim() || undefined },
      );
      if (decision === 'APPROVED' && data.payout) {
        toast.success(`Withdrawal approved • payout ${data.payout.reference}`, {
          description: `Student wallet balance is now ${formatTZS(data.payout.balance)}.`,
        });
      } else {
        toast.success('Withdrawal rejected. The balance stays in the wallet.');
      }
      onReviewed();
      onOpenChange(false);
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'The review could not be saved.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Banknote className="h-5 w-5" />
          </span>
          <DialogTitle>Review withdrawal</DialogTitle>
          <DialogDescription>
            {withdrawal ? (
              <>
                <span className="font-mono text-[11px]">{withdrawal.reference}</span> • requested{' '}
                {relativeTime(withdrawal.createdAt)}
              </>
            ) : (
              'Select a withdrawal to review.'
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        {withdrawal ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Cash-out amount
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular tracking-tight text-slate-900">
                    {formatTZS(withdrawal.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {withdrawal.student.name} •{' '}
                    <span className="font-mono text-[10px]">{withdrawal.student.studentId}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <Smartphone className="h-3 w-3" aria-hidden />
                    {withdrawal.student.phone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Wallet balance
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-sm font-semibold tabular',
                      insufficient ? 'text-red-600' : 'text-slate-900',
                    )}
                  >
                    {formatTZS(withdrawal.student.balance)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {withdrawal.student.course} • Year {withdrawal.student.year}
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
                “{withdrawal.reason}”
              </p>
            </div>

            {insufficient ? (
              <Alert variant="warning" title="Balance is lower than the request">
                Approving now will fail at the wallet debit step and the request will stay in
                this queue. Ask the student to top up first.
              </Alert>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDecision('APPROVED')}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                  decision === 'APPROVED'
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    Approve withdrawal
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                    Debits the wallet once, books a WITHDRAWAL transaction and pays out to
                    mobile money through the payment provider.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                  decision === 'REJECTED'
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    Reject request
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                    Keeps the whole balance in the wallet. No money moves; a note is required.
                  </span>
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="withdrawal-note" className="text-sm font-medium text-slate-700">
                Admin note {decision === 'REJECTED' ? '(required)' : '(optional)'}
              </label>
              <Textarea
                id="withdrawal-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  decision === 'REJECTED'
                    ? 'e.g. Cash-out window closes at end of semester; please spend or carry over the balance.'
                    : 'e.g. Verified with student affairs; payout queued to M-Pesa.'
                }
                maxLength={300}
                className="min-h-[76px]"
              />
              <p className="text-right text-[10px] text-slate-400">{note.length}/300</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={decision === 'REJECTED' ? 'destructive' : 'default'}
                loading={submitting}
                disabled={!decision}
                onClick={() => void submit()}
              >
                {decision === 'REJECTED' ? 'Reject request' : 'Approve & pay out'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawalDetailDialog({
  withdrawal,
  open,
  onOpenChange,
}: {
  withdrawal: AdminMoneyRequestView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Withdrawal
            {withdrawal ? <RefundStatusBadge status={withdrawal.status} /> : null}
          </DialogTitle>
          <DialogDescription>
            {withdrawal ? `${withdrawal.reference} • ${formatDateTime(withdrawal.createdAt)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {withdrawal ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amount
              </p>
              <p className="mt-1 text-xl font-semibold tabular text-slate-900">
                {formatTZS(withdrawal.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {withdrawal.student.name} • {withdrawal.student.studentId}
              </p>
            </div>
            <div>
              <DetailRow label="Kind">
                <Badge variant="neutral">Cash-out (not an order refund)</Badge>
              </DetailRow>
              <DetailRow label="Reason">{withdrawal.reason}</DetailRow>
              <DetailRow label="Requested">{formatDateTime(withdrawal.createdAt)}</DetailRow>
              <DetailRow label="Reviewed by">{withdrawal.reviewedBy ?? '—'}</DetailRow>
              <DetailRow label="Reviewed at">
                {withdrawal.reviewedAt ? formatDateTime(withdrawal.reviewedAt) : '—'}
              </DetailRow>
              <DetailRow label="Payout status">
                {withdrawal.payoutStatus
                  ? (PAYOUT_STATUS_LABEL[withdrawal.payoutStatus] ?? withdrawal.payoutStatus)
                  : '—'}
              </DetailRow>
              <DetailRow label="Payout reference">
                {withdrawal.payoutReference ?? '—'}
              </DetailRow>
              <DetailRow label="Transaction">
                {withdrawal.payoutTransactionId ? (
                  <span className="font-mono text-[10px]">{withdrawal.payoutTransactionId}</span>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow label="Admin note">{withdrawal.adminNote ?? 'No note recorded'}</DetailRow>
            </div>
            <Badge variant="neutral" className="w-fit">
              {withdrawal.student.course} • Year {withdrawal.student.year}
            </Badge>
          </>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

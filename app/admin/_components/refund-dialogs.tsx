'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
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
import { cn, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import type { RefundRow } from './types';
import { DetailRow } from './ui-bits';

type Decision = 'APPROVED' | 'REJECTED';

export function RefundReviewDialog({
  refund,
  open,
  onOpenChange,
  onReviewed,
}: {
  refund: RefundRow | null;
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

  const insufficient = refund ? refund.amount > refund.student.balance : false;

  async function submit() {
    if (!refund || !decision) return;
    if (decision === 'REJECTED' && note.trim().length < 5) {
      setError('Add a short note so the student understands why the refund was declined.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await patchJson<{
        request: RefundRow;
        payout?: { reference: string; balance: number };
      }>(`/api/admin/refunds/${refund.id}`, {
        decision,
        adminNote: note.trim() || undefined,
      });
      if (decision === 'APPROVED' && data.payout) {
        toast.success(`Refund approved • payout ${data.payout.reference}`, {
          description: `Wallet balance is now ${formatTZS(data.payout.balance)}.`,
        });
      } else {
        toast.success('Refund request rejected. The student can still see the note.');
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
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <RotateCcw className="h-5 w-5" />
          </span>
          <DialogTitle>Review refund request</DialogTitle>
          <DialogDescription>
            {refund ? (
              <>
                <span className="font-mono text-[11px]">{refund.reference}</span> • requested{' '}
                {relativeTime(refund.createdAt)}
              </>
            ) : (
              'Select a refund request to review.'
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        {refund ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Refund amount
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular tracking-tight text-slate-900">
                    {formatTZS(refund.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {refund.student.name} •{' '}
                    <span className="font-mono text-[10px]">{refund.student.studentId}</span>
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
                    {formatTZS(refund.student.balance)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {refund.student.course} • Year {refund.student.year}
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
                “{refund.reason}”
              </p>
            </div>

            {insufficient ? (
              <Alert variant="warning" title="Balance is lower than the request">
                Approving now will fail at the payout step because the wallet cannot cover TZS{' '}
                {refund.amount.toLocaleString('en-US')}. Ask the student to top up first.
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
                  <span className="block text-xs font-semibold text-slate-900">Approve refund</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                    Debits the wallet and sends a mobile-money payout through the payment provider.
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
                  <span className="block text-xs font-semibold text-slate-900">Reject request</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                    Keeps the balance in the wallet. No money moves; a note is required.
                  </span>
                </span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="refund-note" className="text-sm font-medium text-slate-700">
                Admin note {decision === 'REJECTED' ? '(required)' : '(optional)'}
              </label>
              <Textarea
                id="refund-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  decision === 'REJECTED'
                    ? 'e.g. Refund window closes 14 days after top-up; balance carries over.'
                    : 'e.g. Verified with student affairs; payout queued.'
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

export function RefundDetailDialog({
  refund,
  open,
  onOpenChange,
}: {
  refund: RefundRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Refund review
            {refund ? <RefundStatusBadge status={refund.status} /> : null}
          </DialogTitle>
          <DialogDescription>
            {refund ? `${refund.reference} • ${formatDateTime(refund.createdAt)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {refund ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amount
              </p>
              <p className="mt-1 text-xl font-semibold tabular text-slate-900">
                {formatTZS(refund.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {refund.student.name} • {refund.student.studentId}
              </p>
            </div>
            <div>
              <DetailRow label="Reason">{refund.reason}</DetailRow>
              <DetailRow label="Requested">{formatDateTime(refund.createdAt)}</DetailRow>
              <DetailRow label="Reviewed by">{refund.reviewedBy ?? '—'}</DetailRow>
              <DetailRow label="Reviewed at">
                {refund.reviewedAt ? formatDateTime(refund.reviewedAt) : '—'}
              </DetailRow>
              <DetailRow label="Admin note">{refund.adminNote ?? 'No note recorded'}</DetailRow>
            </div>
            <Badge variant="neutral" className="w-fit">
              {refund.student.course} • Year {refund.student.year}
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

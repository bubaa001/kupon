'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, XCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FoodThumb } from '@/components/orders/food-thumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiClientError, postJson } from '@/lib/client-api';
import { cn, formatTZS } from '@/lib/utils';
import type { CancelOrderResult, OrderCancelReason, OrderView } from '@/lib/orders/types';

const REASON_OPTIONS: Array<{
  value: OrderCancelReason;
  label: string;
  hint: string;
}> = [
  {
    value: 'VENDOR_CLOSED',
    label: 'Vendor amefunga',
    hint: 'Counter closed before I could collect',
  },
  {
    value: 'ITEM_UNAVAILABLE',
    label: 'Chakula hakipo',
    hint: 'The dish is no longer available',
  },
  {
    value: 'ORDERED_BY_MISTAKE',
    label: 'Niliagiza kimakosa',
    hint: 'Wrong vendor or wrong items',
  },
  {
    value: 'OTHER',
    label: 'Sababu nyingine',
    hint: 'Tell us what happened',
  },
];

const NOTE_MAX = 200;

/**
 * Cancel confirmation for the student's own PENDING coupon. The API is
 * idempotent, so a double tap or a retry can never refund twice; on success the
 * parent refreshes the card deck and the wallet balance.
 */
export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onCancelled,
}: {
  order: OrderView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (result: CancelOrderResult) => void;
}) {
  const [reason, setReason] = useState<OrderCancelReason | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = order?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote('');
    setError(null);
    setSubmitting(false);
  }, [open, orderId]);

  const noteRequired = reason === 'OTHER';
  const canSubmit =
    Boolean(order) &&
    Boolean(reason) &&
    !submitting &&
    (!noteRequired || note.trim().length >= 3);

  async function submit() {
    if (!order || !reason || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await postJson<CancelOrderResult>(
        `/api/student/orders/${encodeURIComponent(order.id)}/cancel`,
        { reason, note: note.trim() || undefined },
      );
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(24);
      }
      onCancelled(result);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Imeshindikana kughairi order. Jaribu tena.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hero = order?.items[0];

  return (
    <Dialog
      open={open && Boolean(order)}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Ghairi coupon • Cancel order
          </p>
          <DialogTitle>Ghairi order hii?</DialogTitle>
          <DialogDescription>
            {order ? `${order.vendor.name} • ${order.reference}` : 'Coupon yako inasubiri vendor.'}
          </DialogDescription>
        </DialogHeader>

        {order ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <FoodThumb
              imageUrl={hero?.imageUrl}
              name={hero?.name ?? 'Meal'}
              className="h-11 w-11 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">
                {hero?.name ?? 'Meal coupon'}
                {order.itemCount > 1 ? ` +${order.itemCount - 1}` : ''}
              </p>
              <p className="text-[10px] text-slate-400">
                {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} •{' '}
                {order.vendor.code}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular text-slate-900">
              {formatTZS(order.total)}
            </p>
          </div>
        ) : null}

        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-900"
          role="status"
        >
          <span className="font-semibold">
            {order ? `${formatTZS(order.total)} itarudi kwenye wallet yako mara moja.` : null}
          </span>{' '}
          Coupon hii haitafanya kazi tena na vendor hawezi ku-verify. Ghairi huwezi kutengua.
        </div>

        <div className="space-y-2">
          <p id="cancel-reason-label" className="text-xs font-semibold text-slate-800">
            Sababu • Why are you cancelling?
          </p>
          <div
            role="radiogroup"
            aria-labelledby="cancel-reason-label"
            className="space-y-2"
          >
            {REASON_OPTIONS.map((option) => {
              const selected = reason === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-primary-500/40',
                    selected
                      ? 'border-primary-400 bg-primary-50/70 ring-1 ring-primary-300'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={option.value}
                    checked={selected}
                    onChange={() => {
                      setReason(option.value);
                      setError(null);
                    }}
                    disabled={submitting}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      selected
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-300 bg-white',
                    )}
                  >
                    {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-900">
                      {option.label}
                    </span>
                    <span className="block text-[10px] text-slate-500">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {noteRequired ? (
          <div className="space-y-1.5">
            <Label htmlFor="cancel-order-note">
              Tuambie zaidi <span className="text-slate-400">(lazima)</span>
            </Label>
            <Textarea
              id="cancel-order-note"
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
              placeholder="Mfano: niliagiza chakula kibaya, nilitaka kula mahali pengine…"
              maxLength={NOTE_MAX}
              disabled={submitting}
              className="min-h-[76px]"
            />
            <p className="text-right text-[10px] tabular text-slate-400">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        ) : null}

        {error ? (
          <Alert variant="danger" title="Ghairi haikufanikiwa">
            {error}
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-11"
          >
            Rudi • Keep coupon
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            loading={submitting}
            disabled={!canSubmit}
            className="h-11"
          >
            {!submitting ? <XCircle aria-hidden /> : null}
            Ghairi order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

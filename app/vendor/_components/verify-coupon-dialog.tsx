'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  KeyRound,
  Loader2,
  QrCode,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FoodThumb } from '@/components/orders/food-thumb';
import { ApiClientError, postJson } from '@/lib/client-api';
import { parseCouponQr } from '@/lib/orders/qr-payload';
import { displayName, formatDateTime, formatTZS } from '@/lib/utils';
import type { OrderView } from '@/lib/orders/types';
import { toast } from 'sonner';
import { CameraScanner } from './camera-scanner';

type VerifyMode = 'code' | 'scan';

const ERROR_HINTS: Record<string, string> = {
  INVALID_COUPON: 'The coupon QR is invalid or expired. Ask the student to reopen their coupon.',
  NOT_FOUND:
    'No order matches that coupon. Double-check the 6 digits shown on the student’s phone.',
  CONFLICT:
    'This coupon may already be verified at another till. Check the student’s coupon status.',
  FORBIDDEN: 'This coupon belongs to another vendor or university.',
  RATE_LIMITED: 'Too many attempts. Wait a moment, then try again.',
};

const CONFETTI = [
  { left: '8%', drift: '-26px', spin: '-220deg', delay: '0ms', color: '#10B981' },
  { left: '21%', drift: '20px', spin: '180deg', delay: '60ms', color: '#FBBF24' },
  { left: '34%', drift: '-18px', spin: '300deg', delay: '120ms', color: '#34D399' },
  { left: '47%', drift: '26px', spin: '-160deg', delay: '30ms', color: '#F97316' },
  { left: '60%', drift: '-22px', spin: '240deg', delay: '90ms', color: '#0EA5E9' },
  { left: '73%', drift: '24px', spin: '-260deg', delay: '150ms', color: '#10B981' },
  { left: '86%', drift: '-16px', spin: '200deg', delay: '45ms', color: '#FBBF24' },
  { left: '94%', drift: '14px', spin: '-180deg', delay: '100ms', color: '#34D399' },
];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden" aria-hidden>
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              left: piece.left,
              background: piece.color,
              animationDelay: piece.delay,
              '--drift': piece.drift,
              '--spin': piece.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function OrderSummaryMini({ order }: { order: OrderView }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <FoodThumb
        imageUrl={order.items[0]?.imageUrl}
        name={order.items[0]?.name ?? 'Meal'}
        className="h-12 w-12"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {displayName(order.student.name)}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {order.student.studentId} • {order.itemCount}{' '}
          {order.itemCount === 1 ? 'item' : 'items'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-sm font-semibold text-slate-900">{formatTZS(order.total)}</p>
        <p className="font-mono text-[10px] text-slate-400">{order.reference}</p>
      </div>
    </div>
  );
}

function VerifiedCelebration({ order, message }: { order: OrderView; message: string }) {
  return (
    <div className="relative">
      <Confetti />
      <div className="relative flex flex-col items-center pt-2 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/40" />
          <svg viewBox="0 0 52 52" className="relative h-16 w-16 text-emerald-600" fill="none" aria-hidden>
            <circle cx="26" cy="26" r="23" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
            <path
              className="animate-check-draw"
              d="M15 27.5l7.5 7.5L37 19"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="stamp-in absolute -right-4 -top-1 rounded-md border-2 border-emerald-600 bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
            Verified
          </span>
        </div>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Malipo yamekamilika
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Coupon verified
        </h3>
        <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-slate-500">{message}</p>

        <dl className="mt-4 w-full space-y-2 rounded-xl border border-slate-200 bg-white/80 p-3.5 text-left">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] text-slate-500">Student</dt>
            <dd className="text-xs font-semibold text-slate-800">{displayName(order.student.name)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] text-slate-500">Reference</dt>
            <dd className="font-mono text-[11px] text-slate-600">{order.reference}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] text-slate-500">Hand over</dt>
            <dd className="text-xs font-semibold text-slate-800">
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} ·{' '}
              {formatTZS(order.total)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] text-slate-500">Verified at</dt>
            <dd className="text-[11px] text-slate-600">
              {order.verifiedAt ? formatDateTime(order.verifiedAt) : 'Just now'}
            </dd>
          </div>
        </dl>

        <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Single-use coupon — the order payment is recorded before the coupon is issued.
        </p>
      </div>
    </div>
  );
}

/**
 * Verify the meal coupon shown on the student's phone.
 * - code mode: `POST /api/vendor/orders/[id]/verify` with `{ code }`
 *   (or `/orders/scan/verify` with `{ code }` when opened from the header).
 * - scan mode: `POST /api/vendor/orders/scan/verify` with `{ token }`.
 * The success view is a celebratory, animated confirmation.
 */
export function VerifyCouponDialog({
  open,
  onOpenChange,
  order,
  initialMode = 'code',
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderView | null;
  initialMode?: VerifyMode;
  onVerified: (order: OrderView, message: string) => void;
}) {
  const [mode, setMode] = useState<VerifyMode>(order ? initialMode : 'scan');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [verifiedOrder, setVerifiedOrder] = useState<OrderView | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [scanKey, setScanKey] = useState(0);
  const hasOrder = Boolean(order);
  const orderId = order?.id;

  useEffect(() => {
    if (!open) return;
    setMode(hasOrder ? initialMode : 'scan');
    setCode('');
    setBusy(false);
    setError(null);
    setErrorCode(null);
    setVerifiedOrder(null);
    setSuccessMessage('');
    setScanKey(0);
  }, [open, orderId, hasOrder, initialMode]);

  async function submit(payload: { code?: string; token?: string }, fromScan = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);

    // A scanned token discovers its own order; a typed code verifies the order
    // the vendor opened (or the global scan route when opened from the header).
    const url =
      order && payload.code
        ? `/api/vendor/orders/${order.id}/verify`
        : '/api/vendor/orders/scan/verify';

    try {
      const result = await postJson<{ order: OrderView; message: string }>(url, payload);
      setVerifiedOrder(result.order);
      setSuccessMessage(result.message);
      onVerified(result.order, result.message);
      toast.success('Coupon verified', { description: result.message });
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'We could not verify this coupon. Try again.';
      const apiCode = cause instanceof ApiClientError ? cause.code : null;
      setError(message);
      setErrorCode(apiCode);
      toast.error(message);
      if (fromScan) setScanKey((current) => current + 1);
    } finally {
      setBusy(false);
    }
  }

  function submitCode() {
    if (code.length !== 6) {
      setError('Enter the 6-digit coupon code shown on the student’s phone.');
      setErrorCode(null);
      return;
    }
    void submit({ code });
  }

  const hint = errorCode ? ERROR_HINTS[errorCode] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {verifiedOrder ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Coupon verified</DialogTitle>
              <DialogDescription>
                The coupon has been redeemed and the student can collect their meal.
              </DialogDescription>
            </DialogHeader>
            <VerifiedCelebration order={verifiedOrder} message={successMessage} />
            <DialogFooter>
              <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                <Check className="h-4 w-4" />
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{order ? 'Verify coupon' : 'Verify a coupon'}</DialogTitle>
              <DialogDescription>
                {order
                  ? 'Ask the student for the 6-digit code on their coupon, or scan their coupon QR.'
                  : 'Scan the coupon QR on the student’s phone, or type their 6-digit coupon code.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {order ? <OrderSummaryMini order={order} /> : null}

              <Tabs value={mode} onValueChange={(value) => setMode(value as VerifyMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="code">
                    <KeyRound className="mr-1.5 h-4 w-4" />
                    6-digit code
                  </TabsTrigger>
                  <TabsTrigger value="scan">
                    <ScanLine className="mr-1.5 h-4 w-4" />
                    Scan QR
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === 'code' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-code">Coupon code from the student</Label>
                  <Input
                    id="coupon-code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setError(null);
                      setErrorCode(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitCode();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    className="tabular h-14 pl-[0.5em] text-center text-2xl font-semibold tracking-[0.5em]"
                    error={Boolean(error) && code.length > 0}
                  />
                  <p className="text-[11px] text-slate-500">
                    6 digits • the student sees them under their coupon QR.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <CameraScanner
                    key={scanKey}
                    active={!busy}
                    onResult={(value) => {
                      const code = parseCouponQr(value);
                      void submit(code ? { code } : { token: value }, true);
                    }}
                    onManualFallback={() => setMode('code')}
                  />
                  {busy ? (
                    <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-medium text-sky-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying coupon…
                    </div>
                  ) : null}
                </div>
              )}

              {error ? (
                <Alert variant="danger" title="Coupon not verified">
                  {error}
                  {hint ? <span className="mt-1 block text-[11px] opacity-80">{hint}</span> : null}
                </Alert>
              ) : null}

              {mode === 'code' && !error ? (
                <Alert variant="info">
                  Never type a code for a student — they must show the coupon on their own phone.
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              {mode === 'code' ? (
                <Button onClick={submitCode} loading={busy} disabled={code.length !== 6}>
                  <QrCode className="h-4 w-4" />
                  Verify coupon
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

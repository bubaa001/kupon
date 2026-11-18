'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import type { OrderStatus, OrderView } from '@/lib/orders/types';
import { couponQrValue } from '@/lib/orders/qr-payload';
import { FoodThumb } from './food-thumb';

const STATUS: Record<
  OrderStatus,
  {
    label: string;
    short: string;
    tone: string;
    dot: string;
    description: string;
  }
> = {
  PAYMENT_PENDING: {
    label: 'Payment pending',
    short: 'Payment pending',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    description:
      'Kupon is confirming the test payment automatically. No mobile-money request or real charge is made.',
  },
  PAYMENT_FAILED: {
    label: 'Payment not confirmed',
    short: 'Not paid',
    tone: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
    description: 'The test payment was not confirmed, so this order cannot be collected.',
  },
  AWAITING_ACCEPTANCE: {
    label: 'Waiting for cafeteria',
    short: 'Waiting for cafeteria',
    tone: 'border-sky-200 bg-sky-50 text-sky-800',
    dot: 'bg-sky-500',
    description:
      'Payment is confirmed. The cafeteria is checking availability; your coupon appears as soon as they accept.',
  },
  AWAITING_PAYMENT: {
    label: 'Approved — payment needed',
    short: 'Pay now',
    tone: 'border-primary-200 bg-primary-50 text-primary-800',
    dot: 'bg-primary-500',
    description: 'The cafeteria accepted your order. Complete payment to receive your coupon.',
  },
  EXPIRED: {
    label: 'Coupon expired',
    short: 'Expired',
    tone: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    description: 'This coupon has expired and can no longer be collected.',
  },
  PENDING: {
    label: 'Waiting for vendor',
    short: 'Ready to collect',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    description: 'Show this coupon at the counter. The vendor will verify it before handing over your meal.',
  },
  VERIFIED: {
    label: 'Coupon verified',
    short: 'Collected',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
    description: 'The vendor has verified this coupon. Collect your meal and enjoy!',
  },
  CANCELLED: {
    label: 'Coupon cancelled',
    short: 'Cancelled',
    tone: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    description: 'This order was cancelled. Contact the cafeteria if you need help.',
  },
};

function Confetti() {
  const pieces = [
    { left: '10%', drift: '-28px', spin: '-220deg', delay: '0ms', color: '#10B981' },
    { left: '18%', drift: '22px', spin: '180deg', delay: '60ms', color: '#FBBF24' },
    { left: '27%', drift: '-18px', spin: '300deg', delay: '120ms', color: '#34D399' },
    { left: '36%', drift: '30px', spin: '-160deg', delay: '30ms', color: '#F97316' },
    { left: '45%', drift: '-24px', spin: '240deg', delay: '90ms', color: '#0EA5E9' },
    { left: '54%', drift: '26px', spin: '-260deg', delay: '150ms', color: '#10B981' },
    { left: '63%', drift: '-30px', spin: '200deg', delay: '45ms', color: '#FBBF24' },
    { left: '72%', drift: '18px', spin: '-180deg', delay: '100ms', color: '#34D399' },
    { left: '81%', drift: '-14px', spin: '260deg', delay: '20ms', color: '#F97316' },
    { left: '90%', drift: '24px', spin: '-220deg', delay: '130ms', color: '#10B981' },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden" aria-hidden>
      {pieces.map((piece, index) => (
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

export function FoodCoupon({
  order,
  onNewOrder,
  compact = false,
}: {
  order: OrderView;
  onNewOrder?: () => void;
  compact?: boolean;
}) {
  const previousStatus = useRef<OrderStatus | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const status = STATUS[order.status] ?? STATUS.PENDING;

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = order.status;
    if (previous === 'PENDING' && order.status === 'VERIFIED') {
      setCelebrate(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 40, 90]);
      }
      const timer = window.setTimeout(() => setCelebrate(false), 2200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [order.status]);

  const buyerLabel = order.student.studentId.startsWith('GUEST-')
    ? order.student.name
    : `${order.student.name} · ${order.student.studentId}`;

  return (
    <article
      className={cn('relative mx-auto w-full max-w-md animate-coupon-in', compact && 'max-w-sm')}
      aria-label={`Meal coupon ${order.reference}`}
    >
      {celebrate ? <Confetti /> : null}

      <div className="relative overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-lift">
        {/* Header: where and for whom. */}
        <div className="relative bg-navy px-5 pb-4 pt-4 text-white">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
                Meal coupon
              </p>
              <h2 className="mt-1 truncate text-xl font-medium tracking-[-0.03em]">{order.vendor.name}</h2>
              <p className="mt-0.5 truncate text-xs text-navy-300">{buyerLabel}</p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                order.status === 'VERIFIED' ? 'bg-white/10 text-white' : 'bg-gold text-navy',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  order.status === 'VERIFIED' ? 'bg-primary-400' : 'animate-pulse bg-navy',
                )}
                aria-hidden
              />
              {status.short}
            </span>
          </div>
        </div>

        {/* The part staff need: QR and code, first and large. */}
        <div className="flex flex-col items-center px-5 pb-2 pt-5">
          {order.status === 'PENDING' ? (
            <>
              <div className="rounded-2xl border border-navy/10 bg-white p-2">
                <QRCodeSVG
                  value={couponQrValue(order.couponCode)}
                  size={compact ? 200 : 232}
                  level="Q"
                  marginSize={2}
                  bgColor="#FFFFFF"
                  fgColor="#0A1730"
                  title="Kupon coupon QR"
                />
              </div>
              <div className="mt-4 flex gap-1.5" aria-label={`Coupon code ${order.couponCode}`}>
                {order.couponCode.split('').map((digit, index) => (
                  <span
                    key={index}
                    className="flex h-12 w-10 items-center justify-center rounded-lg border border-navy/15 bg-paper text-2xl font-semibold tabular text-navy"
                  >
                    {digit}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-ink-muted">
                Show this at the counter. Staff scan the QR or type the code.
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Clock3 className="h-3 w-3" aria-hidden />
                Valid until {formatDateTime(order.expiresAt)}
              </p>
            </>
          ) : order.status === 'VERIFIED' ? (
            <div className="stamp-in flex flex-col items-center gap-2 py-4 text-primary-700">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary-600">
                <Check className="h-11 w-11" strokeWidth={3.2} aria-hidden />
              </span>
              <span className="text-sm font-semibold">Collected. Enjoy your meal.</span>
              {order.verifiedAt ? (
                <span className="text-[11px] text-ink-muted">{formatDateTime(order.verifiedAt)}</span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-ink-muted">
              <Clock3 className="h-8 w-8" aria-hidden />
              <p className="text-sm font-semibold text-navy">{status.label}</p>
              <p className="max-w-[16rem] text-xs leading-relaxed">{status.description}</p>
            </div>
          )}
        </div>

        {/* Perforation */}
        <div className="relative my-4 h-px border-t border-dashed border-navy/15">
          <span className="coupon-notch -left-3.5" />
          <span className="coupon-notch -right-3.5" />
        </div>

        {/* What was ordered. */}
        <div className="px-5 pb-5">
          <ul className="space-y-2.5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <FoodThumb imageUrl={item.imageUrl} name={item.name} className="h-11 w-11 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{item.name}</p>
                  <p className="text-[11px] text-ink-muted">
                    {formatTZS(item.price)} × {item.quantity}
                  </p>
                </div>
                <span className="tabular text-sm font-semibold text-navy">
                  {formatTZS(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          {order.note ? (
            <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs text-ink-muted">
              <span className="font-semibold text-navy">Note:</span> {order.note}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-between border-t border-navy/[0.08] pt-3 text-sm">
            <span className="text-ink-muted">{order.amountPaid > 0 ? 'You paid' : 'Food total'}</span>
            <span className="font-semibold tabular text-navy">
              {formatTZS(order.amountPaid > 0 ? order.amountPaid : order.total)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
              Single use · {order.reference}
            </p>
            {onNewOrder ? (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-navy-50 px-3 text-xs font-semibold text-navy transition-colors hover:bg-navy-100"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                New order
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

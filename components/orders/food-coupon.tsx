'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  ShieldCheck,
  Sparkles,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
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
  PENDING: {
    label: 'Waiting for vendor',
    short: 'Pending',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    description: 'Show this coupon at the counter. The vendor will verify it before handing over your meal.',
  },
  VERIFIED: {
    label: 'Coupon verified',
    short: 'Verified',
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
  const hero = order.items[0];
  const itemLabel =
    order.itemCount > 1 ? `${order.itemCount} items` : `${order.items[0]?.quantity ?? 1} item`;

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

  return (
    <article
      className={cn(
        'relative mx-auto w-full max-w-md animate-coupon-in',
        compact && 'max-w-sm',
      )}
      aria-label={`Meal coupon ${order.reference}`}
    >
      {celebrate ? <Confetti /> : null}

      <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-lift">
        {/* Header */}
        <div className="relative overflow-hidden bg-navy px-5 pb-5 pt-4 text-white">
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_0.7px,transparent_0.7px)] bg-[length:18px_18px] opacity-60" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/20 text-primary-300">
                <UtensilsCrossed className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-300">
                  Kupon meal coupon
                </p>
                <p className="text-[11px] font-medium text-slate-300">{order.reference}</p>
              </div>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold',
                order.status === 'VERIFIED'
                  ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
                  : 'border-amber-300/30 bg-amber-400/15 text-amber-200',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  order.status === 'VERIFIED' ? 'bg-emerald-300' : 'animate-pulse bg-amber-300',
                )}
              />
              {status.short}
            </span>
          </div>

          <div className="relative mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                <Store className="h-3 w-3" />
                {order.vendor.code}
              </p>
              <h2 className="mt-1 truncate text-2xl font-semibold tracking-[-0.035em]">
                {order.vendor.name}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                {order.student.name} • {order.student.studentId}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400">Total paid</p>
              <p className="mt-1 text-lg font-semibold tabular text-emerald-300">
                {formatTZS(order.total)}
              </p>
            </div>
          </div>
        </div>

        {/* Hero food image */}
        <div className="relative px-5 pt-4">
          <div className="relative h-40 overflow-hidden rounded-2xl bg-slate-100">
            {hero?.imageUrl ? (
              <img
                src={hero.imageUrl}
                alt={hero.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-emerald-100">
                <UtensilsCrossed className="h-10 w-10 text-amber-900/25" aria-hidden />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
            <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                  {itemLabel}
                </p>
                <p className="truncate text-base font-semibold text-white">
                  {order.items.map((item) => item.name).join(' · ')}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                {order.status === 'VERIFIED' ? 'Collected soon' : 'Show at counter'}
              </span>
            </div>
          </div>
        </div>

        {/* Item list */}
        <div className="px-5 pt-4">
          <ul className="space-y-2.5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <FoodThumb
                  imageUrl={item.imageUrl}
                  name={item.name}
                  className="h-10 w-10 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {formatTZS(item.price)} × {item.quantity}
                  </p>
                </div>
                <span className="tabular text-xs font-semibold text-slate-700">
                  {formatTZS(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          {order.note ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Note: {order.note}
            </p>
          ) : null}
        </div>

        {/* Perforation */}
        <div className="relative my-4 h-px border-t border-dashed border-slate-200">
          <span className="coupon-notch -left-3.5" />
          <span className="coupon-notch -right-3.5" />
        </div>

        {/* Coupon code + QR */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Coupon ID
              </p>
              <p className="mt-0.5 font-mono text-[10px] font-medium text-slate-500">
                {order.reference}
              </p>
            </div>
            <p className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400">
              <Clock3 className="h-3 w-3" />
              Valid until {formatDateTime(order.expiresAt)}
            </p>
          </div>

          <div className="mt-3 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
            {order.status === 'PENDING' ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <QRCodeSVG
                    value={couponQrValue(order.couponCode)}
                    size={224}
                    level="Q"
                    marginSize={4}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    title="Kupon coupon QR"
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Vendor scans this QR, or enters the 6-digit code below.
                </p>
              </>
            ) : (
              <div
                className={cn(
                  'flex h-[184px] w-[184px] items-center justify-center rounded-xl border',
                  order.status === 'VERIFIED'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-white',
                )}
              >
                {order.status === 'VERIFIED' ? (
                  <div className="stamp-in flex flex-col items-center gap-2 text-emerald-700">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-600">
                      <Check className="h-9 w-9" strokeWidth={3.4} />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
                      Verified
                    </span>
                  </div>
                ) : (
                  <span className="px-5 text-center text-[11px] leading-relaxed text-slate-400">
                    This coupon is no longer active.
                  </span>
                )}
              </div>
            )}

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Or give this 6-digit code to the vendor
            </p>
            <div className="mt-1.5 flex gap-1.5" aria-label={`Coupon code ${order.couponCode}`}>
              {order.couponCode.split('').map((digit, index) => (
                <span
                  key={index}
                  className="flex h-10 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold tabular text-slate-900 shadow-sm"
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'mt-4 flex items-start gap-2.5 rounded-xl border p-3',
              status.tone,
            )}
            role="status"
          >
            <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
              {order.status === 'VERIFIED' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <>
                  <span className={cn('absolute h-2.5 w-2.5 rounded-full opacity-40', status.dot)} />
                  <span className={cn('relative h-2 w-2 animate-ping rounded-full opacity-70', status.dot)} />
                  <span className={cn('absolute h-2 w-2 rounded-full', status.dot)} />
                </>
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold">{status.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">{status.description}</p>
            </div>
          </div>

          {/* Status timeline */}
          <div className="mt-4 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em]">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={4} />
              </span>
              Paid
            </span>
            <span className="h-px flex-1 bg-slate-200" />
            <span
              className={cn(
                'flex items-center gap-1',
                order.status === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-600',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-white',
                  order.status === 'VERIFIED' ? 'bg-emerald-600' : 'bg-amber-500',
                )}
              >
                {order.status === 'VERIFIED' ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={4} />
                ) : (
                  <Clock3 className="h-2.5 w-2.5" />
                )}
              </span>
              Verified
            </span>
            <span className="h-px flex-1 bg-slate-200" />
            <span className="flex items-center gap-1 text-slate-400">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                <ChefHat className="h-2.5 w-2.5" />
              </span>
              Enjoy
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Single-use coupon • {order.vendor.name}
            </p>
            {onNewOrder ? (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-primary-50 px-3 text-[11px] font-bold text-primary-700 transition-colors hover:bg-primary-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                New order
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Ticket,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatTZS } from '@/lib/utils';
import type { OrderView } from '@/lib/orders/types';
import { QuartettCouponCard } from './quartett-coupon-card';

/** How many quartett cards are visible in the fan at once. */
const MAX_FAN = 3;
const CARD_STEP_X = 36;
const CARD_STEP_Y = 4;

function fanTransform(position: number): string {
  const rotate = position === 0 ? -2.5 : 2 + position * 2.4;
  return `translate3d(${position * CARD_STEP_X}px, ${position * CARD_STEP_Y}px, 0) rotate(${rotate}deg)`;
}

function FanSkeleton() {
  return (
    <div className="relative mx-auto h-[320px] w-[292px]" aria-hidden role="presentation">
      {[2, 1, 0].map((position) => (
        <div
          key={position}
          className="absolute left-0 top-0 h-[304px] w-[214px] overflow-hidden rounded-[14px] border border-slate-200 bg-white"
          style={{
            transform: fanTransform(position),
            transformOrigin: 'bottom left',
            zIndex: 30 - position * 10,
          }}
        >
          <div className="skeleton-shimmer mx-2.5 mt-2 h-[146px] rounded-[7px]" />
          <div className="mt-2 space-y-2 px-2.5">
            <div className="skeleton-shimmer h-3 w-4/5 rounded-full" />
            <div className="skeleton-shimmer h-2.5 w-3/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The pending coupon "hand": overlapping quartett cards, exactly like a stack of
 * collectible cards. The selected card sits in front; tapping a peeking card (or
 * the arrows) brings it forward. Actions below open the expanded coupon or
 * cancel that order. A single pending card simply renders as itself.
 */
export function PendingOrderDeck({
  orders,
  loading = false,
  error = null,
  onRetry,
  onOpen,
  onCancel,
  cancelingId = null,
}: {
  orders: OrderView[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (order: OrderView) => void;
  onCancel: (order: OrderView) => void;
  cancelingId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Finger/mouse swipe: the hand follows the finger a little, then the next card
  // comes to the front. Vertical scroll always wins so the page stays usable.
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
    pointerId: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setSelectedId((current) => {
      if (current && orders.some((order) => order.id === current)) return current;
      return orders[0]?.id ?? null;
    });
  }, [orders]);

  const activeIndex = Math.max(
    0,
    orders.findIndex((order) => order.id === selectedId),
  );
  const active = orders[activeIndex] ?? orders[0] ?? null;

  // Front card first, then the following cards behind it. Wraps when the user
  // steps past the last order and never repeats a card.
  const fan: OrderView[] = [];
  for (let step = 0; step < orders.length && fan.length < MAX_FAN; step += 1) {
    const candidate = orders[(activeIndex + step) % orders.length];
    if (!fan.some((order) => order.id === candidate.id)) fan.push(candidate);
  }

  function shift(direction: 1 | -1) {
    if (orders.length < 2) return;
    const nextIndex = (activeIndex + direction + orders.length) % orders.length;
    setSelectedId(orders[nextIndex].id);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      pointerId: event.pointerId,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.axis) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        // A vertical gesture is a page scroll, never a card swipe.
        drag.axis = 'y';
        return;
      }
      drag.axis = 'x';
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events cannot capture; the gesture still works.
      }
    }
    if (drag.axis !== 'x') return;
    suppressClickRef.current = Math.abs(dx) > 6;
    setDragX(Math.max(-26, Math.min(26, dx * 0.35)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - drag.startX;
    if (drag.axis === 'x' && Math.abs(dx) > 40) {
      shift(dx < 0 ? 1 : -1);
      // The swipe should never also register as a tap on a card underneath.
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 320);
    } else if (drag.axis !== 'x') {
      suppressClickRef.current = false;
    }
    setDragX(0);
  }

  function cancelDrag() {
    dragRef.current = null;
    setDragX(0);
  }

  return (
    <section aria-labelledby="pending-coupons-heading" className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="pending-coupons-heading"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900"
          >
            <Ticket className="h-4 w-4 text-amber-600" aria-hidden />
            Coupons zinazosubiri
            {orders.length > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">
                {orders.length}
              </span>
            ) : null}
            {loading && orders.length > 0 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />
            ) : null}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {orders.length > 1
              ? 'Telezesha kadi kwa kidole (au tumia vishale) kuchagua, kisha onyesha coupon kwa vendor au ghairi order.'
              : 'Onyesha coupon kwa vendor, au ghairi kabla ya ku-verify kupata refund kwenye wallet.'}
          </p>
        </div>
        {error && orders.length > 0 && onRetry ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onRetry}>
            <RefreshCcw aria-hidden />
            Jaribu
          </Button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-relaxed text-red-800"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Coupons hazikupakiwa</p>
            <p className="mt-0.5">{error}</p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-red-700 underline underline-offset-2 hover:bg-red-100"
            >
              Jaribu tena
            </button>
          ) : null}
        </div>
      ) : loading && orders.length === 0 ? (
        <FanSkeleton />
      ) : orders.length === 0 ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3"
          role="status"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
            <Ticket className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 text-[11px] leading-relaxed text-slate-500">
            <span className="block text-xs font-semibold text-slate-700">
              Hakuna coupon inayosubiri
            </span>
            Scan QR ya vendor kuanza order mpya. Coupon zako zitaonekana hapa.
          </p>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'relative mx-auto h-[322px] select-none',
              orders.length === 1 ? 'w-[214px]' : 'w-[292px]',
            )}
            role="group"
            aria-label="Coupons zinazosubiri — swipe kadi au chagua"
            style={{
              touchAction: 'pan-y',
              transform: dragX ? `translateX(${dragX}px)` : undefined,
              transition: dragX ? 'none' : 'transform 200ms ease-out',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
          >
            {fan.map((order, position) => {
              const isFront = position === 0;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    // A horizontal swipe must not also open/select the card.
                    if (suppressClickRef.current) return;
                    if (isFront) onOpen(order);
                    else setSelectedId(order.id);
                  }}
                  aria-current={isFront ? 'true' : undefined}
                  aria-label={
                    isFront
                      ? `Fungua coupon ya ${order.vendor.name}, ${formatTZS(order.total)}`
                      : `Chagua coupon ya ${order.vendor.name}, ${formatTZS(order.total)}`
                  }
                  className="absolute left-0 top-0 h-[304px] w-[214px] rounded-[14px] text-left outline-none transition-transform duration-300 ease-out focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2"
                  style={{
                    zIndex: 30 - position * 10,
                    transform: fanTransform(position),
                    transformOrigin: 'bottom left',
                  }}
                >
                  <QuartettCouponCard order={order} active={isFront} />
                </button>
              );
            })}
          </div>

          {orders.length > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => shift(-1)}
                aria-label="Coupon iliyotangulia"
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p
                className="min-w-[86px] text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                aria-live="polite"
              >
                Kadi {activeIndex + 1} / {orders.length}
              </p>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => shift(1)}
                aria-label="Coupon inayofuata"
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-11 text-xs"
              onClick={() => active && onOpen(active)}
              disabled={!active}
              aria-label={`Onyesha coupon ya ${active?.vendor.name ?? 'coupon'}`}
            >
              <Ticket aria-hidden />
              Onyesha coupon
            </Button>
            <Button
              variant="outline"
              className="h-11 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => active && onCancel(active)}
              disabled={!active || (active ? cancelingId === active.id : false)}
              aria-label={`Ghairi order ${active?.reference ?? ''}`}
            >
              {active && cancelingId === active.id ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <XCircle aria-hidden />
              )}
              Ghairi order
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

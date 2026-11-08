'use client';

import { useEffect, useState } from 'react';
import { FoodImage } from '@/components/food/food-image';
import { cn, formatDate, formatTime, formatTZS } from '@/lib/utils';
import type { OrderView } from '@/lib/orders/types';

/**
 * One PENDING coupon drawn as a collectible quartett card: small caps header,
 * big food photo, huge dish name beside a tiny metadata table, and a clear
 * amber pending state. Purely presentational — the surrounding fan owns the
 * interaction (select / open).
 */
export function QuartettCouponCard({
  order,
  active = false,
  className,
}: {
  order: OrderView;
  active?: boolean;
  className?: string;
}) {
  const hero = order.items[0];
  const expiredAt = useExpired(order.expiresAt);
  const expired = order.status === 'PENDING' && expiredAt;
  const awaitingAcceptance = order.status === 'AWAITING_ACCEPTANCE';
  const extraItems = Math.max(0, order.itemCount - 1);

  return (
    <article
      className={cn(
        'relative flex h-[304px] w-[214px] flex-col overflow-hidden rounded-[14px] border border-slate-300/80 bg-[#fdfcf8] text-slate-900',
        active
          ? 'shadow-[0_22px_48px_-16px_rgba(15,23,42,0.45)]'
          : 'shadow-[0_10px_24px_-14px_rgba(15,23,42,0.35)]',
        className,
      )}
    >
      {/* Quartett masthead */}
      <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-900">
          Kupon quartett
        </p>
        <span className="flex items-center gap-[3px]" aria-hidden>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              expired ? 'bg-slate-300' : 'bg-amber-500',
            )}
          />
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              expired ? 'bg-slate-300' : 'bg-amber-400',
            )}
          />
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              expired ? 'bg-slate-300' : 'bg-amber-300',
            )}
          />
        </span>
      </div>

      {/* Food photo */}
      <div className="relative mx-2.5 h-[146px] overflow-hidden rounded-[7px] bg-[#171008]">
        <FoodImage
          src={hero?.imageUrl}
          name={hero?.name ?? 'Meal'}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/20" />
        {extraItems > 0 ? (
          <span className="absolute right-1.5 top-1.5 rounded-full border border-white/25 bg-black/50 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-md">
            +{extraItems}
          </span>
        ) : null}
        <span className="absolute bottom-1.5 left-1.5">
          <StatusChip expired={expired} awaitingAcceptance={awaitingAcceptance} />
        </span>
      </div>

      {/* Name + tiny metadata table, quartett style */}
      <div className="flex flex-1 gap-2 px-2.5 pt-2">
        <div className="flex w-[45%] flex-col border-r border-slate-300/80 pr-2">
          <p className="text-[6.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {awaitingAcceptance ? 'Meal request' : 'Meal coupon'}
          </p>
          <p className="mt-0.5 line-clamp-3 text-[15px] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-slate-900">
            {hero?.name ?? 'Coupon'}
          </p>
          <p className="mt-auto pb-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <dl className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <MetaRow label="Tarehe" value={formatDate(order.createdAt, 'dd.MM.yyyy')} />
          <MetaRow label="Muda" value={formatTime(order.createdAt)} />
          <MetaRow label="Ref" value={order.reference.replace('ORD-', '')} mono />
          <MetaRow label="Total" value={formatTZS(order.total)} />
          <MetaRow
            label={awaitingAcceptance ? 'Status' : 'Code'}
            value={awaitingAcceptance ? 'Waiting for cafe' : order.couponCode}
            mono
          />
          <MetaRow label="Vendor" value={order.vendor.code} mono />
        </dl>
      </div>

      {/* Footer */}
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-300/80 px-2.5 py-1.5">
        <p className="truncate text-[7px] font-bold uppercase tracking-[0.1em] text-slate-500">
          {order.vendor.name}
        </p>
        <p
          className={cn(
            'shrink-0 text-[7px] font-bold uppercase tracking-[0.12em]',
            expired ? 'text-red-600' : 'text-amber-700',
          )}
        >
          {expired ? 'Expired' : awaitingAcceptance ? 'Waiting for cafe' : 'Inasubiri'}
        </p>
      </div>
    </article>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-1 border-b border-dashed border-slate-200 pb-[1px] last:border-0">
      <dt className="shrink-0 text-[6.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-[8px] font-semibold text-slate-800',
          mono && 'font-mono text-[7.5px]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusChip({
  expired,
  awaitingAcceptance,
}: {
  expired: boolean;
  awaitingAcceptance: boolean;
}) {
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/80 px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-md">
        <span className="h-1 w-1 rounded-full bg-red-400" aria-hidden />
        Expired
      </span>
    );
  }
  if (awaitingAcceptance) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/60 bg-sky-100/95 px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-sky-950 backdrop-blur-md">
        <span className="h-1 w-1 animate-pulse rounded-full bg-sky-700" aria-hidden />
        Needs acceptance
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-400/95 px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.1em] text-amber-950 backdrop-blur-md">
      <span className="h-1 w-1 animate-pulse rounded-full bg-amber-900" aria-hidden />
      Pending
    </span>
  );
}

/** Client-only clock: keeps SSR and hydration deterministic for the 24h coupon. */
function useExpired(expiresAt: string): boolean {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, [expiresAt]);
  return now !== null && new Date(expiresAt).getTime() <= now;
}

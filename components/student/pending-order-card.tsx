'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FoodImage } from '@/components/food/food-image';
import { cn, formatTZS, formatTime } from '@/lib/utils';
import type { OrderView } from '@/lib/orders/types';

/**
 * The latest PENDING coupon as a photo-led banner on the student home screen.
 * Links to the scan screen, where the full quartett hand of pending coupons and
 * the expanded meal coupon live.
 */
export function PendingOrderCard({
  order,
  openHref,
  className,
}: {
  order: OrderView;
  openHref?: string;
  className?: string;
}) {
  const hero = order.items[0];
  const extraItems = Math.max(0, order.items.length - 1);
  const expired = useExpired(order.expiresAt);

  const body = (
    <div
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-2xl border border-amber-200/90 bg-white shadow-card transition-colors hover:border-amber-300',
        className,
      )}
    >
      <div className="relative w-[104px] shrink-0 overflow-hidden bg-[#171008] sm:w-[132px]">
        <FoodImage
          src={hero?.imageUrl}
          name={hero?.name ?? 'Meal'}
          className="absolute inset-0"
          imageClassName="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
        <span className="absolute left-2 top-2">
          <StatusPill expired={expired} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">
            Coupon inasubiri • {order.vendor.code}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        </div>
        <p className="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-slate-900">
          {hero?.name ?? 'Meal coupon'}
          {extraItems > 0 ? (
            <span className="ml-1 text-xs font-medium text-slate-400">+{extraItems}</span>
          ) : null}
        </p>
        <p className="truncate text-[11px] text-slate-500">{order.vendor.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Umelipa
            </p>
            <p className="tabular text-sm font-semibold text-slate-900">{formatTZS(order.total)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium text-slate-500">{formatTime(order.createdAt)}</p>
            <p
              className={cn(
                'text-[9px] font-semibold uppercase tracking-[0.1em]',
                expired ? 'text-red-600' : 'text-amber-700',
              )}
            >
              {expired ? 'Expired' : 'Inasubiri vendor'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (openHref) {
    return (
      <Link
        href={openHref}
        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2"
        aria-label={`Fungua coupon ya ${order.vendor.name}, ${formatTZS(order.total)}`}
      >
        {body}
      </Link>
    );
  }
  return body;
}

function StatusPill({ expired }: { expired: boolean }) {
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-slate-900/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-400/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-950 backdrop-blur-md">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-900" aria-hidden />
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

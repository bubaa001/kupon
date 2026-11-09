'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FoodThumb } from '@/components/orders/food-thumb';
import {
  Clock3,
  Check,
  KeyRound,
  PackageX,
  ScanLine,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { cn, displayName, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import type { OrderStatus, OrderView } from '@/lib/orders/types';

/**
 * One incoming/verified order at the counter.
 * PENDING cards are amber and pulse gently; VERIFIED cards are emerald.
 * The coupon code itself is never rendered for pending orders — the student
 * must show it (or their QR) so the vendor can't self-verify.
 */
export function OrderCard({
  order,
  isNew,
  animationDelay = 0,
  onEnterCode,
  onScanQr,
  onAcceptRequest,
  onReportUnavailable,
  busy = false,
}: {
  order: OrderView;
  isNew?: boolean;
  animationDelay?: number;
  onEnterCode: (order: OrderView) => void;
  onScanQr: (order: OrderView) => void;
  onAcceptRequest: (order: OrderView) => void;
  onReportUnavailable: (order: OrderView) => void;
  busy?: boolean;
}) {
  const pending = order.status === 'PENDING';
  const awaitingAcceptance = order.status === 'AWAITING_ACCEPTANCE';
  const awaitingPayment = order.status === 'AWAITING_PAYMENT';
  const verified = order.status === 'VERIFIED';
  const hero = order.items[0];

  return (
    <li
      className={cn(
        'animate-order-in card-surface min-w-0 overflow-hidden',
        pending && 'border-amber-200/90 bg-amber-50/30',
        awaitingAcceptance && 'border-sky-200/90 bg-sky-50/30',
        awaitingPayment && 'border-violet-200/90 bg-violet-50/30',
        verified && 'border-emerald-200/80 bg-emerald-50/20',
        order.status === 'CANCELLED' && 'opacity-70',
        isNew && 'ring-2 ring-amber-200/80',
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <FoodThumb
            imageUrl={hero?.imageUrl}
            name={hero?.name ?? 'Meal'}
            className="h-14 w-14"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName(order.student.name)}
                </p>
                <p className="truncate text-[11px] text-slate-500">{order.student.studentId}</p>
              </div>
              <OrderStatusChip status={order.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
              <span className="font-mono">{order.reference}</span>
              <span className="text-slate-300">•</span>
              <span>{relativeTime(order.createdAt)}</span>
            </div>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-slate-700">
                <span className="font-semibold text-slate-900">{item.quantity}×</span> {item.name}
              </span>
              <span className="tabular shrink-0 font-medium text-slate-600">
                {formatTZS(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {order.note ? (
          <p className="mt-2 rounded-lg border border-slate-100 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Note:</span> {order.note}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <UtensilsCrossed className="h-3 w-3" />
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
            </p>
            <p className="tabular mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
              {formatTZS(order.total)}
            </p>
          </div>

          {awaitingAcceptance ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                size="sm"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => onAcceptRequest(order)}
                disabled={busy}
              >
                <Check className="h-3.5 w-3.5" />
                Accept request
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => onReportUnavailable(order)}
                disabled={busy}
              >
                <PackageX className="h-3.5 w-3.5" />
                Food unavailable
              </Button>
            </div>
          ) : null}

          {pending ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button size="sm" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => onEnterCode(order)}>
                <KeyRound className="h-3.5 w-3.5" />
                Enter code
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => onScanQr(order)}
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan QR
              </Button>
            </div>
          ) : null}

          {verified ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified {order.verifiedAt ? formatDateTime(order.verifiedAt) : ''}
            </p>
          ) : null}

          {order.status === 'CANCELLED' ? (
            <p className="text-[11px] font-medium text-slate-500">Cancelled order</p>
          ) : null}
        </div>

        {pending ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-amber-700/90">
            <Clock3 className="h-3 w-3" />
            Coupon valid until {formatDateTime(order.expiresAt)} — ask for the student&apos;s 6-digit
            code or coupon QR.
          </p>
        ) : null}

        {awaitingAcceptance ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-sky-700/90">
            <Clock3 className="h-3 w-3" />
            No payment has been taken. Accept only if the requested food can be prepared.
          </p>
        ) : null}
        {awaitingPayment ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-violet-700/90">
            <Clock3 className="h-3 w-3" />
            Request accepted. The student must pay before a coupon is issued.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function OrderStatusChip({ status }: { status: OrderStatus }) {
  if (status === 'AWAITING_ACCEPTANCE') {
    return (
      <Badge variant="default" dot>
        Needs acceptance
      </Badge>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="animate-status-pulse inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Pending
      </span>
    );
  }
  if (status === 'AWAITING_PAYMENT') {
    return <Badge variant="default" dot>Waiting for payment</Badge>;
  }
  if (status === 'VERIFIED') {
    return (
      <Badge variant="success" dot>
        Verified
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" dot>
      Cancelled
    </Badge>
  );
}

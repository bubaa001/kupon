'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { FoodThumb } from '@/components/orders/food-thumb';
import { FoodCoupon } from '@/components/orders/food-coupon';
import { CafeteriaNoticeAlert } from '@/components/student/cafeteria-notice';
import { orderStatusMeta } from '@/components/student/order-status';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import type { OrderView } from '@/lib/orders/types';
import { formatDateTime, formatTZS } from '@/lib/utils';

/**
 * Everything about one order, opened from history: what was ordered, where,
 * what was paid, the coupon if it can still be collected, and any message
 * from the cafeteria.
 */
export function OrderSheet({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setOrder(null);
    setError(null);
    apiFetch<{ orders: OrderView[] }>(`/api/student/orders?id=${encodeURIComponent(orderId)}`)
      .then((data) => {
        if (!cancelled) setOrder(data.orders[0] ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiClientError ? cause.message : 'This order did not load.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const status = orderStatusMeta(order?.status);
  const subtotal = order ? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0;
  const showCoupon = order && (order.status === 'PENDING' || order.status === 'VERIFIED') && order.couponCode;

  async function copyReference() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.reference);
      toast.success('Order number copied');
    } catch {
      toast.error('Could not copy. Long-press the number instead.');
    }
  }

  return (
    <Dialog open={orderId !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{order ? order.vendor.name : 'Order'}</DialogTitle>
          <DialogDescription>
            {order ? formatDateTime(order.createdAt) : 'Loading order details'}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="danger" title="Order did not load">
            {error}
          </Alert>
        ) : !order ? (
          <div className="space-y-3" role="status" aria-label="Loading order">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Badge variant={status.variant} dot>
                {status.label}
              </Badge>
              <button
                type="button"
                onClick={() => void copyReference()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-mono text-xs text-ink-muted hover:bg-navy-50"
                aria-label={`Copy order number ${order.reference}`}
              >
                {order.reference}
                <Copy className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            {order.cafeteriaNotice ? <CafeteriaNoticeAlert notice={order.cafeteriaNotice} /> : null}
            {order.expiryNote ? (
              <Alert variant="warning" title="Expired at closing time">
                {order.expiryNote}
              </Alert>
            ) : null}

            {showCoupon ? <FoodCoupon order={order} compact /> : null}

            <section aria-label="What you ordered">
              <p className="eyebrow mb-2">What you ordered</p>
              <ul className="divide-y divide-navy/[0.07] rounded-xl border border-navy/[0.09]">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3">
                    <FoodThumb imageUrl={item.imageUrl} name={item.name} className="h-12 w-12 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{item.name}</p>
                      <p className="text-xs text-ink-muted">
                        {formatTZS(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular text-navy">
                      {formatTZS(item.price * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <dl className="space-y-1.5 rounded-xl bg-navy-50/70 p-3 text-sm">
              <Row label="Food" value={formatTZS(subtotal)} />
              {order.creditApplied > 0 ? (
                <Row label="Cafeteria credit used" value={`− ${formatTZS(order.creditApplied)}`} />
              ) : null}
              {order.apiFee > 0 ? <Row label="Payment fee" value={formatTZS(order.apiFee)} /> : null}
              <div className="border-t border-navy/10 pt-1.5">
                <Row
                  label={order.amountPaid > 0 ? 'You paid' : 'To pay'}
                  value={formatTZS(order.amountPaid > 0 ? order.amountPaid : subtotal)}
                  strong
                />
              </div>
            </dl>

            {order.note ? (
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-navy">Your note:</span> {order.note}
              </p>
            ) : null}

            {order.status === 'AWAITING_PAYMENT' || order.status === 'AWAITING_ACCEPTANCE' ? (
              <Button asChild className="w-full">
                <Link href="/student/pay">Open in Order</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/student/pay">
                  <ScanLine aria-hidden />
                  Order again
                </Link>
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold text-navy' : 'text-ink-muted'}>{label}</dt>
      <dd className={strong ? 'font-semibold tabular text-navy' : 'tabular text-navy/80'}>{value}</dd>
    </div>
  );
}

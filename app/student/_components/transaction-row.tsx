import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FoodThumb } from '@/components/orders/food-thumb';
import { dishSummary, orderStatusMeta } from '@/components/student/order-status';
import { STATUS_BADGE } from '@/lib/constants';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import type { StudentTx } from '../_lib/types';

/**
 * One order in the buyer's history, shared by home and history. The whole row
 * is a button: tapping it opens the order sheet with dishes, coupon and payment.
 */
export function TransactionRow({
  tx,
  onOpen,
  className,
}: {
  tx: StudentTx;
  onOpen?: (orderId: string) => void;
  className?: string;
}) {
  const order = tx.order;
  const hero = order?.items[0];
  const status = order
    ? orderStatusMeta(order.status)
    : (STATUS_BADGE[tx.status] ?? { label: tx.status, variant: 'neutral' as const });
  const title = order ? dishSummary(order.items, order.itemCount) : tx.metadataSummary;
  const openable = Boolean(order && onOpen);

  const body = (
    <>
      <FoodThumb
        imageUrl={hero?.imageUrl}
        name={hero?.name ?? 'Meal'}
        className="h-12 w-12 rounded-xl ring-1 ring-navy/[0.06]"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {tx.vendor?.name ?? 'Cafeteria'} · {formatDateTime(tx.createdAt)}
        </p>
        <Badge variant={status.variant} dot className="mt-1.5">
          {status.label}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <p className="text-sm font-semibold tabular text-navy">{formatTZS(tx.amount)}</p>
        {openable ? <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden /> : null}
      </div>
    </>
  );

  if (!openable || !order || !onOpen) {
    return <div className={cn('flex items-center gap-3 py-3', className)}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className={cn(
        '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 active:bg-navy-50',
        className,
      )}
      aria-label={`${title}, ${status.label}, ${formatTZS(tx.amount)}. Open order details`}
    >
      {body}
    </button>
  );
}

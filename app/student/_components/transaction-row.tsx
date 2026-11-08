import { ShoppingBag } from 'lucide-react';
import { TX_TYPE_LABEL } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import type { StudentTx } from '../_lib/types';

/**
 * One transaction row, shared by the home "recent activity" list and history.
 * Mobile first: the secondary line truncates instead of pushing the amount out.
 */
export function TransactionRow({
  tx,
  className,
}: {
  tx: StudentTx;
  className?: string;
}) {
  const subtitle = tx.vendor?.name ?? tx.metadataSummary;

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          'bg-sky-50 text-sky-600',
        )}
        aria-hidden
      >
        <ShoppingBag className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900">
            {TX_TYPE_LABEL[tx.type] ?? tx.type}
          </p>
          <StatusBadge status={tx.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {subtitle}
          {tx.channel ? (
            <>
              <span className="px-1 text-slate-300">•</span>
              {tx.channel}
            </>
          ) : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular',
            'text-slate-900',
          )}
        >
          −
          {formatTZS(tx.amount)}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(tx.createdAt)}</p>
      </div>
    </div>
  );
}

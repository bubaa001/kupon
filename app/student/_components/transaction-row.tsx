import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownLeft,
  Banknote,
  RotateCcw,
  Settings2,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { TX_TYPE_LABEL, type TxType } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import type { StudentTx } from '../_lib/types';

const ICON_MAP: Record<TxType, { icon: LucideIcon; tone: string }> = {
  TOPUP: { icon: ArrowDownLeft, tone: 'bg-emerald-50 text-emerald-600' },
  PAYMENT: { icon: ShoppingBag, tone: 'bg-sky-50 text-sky-600' },
  REFUND: { icon: RotateCcw, tone: 'bg-violet-50 text-violet-600' },
  WITHDRAWAL: { icon: Banknote, tone: 'bg-sky-50 text-sky-600' },
  ADJUSTMENT_CREDIT: { icon: Sparkles, tone: 'bg-emerald-50 text-emerald-600' },
  ADJUSTMENT_DEBIT: { icon: Settings2, tone: 'bg-amber-50 text-amber-600' },
};

const FALLBACK_ICON = { icon: Wallet, tone: 'bg-slate-100 text-slate-500' };

function isIncoming(type: TxType) {
  // Refund rows credit the wallet (order refund or pending-order cancellation).
  // WITHDRAWAL is the outgoing cash-out and must stay negative.
  return type === 'TOPUP' || type === 'ADJUSTMENT_CREDIT' || type === 'REFUND';
}

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
  const meta = ICON_MAP[tx.type] ?? FALLBACK_ICON;
  const Icon = meta.icon;
  const incoming = isIncoming(tx.type);
  const subtitle = tx.vendor?.name ?? tx.metadataSummary;

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          meta.tone,
        )}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" />
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
            incoming ? 'text-emerald-700' : 'text-slate-900',
          )}
        >
          {incoming ? '+' : '−'}
          {formatTZS(tx.amount)}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(tx.createdAt)}</p>
      </div>
    </div>
  );
}

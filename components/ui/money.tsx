import { cn, formatTZS } from '@/lib/utils';

export function Money({
  amount,
  className,
  signed = false,
  tone,
}: {
  amount: number;
  className?: string;
  signed?: boolean;
  tone?: 'auto' | 'neutral' | 'emerald' | 'red';
}) {
  const resolvedTone =
    tone === 'auto' || (!tone && signed)
      ? amount > 0
        ? 'emerald'
        : amount < 0
          ? 'red'
          : 'neutral'
      : tone ?? 'neutral';

  return (
    <span
      className={cn(
        'tabular whitespace-nowrap font-semibold',
        resolvedTone === 'emerald' && 'text-emerald-700',
        resolvedTone === 'red' && 'text-red-600',
        resolvedTone === 'neutral' && 'text-slate-900',
        className,
      )}
    >
      {signed && amount > 0 ? '+' : ''}
      {formatTZS(amount)}
    </span>
  );
}

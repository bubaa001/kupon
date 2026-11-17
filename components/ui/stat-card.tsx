import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const accents = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  navy: 'bg-navy-50 text-navy ring-navy-100',
  gold: 'bg-gold-50 text-gold-600 ring-gold-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  accent = 'emerald',
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  delta?: number;
  accent?: keyof typeof accents;
  className?: string;
}) {
  return (
    <div className={cn('card-surface relative overflow-hidden p-4 sm:p-5', className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
            accents[accent],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-[0.1em] text-ink-muted">
          {label}
        </p>
      </div>
      <p className="mt-3 break-words text-[1.35rem] font-medium leading-tight tracking-[-0.04em] text-navy tabular sm:text-[1.6rem]">
        {value}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {typeof delta === 'number' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="truncate text-[11px] text-ink-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

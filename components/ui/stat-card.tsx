import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const accents = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  navy: 'bg-slate-100 text-slate-700 ring-slate-200',
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
    <div className={cn('card-surface group relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
            {label}
          </p>
          <p className="mt-2.5 truncate text-[1.45rem] font-semibold tracking-[-0.035em] text-slate-900 tabular">
            {value}
          </p>
        </div>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105',
            accents[accent],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
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
        {hint ? <span className="truncate text-[11px] text-slate-400">{hint}</span> : null}
      </div>
    </div>
  );
}

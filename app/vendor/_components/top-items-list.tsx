'use client';

import { Progress } from '@/components/ui/progress';
import { formatTZS } from '@/lib/utils';
import type { TopItem } from '../_lib/types';

/** Ranked best-sellers with a relative revenue bar. */
export function TopItemsList({
  items,
  emptyState,
}: {
  items: TopItem[];
  emptyState?: React.ReactNode;
}) {
  if (items.length === 0) return <>{emptyState}</>;

  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1);

  return (
    <ol className="min-w-0 space-y-4">
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold tabular text-slate-500">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-slate-800">
                <span className="mr-1 text-[11px] font-semibold text-slate-400">{index + 1}.</span>
                {item.name}
              </p>
              <span className="tabular shrink-0 text-sm font-semibold text-slate-900">
                {formatTZS(item.revenue)}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
              <Progress
                value={(item.revenue / maxRevenue) * 100}
                className="h-1.5 min-w-0 flex-1"
                indicatorClassName="bg-emerald-500"
                aria-label={`${item.name} share of sales`}
              />
              <span className="shrink-0 text-[11px] text-slate-500">
                {item.orders} sold
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

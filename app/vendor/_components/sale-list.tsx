'use client';

import { ReceiptText } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime, formatTime, formatTZS, isToday } from '@/lib/utils';
import type { SaleRow } from '../_lib/types';

/**
 * Compact payment feed used on the home screen and the sales history.
 * Student names are already masked by the API (e.g. "Amina M.").
 *
 * Every flex row carries `min-w-0` so long student numbers or dish names
 * truncate inside the card instead of widening the parent grid track at 375px.
 */
export function SaleList({
  sales,
  emptyState,
}: {
  sales: SaleRow[];
  emptyState?: React.ReactNode;
}) {
  if (sales.length === 0) return <>{emptyState}</>;

  return (
    <ul className="min-w-0 divide-y divide-slate-100">
      {sales.map((sale) => (
        <li key={sale.id} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <ReceiptText className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                {sale.item ?? 'Meal payment'}
              </p>
              <span className="tabular shrink-0 text-sm font-semibold text-slate-900">
                {formatTZS(sale.amount)}
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] leading-5 text-slate-500">
                {sale.studentName}
                {sale.studentNumber ? ` • ${sale.studentNumber}` : ''}
                {' • '}
                {isToday(sale.createdAt) ? formatTime(sale.createdAt) : formatDateTime(sale.createdAt)}
              </p>
              <span className="shrink-0">
                <StatusBadge status={sale.status} />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

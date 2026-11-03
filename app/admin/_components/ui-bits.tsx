'use client';

import type { ReactNode } from 'react';
import { Download, Printer, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber } from '@/lib/utils';

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {title || action ? (
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-slate-100 p-4 sm:p-5">
          <div className="min-w-0">
            {title ? <CardTitle className="text-sm font-semibold">{title}</CardTitle> : null}
            {description ? (
              <CardDescription className="mt-1 text-xs leading-relaxed">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('p-4 sm:p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  ariaLabel = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export type RangeOption<T extends string> = { value: T; label: string };

export function RangeTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: RangeOption<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}</span>–
        <span className="font-semibold text-slate-700">{to}</span> of{' '}
        <span className="font-semibold text-slate-700">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          Previous
        </Button>
        <span className="min-w-[92px] text-center text-xs font-medium text-slate-600">
          Page {current} of {pages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function ExportActions({
  csvHref,
  onPrint,
  csvLabel = 'Export CSV',
  printLabel = 'Export PDF',
}: {
  csvHref: string;
  onPrint?: () => void;
  csvLabel?: string;
  printLabel?: string;
}) {
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <a href={csvHref} download>
          <Download className="h-4 w-4" />
          {csvLabel}
        </a>
      </Button>
      {onPrint ? (
        <Button type="button" variant="outline" size="sm" onClick={onPrint}>
          <Printer className="h-4 w-4" />
          {printLabel}
        </Button>
      ) : null}
    </>
  );
}

export function PrintHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="print-only mb-6 border-b border-slate-300 pb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Kupon • University admin
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </div>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0',
        className,
      )}
    >
      <span className="text-xs text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium text-slate-800">{children}</span>
    </div>
  );
}

export function MiniStat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'emerald' | 'amber' | 'red';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-sm font-semibold tabular',
          tone === 'emerald' && 'text-emerald-700',
          tone === 'amber' && 'text-amber-700',
          tone === 'red' && 'text-red-600',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function DataTableSkeleton({ rows = 7, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading data" role="status">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn(
                'h-4',
                columnIndex === 0 ? 'w-1/4' : columnIndex === columns - 1 ? 'ml-auto w-16' : 'flex-1',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TableEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: Parameters<typeof EmptyState>[0]['icon'];
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      compact
      className="border-0 bg-transparent"
    />
  );
}

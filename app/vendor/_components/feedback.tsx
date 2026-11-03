'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Inline retry block used when a vendor API call fails. */
export function LoadError({
  title = 'Could not load this page',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card-surface flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

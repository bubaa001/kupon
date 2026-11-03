'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Labelled form control with inline validation message. */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-relaxed text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

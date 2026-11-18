import { cn } from '@/lib/utils';

/**
 * Shows that a screen keeps itself up to date (every 15 seconds, and whenever
 * the tab comes back into view). Not a button: there is nothing to press.
 */
export function LiveIndicator({
  syncing = false,
  tone = 'light',
  className,
}: {
  syncing?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex min-h-8 shrink-0 select-none items-center gap-2 rounded-full border px-3 text-[11px] font-medium',
        tone === 'dark'
          ? 'border-white/15 bg-white/[0.06] text-navy-200'
          : 'border-navy/10 bg-white text-ink-muted',
        className,
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
            syncing ? 'bg-gold' : 'bg-emerald-400',
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full transition-colors',
            syncing ? 'bg-gold' : 'bg-emerald-500',
          )}
        />
      </span>
      {syncing ? 'Updating…' : 'Live'}
    </span>
  );
}

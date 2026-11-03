import { cn, initials } from '@/lib/utils';

const palettes = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-slate-200 text-slate-700',
];

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = palettes[hash % palettes.length];
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        palette,
        size === 'sm' && 'h-8 w-8 text-[11px]',
        size === 'md' && 'h-10 w-10 text-xs',
        size === 'lg' && 'h-14 w-14 text-base',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

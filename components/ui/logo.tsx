import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The Kupon ticket mark, shared with the marketing landing page. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy ring-1 ring-inset ring-white/10',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 28 28" className="h-[70%] w-[70%]">
        <path
          d="M4 5h20a1 1 0 0 1 1 1v5.2a2.8 2.8 0 0 0 0 5.6V22a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5.2a2.8 2.8 0 0 0 0-5.6V6a1 1 0 0 1 1-1Z"
          fill="#E3C36F"
        />
        <path
          d="M10 9v10M10 14l6-5M10 14l6 5"
          stroke="#0A1730"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

export function Logo({
  href = '/',
  variant = 'dark',
  size = 'md',
  className,
}: {
  href?: string;
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('group inline-flex items-center gap-2.5', className)}
      aria-label="Kupon home"
    >
      <LogoMark
        className={cn(
          size === 'sm' && 'h-8 w-8 rounded-lg',
          size === 'lg' && 'h-12 w-12 rounded-2xl',
        )}
      />
      <span
        className={cn(
          'font-semibold tracking-[-0.04em]',
          variant === 'dark' ? 'text-navy' : 'text-[#F3F5F9]',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-2xl',
        )}
      >
        Kupon
      </span>
    </Link>
  );
}

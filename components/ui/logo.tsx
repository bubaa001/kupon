import Link from 'next/link';
import { ReceiptText, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 text-white shadow-emerald-glow',
        className,
      )}
      aria-hidden
    >
      <Wallet className="h-[18px] w-[18px]" strokeWidth={2.1} />
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-md border-2 border-white bg-navy text-white">
        <ReceiptText className="h-2 w-2" strokeWidth={2.4} />
      </span>
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
          'font-semibold tracking-[-0.03em]',
          variant === 'dark' ? 'text-slate-900' : 'text-white',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-2xl',
        )}
      >
        Kupon
        <span className="text-primary-500">.</span>
      </span>
    </Link>
  );
}

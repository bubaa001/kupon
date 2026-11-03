import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page is not part of Kupon. Head back to the campus wallet home page.',
};

const BARS = [14, 24, 10, 28, 18, 22, 8, 26, 12, 20, 16, 28, 10, 24, 14, 22, 8, 26, 16, 20, 12, 28];

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="dot-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black_5%,transparent_70%)]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Logo />
        <Button asChild variant="outline" size="sm" className="h-10 bg-white px-4 text-sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-6 sm:px-6">
        <div className="w-full max-w-lg text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
            Error 404
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-navy sm:text-5xl">
            This coupon has expired.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600">
            The page you asked for is not on Kupon. The wallet and the sign-in desk are still open.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full bg-white sm:w-auto">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          <div className="mx-auto mt-10 max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-card">
            <div className="flex items-center justify-between border-b border-dashed border-slate-200 px-5 py-4">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Ticket className="h-4 w-4 text-primary-600" strokeWidth={1.9} />
                Kupon coupon
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                NO. 404
              </span>
            </div>

            <div className="px-5 py-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                Status
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-slate-900">
                VOID · NOT FOUND
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                The address never existed, or the link moved. Nothing was charged, and no wallet
                balance changed.
              </p>
            </div>

            <div className="flex items-end justify-between gap-4 border-t border-dashed border-slate-200 px-5 py-4">
              <div className="flex h-8 items-end gap-[3px]">
                {BARS.map((height, index) => (
                  <span
                    key={index}
                    className="w-[2px] rounded-sm bg-slate-300"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] tabular-nums text-slate-400">
                KPN 4 0 4
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 pb-8 text-center text-[11px] text-slate-400">
        Kupon demo environment. No real money moves.
      </p>
    </main>
  );
}

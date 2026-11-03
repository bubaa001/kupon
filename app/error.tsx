'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with Sentry/OpenTelemetry forwarding in production.
    console.error('[kupon] route error', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <span className="mt-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        We could not finish loading this page. Your wallet balance is safe — no payment was
        deducted. Try again, or contact your university admin if it keeps happening.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[10px] text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset} size="lg">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}

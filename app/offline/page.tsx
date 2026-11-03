import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <span className="mt-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-card">
        <WifiOff className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        Kupon needs a connection to protect your wallet. Your balance is safe — reconnect and try
        again. You can still use the USSD code <strong className="text-slate-700">*150*88#</strong>{' '}
        on any feature phone.
      </p>
      <Button asChild className="mt-6" size="lg">
        <Link href="/student">Retry</Link>
      </Button>
    </main>
  );
}

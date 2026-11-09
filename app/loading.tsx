import { LogoMark } from '@/components/ui/logo';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas"
      role="status"
      aria-live="polite"
    >
      <LogoMark />
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden />
      <p className="text-sm font-medium text-slate-600">Loading page…</p>
    </div>
  );
}

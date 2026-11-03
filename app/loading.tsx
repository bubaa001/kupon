import { LogoMark } from '@/components/ui/logo';

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <LogoMark className="animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary-500" />
      </div>
      <p className="text-xs font-medium text-slate-500">Loading Kupon…</p>
    </div>
  );
}

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PaymentQR({
  value,
  size = 232,
  state = 'active',
  className,
}: {
  value: string;
  size?: number;
  state?: 'active' | 'expired' | 'used';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative mx-auto flex w-fit flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl bg-white p-2 transition-all',
          state !== 'active' && 'opacity-25 blur-[1.5px]',
        )}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="#FFFFFF"
          fgColor="#0F172A"
          marginSize={1}
          title="Kupon payment QR code"
        />
      </div>

      {state === 'active' ? (
        <>
          <span className="pointer-events-none absolute left-2 top-2 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-primary-500" />
          <span className="pointer-events-none absolute right-2 top-2 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-primary-500" />
          <span className="pointer-events-none absolute bottom-2 left-2 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-primary-500" />
          <span className="pointer-events-none absolute bottom-2 right-2 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-primary-500" />
          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Ready to scan
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/50">
          {state === 'expired' ? (
            <>
              <Clock3 className="h-6 w-6 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700">Code expired</p>
              <p className="text-[10px] text-slate-500">Refresh to generate a new code</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <p className="text-xs font-semibold text-slate-700">Payment confirmed</p>
              <p className="text-[10px] text-slate-500">This code can no longer be used</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

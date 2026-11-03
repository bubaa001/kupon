'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Printer, QrCode, RefreshCw, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import type { VendorQrData } from '@/lib/orders/types';

/**
 * The counter QR that students scan. It is a short pointer containing the
 * public vendor code; it contains no student data and cannot initiate payment
 * by itself. Legacy signed JWTs are still accepted by the scan API.
 */
export function VendorQrCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<VendorQrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<VendorQrData>('/api/vendor/qr'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your menu QR.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyCode() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.vendor.code);
      setCopied(true);
      toast.success('Vendor code copied');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard is unavailable on this browser.');
    }
  }

  if (loading) {
    return (
      <div className="card-surface p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-5 w-48" />
        <Skeleton className="mx-auto mt-4 h-[180px] w-[180px] rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-surface flex flex-col items-center gap-3 p-6 text-center">
        <QrCode className="h-6 w-6 text-slate-400" />
        <p className="text-sm font-semibold text-slate-800">Menu QR unavailable</p>
        <p className="text-xs text-slate-500">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section
      className={cn(
        'card-surface relative overflow-hidden p-5',
        compact ? '' : 'sm:flex sm:items-center sm:gap-6',
      )}
      aria-label="Student menu QR"
    >
      <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-primary-100/70 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live menu
          </span>
          <span className="text-[10px] font-semibold text-slate-400">{data.university.code}</span>
        </div>
        <h2 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
          Students scan this QR
        </h2>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
          {data.menuHint}
        </p>
      </div>

      <div className="relative mt-4 flex flex-col items-center sm:ml-auto sm:mt-0 sm:shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <QRCodeSVG
            value={data.payload}
            size={compact ? 196 : 224}
            level="Q"
            marginSize={4}
            bgColor="#FFFFFF"
            fgColor="#000000"
            title={`${data.vendor.name} Kupon menu QR`}
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
          <Store className="h-3 w-3" />
          {data.vendor.name} · {data.vendor.code}
        </div>
      </div>

      <div className="relative mt-4 flex gap-2 sm:mt-0 sm:flex-col">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => void copyCode()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => window.print()}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>
    </section>
  );
}

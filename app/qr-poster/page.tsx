'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import type { VendorQrData } from '@/lib/orders/types';
import { QrPoster, type PosterSize } from '@/components/orders/qr-poster';

type Size = PosterSize;


/**
 * The printable counter poster. Only the poster prints: the toolbar and the
 * rest of the app are hidden by the print styles, and the page is sized to A4
 * (wall poster) or A5 (counter stand).
 */
export default function QrPosterPage() {
  const [data, setData] = useState<VendorQrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<Size>('a4');
  const [origin, setOrigin] = useState('kupon-rust.vercel.app');

  useEffect(() => {
    setOrigin(window.location.host);
    apiFetch<VendorQrData>('/api/vendor/qr')
      .then(setData)
      .catch((cause) => {
        if (cause instanceof ApiClientError && cause.status === 401) {
          window.location.assign('/vendor/login');
          return;
        }
        setError(cause instanceof Error ? cause.message : 'Could not load your QR code.');
      });
  }, []);

  return (
    <div className="poster-screen min-h-dvh bg-navy-50 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: ${size === 'a4' ? 'A4' : 'A5'} portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .poster-toolbar { display: none !important; }
          .poster-sheet { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="poster-toolbar mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/vendor">
            <ArrowLeft aria-hidden />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-navy/15 bg-white p-0.5" role="group" aria-label="Poster size">
            {(
              [
                ['a4', 'Wall poster (A4)'],
                ['a5', 'Counter stand (A5)'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSize(value)}
                aria-pressed={size === value}
                className={
                  size === value
                    ? 'min-h-9 rounded-full bg-navy px-3 text-xs font-semibold text-white'
                    : 'min-h-9 rounded-full px-3 text-xs font-medium text-navy'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()} disabled={!data}>
            <Printer aria-hidden />
            Print
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mx-auto max-w-md rounded-xl bg-white p-4 text-center text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="text-center text-sm text-ink-muted">Preparing your poster…</p>
      ) : (
        <QrPoster data={data} size={size} origin={origin} />
      )}
    </div>
  );
}

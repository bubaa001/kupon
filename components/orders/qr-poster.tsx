import { QRCodeSVG } from 'qrcode.react';
import type { VendorQrData } from '@/lib/orders/types';

export type PosterSize = 'a4' | 'a5';

const STEPS = [
  { en: 'Scan the code', sw: 'Changanua' },
  { en: 'Pick your meal', sw: 'Chagua chakula' },
  { en: 'Pay by mobile money', sw: 'Lipa kwa simu' },
  { en: 'Show your coupon', sw: 'Onyesha kuponi' },
];

/** The printable counter poster: brand, big scannable QR, cafeteria name, four steps, code fallback. */
export function QrPoster({ data, size, origin }: { data: VendorQrData; size: PosterSize; origin: string }) {
  const a4 = size === 'a4';
  return (
    <article
      className="poster-sheet relative mx-auto flex flex-col overflow-hidden bg-navy text-white shadow-lift"
      style={{
        width: a4 ? '210mm' : '148mm',
        height: a4 ? '297mm' : '210mm',
        borderRadius: 12,
      }}
      aria-label={`${data.vendor.name} Kupon ordering poster`}
    >
      {/* Soft gold glow and a fine gold rule, matching the Kupon brand. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 40% at 85% 8%, rgba(227,195,111,0.22), transparent 70%), radial-gradient(50% 35% at 0% 100%, rgba(28,138,103,0.22), transparent 70%)',
        }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gold" />

      <div className="relative flex flex-1 flex-col items-center px-[9%] text-center" style={{ paddingTop: a4 ? '13mm' : '9mm', paddingBottom: a4 ? '11mm' : '7mm' }}>
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 28" className={a4 ? 'h-10 w-10' : 'h-7 w-7'} aria-hidden>
            <path d="M4 5h20a1 1 0 0 1 1 1v5.2a2.8 2.8 0 0 0 0 5.6V22a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5.2a2.8 2.8 0 0 0 0-5.6V6a1 1 0 0 1 1-1Z" fill="#E3C36F" />
            <path d="M10 9v10M10 14l6-5M10 14l6 5" stroke="#0A1730" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span className={a4 ? 'text-3xl font-semibold tracking-[-0.04em]' : 'text-2xl font-semibold tracking-[-0.04em]'}>Kupon</span>
        </div>

        <p className={`mt-[5%] font-semibold uppercase tracking-[0.22em] text-gold ${a4 ? 'text-base' : 'text-xs'}`}>
          {data.university.name}
        </p>
        <h1 className={`mt-2 font-medium leading-[0.95] tracking-[-0.05em] ${a4 ? 'text-[64px]' : 'text-[44px]'}`}>
          Scan to order
        </h1>
        <p className={`mt-2 text-navy-200 ${a4 ? 'text-2xl' : 'text-lg'}`}>Changanua uagize · skip the queue</p>

        {/* The QR: white card, gold corner marks, generous quiet zone so every phone reads it. */}
        <div className="relative mt-[6%]">
          <span aria-hidden className="absolute -left-3 -top-3 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-gold" />
          <span aria-hidden className="absolute -right-3 -top-3 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-gold" />
          <span aria-hidden className="absolute -bottom-3 -left-3 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-gold" />
          <span aria-hidden className="absolute -bottom-3 -right-3 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-gold" />
          <div className="rounded-2xl bg-white p-5">
            <QRCodeSVG
              value={data.payload}
              size={a4 ? 360 : 250}
              level="Q"
              marginSize={2}
              bgColor="#FFFFFF"
              fgColor="#0A1730"
              title={`${data.vendor.name} menu QR`}
            />
          </div>
        </div>

        <h2 className={`mt-[6%] font-medium tracking-[-0.03em] ${a4 ? 'text-4xl' : 'text-2xl'}`}>{data.vendor.name}</h2>

        <ol className={`mt-[5%] grid w-full grid-cols-4 gap-3 ${a4 ? '' : 'gap-2'}`}>
          {STEPS.map((step, index) => (
            <li key={step.en} className="flex flex-col items-center">
              <span className={`flex items-center justify-center rounded-full bg-gold font-bold text-navy ${a4 ? 'h-11 w-11 text-xl' : 'h-8 w-8 text-sm'}`}>
                {index + 1}
              </span>
              <span className={`mt-2 font-semibold leading-tight ${a4 ? 'text-base' : 'text-[11px]'}`}>{step.en}</span>
              <span className={`text-navy-300 ${a4 ? 'text-sm' : 'text-[10px]'}`}>{step.sw}</span>
            </li>
          ))}
        </ol>

        <div className={`mt-auto w-full rounded-2xl border border-white/15 px-5 py-3 ${a4 ? 'text-base' : 'text-xs'}`}>
          <p className="text-navy-200">
            No camera? Open <b className="text-white">{origin}</b> and enter code{' '}
            <b className="font-mono tracking-[0.08em] text-gold">{data.vendor.code}</b>
          </p>
        </div>
        <p className={`mt-3 text-navy-300 ${a4 ? 'text-sm' : 'text-[10px]'}`}>
          Pay only after the cafeteria accepts your order · No cash needed
        </p>
      </div>
    </article>
  );
}

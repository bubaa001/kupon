'use client';

import { QRCodeSVG } from 'qrcode.react';

/**
 * A real, scannable QR rendered in the hero phone mock. The value is a demo
 * deep link, not a payment token: never render a live payment token on a
 * public marketing page.
 */
export function DemoQr({ className }: { className?: string }) {
  return (
    <QRCodeSVG
      value="https://kupon.co.tz/qr/demo?university=UDSM&wallet=AMINA-H"
      size={120}
      level="M"
      bgColor="#ffffff"
      fgColor="#0f172a"
      className={className}
      title="Demo Kupon payment QR"
    />
  );
}

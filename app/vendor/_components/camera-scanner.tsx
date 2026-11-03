'use client';

import { Hash } from 'lucide-react';
import { QrScanner } from '@/components/qr/qr-scanner';
import { Button } from '@/components/ui/button';

/**
 * Vendor coupon scanner.
 *
 * Delegates to the shared camera component so both student and vendor scanners
 * get the same 1x/main-camera selection, zoom normalisation and safe teardown.
 * The extra button is the vendor-friendly fallback when camera permission is
 * denied or lighting is poor.
 */
export function CameraScanner({
  onResult,
  active = true,
  onManualFallback,
}: {
  onResult: (value: string) => void;
  active?: boolean;
  onManualFallback?: () => void;
}) {
  if (!active) return null;
  return (
    <div className="space-y-3">
      <QrScanner onResult={onResult} active={active} />
      {onManualFallback ? (
        <Button type="button" variant="outline" className="w-full" onClick={onManualFallback}>
          <Hash className="h-4 w-4" />
          Enter the 6-digit code instead
        </Button>
      ) : null}
    </div>
  );
}

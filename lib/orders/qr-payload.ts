/**
 * Camera-friendly QR payloads.
 *
 * A signed JWT is several hundred characters and turns into a very dense QR
 * (60+ modules). At the 168–220px sizes used on phones that is hard for a
 * camera to resolve. These compact payloads are pointers; the authoritative
 * state stays in the database and the API verifies vendor/tenant/status there.
 */
export const VENDOR_QR_PREFIX = 'KPN:V:';
export const COUPON_QR_PREFIX = 'KPN:C:';

export function vendorQrValue(vendorCode: string): string {
  return `${VENDOR_QR_PREFIX}${vendorCode}`;
}

export function parseVendorQr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(VENDOR_QR_PREFIX)) return null;
  const code = trimmed.slice(VENDOR_QR_PREFIX.length).trim();
  return code.length >= 3 ? code.toUpperCase() : null;
}

export function couponQrValue(couponCode: string): string {
  return `${COUPON_QR_PREFIX}${couponCode}`;
}

export function parseCouponQr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(COUPON_QR_PREFIX)) return null;
  const code = trimmed.slice(COUPON_QR_PREFIX.length).trim();
  return /^\d{6}$/.test(code) ? code : null;
}

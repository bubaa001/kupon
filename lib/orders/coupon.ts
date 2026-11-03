import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';

const couponSecret = new TextEncoder().encode(`${env.JWT_SECRET}:meal-coupon`);
const vendorQrSecret = new TextEncoder().encode(`${env.JWT_SECRET}:vendor-menu-qr`);

const COUPON_ISSUER = 'kupon-coupon';
const COUPON_AUDIENCE = 'kupon-vendor';
const VENDOR_ISSUER = 'kupon-vendor-menu';
const VENDOR_AUDIENCE = 'kupon-student';

export type CouponPayload = {
  orderId: string;
  couponCode: string;
  vendorId: string;
  universityId: string;
  studentId: string;
};

/** Coupon QR is valid for the order's 24-hour collection window. */
export async function signCouponToken(order: CouponPayload, expiresAt: Date): Promise<string> {
  return new SignJWT({
    code: order.couponCode,
    vid: order.vendorId,
    uid: order.universityId,
    sid: order.studentId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(order.orderId)
    .setJti(order.orderId)
    .setIssuer(COUPON_ISSUER)
    .setAudience(COUPON_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(couponSecret);
}

export async function verifyCouponToken(token: string): Promise<CouponPayload> {
  try {
    const { payload } = await jwtVerify(token, couponSecret, {
      issuer: COUPON_ISSUER,
      audience: COUPON_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.code !== 'string') throw new Error('Malformed coupon');
    return {
      orderId: payload.sub,
      couponCode: payload.code,
      vendorId: String(payload.vid),
      universityId: String(payload.uid),
      studentId: String(payload.sid),
    };
  } catch {
    throw new AppError(
      'This coupon QR is invalid or has expired. Ask the student to reopen the coupon.',
      400,
      'INVALID_COUPON',
    );
  }
}

export type VendorQrPayload = {
  vendorId: string;
  universityId: string;
  vendorCode: string;
};

/** Vendors display this long-lived QR at the counter; students scan it. */
export async function signVendorQr(input: VendorQrPayload): Promise<string> {
  return new SignJWT({
    code: input.vendorCode,
    uid: input.universityId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.vendorId)
    .setJti(input.vendorId)
    .setIssuer(VENDOR_ISSUER)
    .setAudience(VENDOR_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(vendorQrSecret);
}

export async function verifyVendorQr(token: string): Promise<VendorQrPayload> {
  try {
    const { payload } = await jwtVerify(token, vendorQrSecret, {
      issuer: VENDOR_ISSUER,
      audience: VENDOR_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.code !== 'string') throw new Error('Malformed vendor QR');
    return {
      vendorId: payload.sub,
      universityId: String(payload.uid),
      vendorCode: payload.code,
    };
  } catch {
    throw new AppError(
      'That QR is not a valid Kupon vendor code. Ask the vendor to refresh their till QR.',
      400,
      'INVALID_VENDOR_QR',
    );
  }
}

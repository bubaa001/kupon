import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireVendor } from '@/lib/auth';
import { forbidden, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { verifyOrderCoupon } from '@/lib/orders/verify';
import { verifyCouponSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vendor/orders/scan/verify
 *
 * Scan-first coupon verification used by the vendor order desk header. A short
 * QR (`KPN:C:<6-digit code>`) resolves its own order; legacy signed coupon
 * JWTs are still accepted. Single-use status transitions live in
 * `verifyOrderCoupon()`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = requireVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');

    const limit = rateLimit(`vendor:verify-coupon:${vendor.id}`, 30, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many verification attempts. Wait a minute and try again.');
    }

    const body = await parseJson(request, verifyCouponSchema);
    const order = await verifyOrderCoupon({
      vendorId: vendor.id,
      universityId: user.universityId,
      actorId: user.id,
      token: body.token,
      code: body.code,
    });

    return ok({
      order,
      message: `Coupon ${order.couponCode} verified. Hand over ${order.itemCount} item${order.itemCount === 1 ? '' : 's'} to ${order.student.name}.`,
    });
  } catch (error) {
    return fail(error);
  }
}

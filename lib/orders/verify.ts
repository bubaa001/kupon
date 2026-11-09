import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { badRequest, conflict, forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { verifyCouponToken } from './coupon';
import { orderInclude, serializeVendorOrder } from './serialize';

async function rejectInvalidCodeAttempt(vendorId: string): Promise<never> {
  const limit = await rateLimit(`vendor:invalid-coupon:${vendorId}`, 20, 15 * 60_000);
  if (!limit.allowed) {
    throw tooManyRequests('Too many invalid coupon attempts. Wait before trying again.', limit.retryAfterSeconds);
  }
  throw notFound('Coupon not found. Check the code and try again.');
}

/**
 * Vendor coupon verification. The coupon is only valid once; the conditional
 * `updateMany(where: status='PENDING')` is the single-use lock. This is a
 * redemption step, not a second money movement.
 */
export async function verifyOrderCoupon(input: {
  vendorId: string;
  universityId: string;
  actorId: string;
  token?: string;
  code?: string;
  orderId?: string;
}) {
  if (!input.token && !input.code) {
    throw badRequest('Scan the student coupon QR or enter its 6-digit code.', {
      required: ['token', 'code'],
    });
  }

  let orderId = input.orderId;
  let expectedCode = input.code;

  if (input.token) {
    const payload = await verifyCouponToken(input.token);
    orderId = payload.orderId;
    expectedCode = payload.couponCode;
    if (payload.vendorId !== input.vendorId) {
      throw forbidden('This coupon belongs to another vendor.');
    }
  }

  if (!orderId && expectedCode) {
    const byCode = await prisma.order.findUnique({
      where: { couponCode: expectedCode },
      select: { id: true },
    });
    orderId = byCode?.id;
  }
  if (!orderId) {
    if (expectedCode && !input.token) return rejectInvalidCodeAttempt(input.vendorId);
    throw notFound('Coupon not found. Check the code and try again.');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!order) throw notFound('Order not found.');
  if (order.vendorId !== input.vendorId || order.universityId !== input.universityId) {
    if (expectedCode && !input.token) return rejectInvalidCodeAttempt(input.vendorId);
    throw forbidden('This order belongs to another vendor or university.');
  }
  if (expectedCode && order.couponCode !== expectedCode) {
    if (!input.token) return rejectInvalidCodeAttempt(input.vendorId);
    throw conflict('That coupon code does not match this order.');
  }
  if (order.status === 'VERIFIED') {
    throw conflict('This coupon has already been verified.');
  }
  const pendingCredit = await prisma.creditRequest.findFirst({
    where: {
      orderId: order.id,
      status: { in: ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'] },
    },
    select: { id: true },
  });
  if (pendingCredit) {
    throw conflict('This order has an open credit case and cannot be redeemed.');
  }
  if (order.expiresAt <= new Date()) {
    throw conflict('This coupon has expired and can no longer be redeemed.');
  }
  if (order.status !== 'PENDING') {
    throw conflict('This order can no longer be verified.');
  }

  const verified = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: {
        status: 'VERIFIED',
        verifiedById: input.actorId,
        verifiedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw conflict('This coupon was just verified by another till.');
    }
    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
  });

  await auditLog({
    actorId: input.actorId,
    universityId: order.universityId,
    action: 'COUPON_VERIFIED',
    entity: 'Order',
    entityId: order.id,
    metadata: {
      couponCode: order.couponCode,
      reference: order.reference,
      total: order.total,
      vendorId: order.vendorId,
    },
  });

  return serializeVendorOrder(verified);
}

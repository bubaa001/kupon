import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson, searchParams } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { signCouponToken } from '@/lib/orders/coupon';
import { orderInclude, serializeOrder } from '@/lib/orders/serialize';
import { placeOrder } from '@/lib/orders/place-order';
import { processKuponTestGatewayPayments } from '@/lib/payments/kupon-test-gateway';
import { placeOrderSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ordersQuerySchema = z.object({
  id: z.string().min(1).optional(),
  status: z
    .enum(['PAYMENT_PENDING', 'PAYMENT_FAILED', 'PENDING', 'VERIFIED', 'CANCELLED', 'ALL'])
    .optional()
    .default('ALL'),
});

async function withCoupon<
  T extends {
    id: string;
    couponCode: string;
    status: string;
    vendorId: string;
    universityId: string;
    studentId: string;
    expiresAt: Date;
  },
>(order: T) {
  if (
    order.status === 'PAYMENT_PENDING' ||
    order.status === 'PAYMENT_FAILED' ||
    (order.status === 'PENDING' && order.expiresAt <= new Date())
  ) {
    return null;
  }
  return signCouponToken(
    {
      orderId: order.id,
      couponCode: order.couponCode,
      vendorId: order.vendorId,
      universityId: order.universityId,
      studentId: order.studentId,
    },
    order.expiresAt,
  );
}

/**
 * GET /api/student/orders
 * Returns the student's paid coupons with freshly signed QR tokens. Payment
 * intents do not include coupon details until the gateway confirms payment.
 *
 * POST /api/student/orders
 * Starts an internal test payment from a vendor menu. Kupon's test gateway
 * automatically simulates receipt and confirmation before issuing the coupon.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    const params = searchParams(request);
    const query = ordersQuerySchema.parse({
      id: params.get('id') ?? undefined,
      status: params.get('status')?.toUpperCase() ?? undefined,
    });
    await processKuponTestGatewayPayments({ studentId: student.id });

    if (query.id) {
      const order = await prisma.order.findFirst({
        where: { id: query.id, studentId: student.id },
        include: orderInclude,
      });
      if (!order) throw notFound('Coupon not found.');
      return ok({ orders: [serializeOrder(order, await withCoupon(order))], active: null });
    }

    const orders = await prisma.order.findMany({
      where: {
        studentId: student.id,
        ...(query.status && query.status !== 'ALL'
          ? {
              status: query.status,
              ...(query.status === 'PENDING' ? { expiresAt: { gt: new Date() } } : {}),
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const serialized = await Promise.all(
      orders.map(async (order) => serializeOrder(order, await withCoupon(order))),
    );
    // Only an unverified coupon is "active". Verified coupons live in history
    // and should not block the student from scanning a new vendor.
    const active = serialized.find((order) => order.status === 'PENDING') ?? null;

    return ok({ orders: serialized, active });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    if (!user.universityId) throw forbidden('Your student account is not linked to a campus.');

    const limit = rateLimit(`student:place-order:${student.id}`, 8, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many order attempts. Wait a minute and try again.');
    }

    const body = await parseJson(request, placeOrderSchema);
    const result = await placeOrder({
      studentProfileId: student.id,
      universityId: user.universityId,
      actorId: user.id,
      payload: body,
    });

    return ok(result, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

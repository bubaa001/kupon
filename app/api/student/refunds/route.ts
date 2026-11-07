import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { orderRefundRequestSchema } from '@/lib/validators';
import {
  moneyRequestInclude,
  serializeStudentMoneyRequest,
} from '@/lib/payments/money-requests';
import { randomReference } from '@/lib/utils';
import type {
  OrderRefundsData,
  RefundCreated,
  RefundableOrder,
} from '@/app/student/_lib/types';
import { getStudentBalance, getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/student/refunds
 *
 * ORDER REFUNDS ONLY. Returns:
 * - `requests`: refund requests tied to a specific verified order;
 * - `refundableOrders`: the student's paid + vendor-verified orders, annotated
 *   with any refund request already filed for that order;
 * - `balance`: current wallet balance.
 *
 * Cash-out requests live on `/api/student/withdrawals` — this route never creates
 * or returns a withdrawal.
 */
export async function GET() {
  try {
    const { student } = await getStudentContext();
    const [requests, orders, balance] = await Promise.all([
      prisma.refundRequest.findMany({
        where: { studentId: student.id, kind: 'REFUND' },
        include: moneyRequestInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.order.findMany({
        where: {
          studentId: student.id,
          status: 'VERIFIED',
          transactionId: { not: null },
        },
        select: {
          id: true,
          reference: true,
          total: true,
          itemCount: true,
          createdAt: true,
          verifiedAt: true,
          vendor: { select: { name: true, code: true } },
          items: {
            select: { name: true, quantity: true },
            orderBy: { name: 'asc' },
            take: 4,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      getStudentBalance(student.id),
    ]);

    const orderIds = orders.map((order) => order.id);
    const filedRequests = orderIds.length
      ? await prisma.refundRequest.findMany({
          where: {
            studentId: student.id,
            kind: 'REFUND',
            orderId: { in: orderIds },
            status: { in: ['PENDING', 'APPROVED'] },
          },
          select: { orderId: true, status: true, reference: true },
        })
      : [];
    const filedByOrder = new Map(
      filedRequests
        .filter((item): item is typeof item & { orderId: string } => Boolean(item.orderId))
        .map((item) => [item.orderId, item]),
    );

    const refundableOrders: RefundableOrder[] = orders.map((order) => {
      const filed = filedByOrder.get(order.id);
      const names = order.items.map((item) => item.name);
      const remaining = order.itemCount - order.items.length;
      const summary =
        names.length === 0
          ? null
          : remaining > 0
            ? `${names.join(' + ')} +${remaining} more`
            : names.join(' + ');
      return {
        id: order.id,
        reference: order.reference,
        total: order.total,
        itemCount: order.itemCount,
        vendorName: order.vendor.name,
        vendorCode: order.vendor.code,
        itemSummary: summary,
        createdAt: order.createdAt.toISOString(),
        verifiedAt: order.verifiedAt ? order.verifiedAt.toISOString() : null,
        refundRequestStatus: filed
          ? filed.status === 'APPROVED'
            ? 'APPROVED'
            : 'PENDING'
          : 'NONE',
        refundRequestReference: filed?.reference ?? null,
      };
    });

    const data: OrderRefundsData = {
      requests: requests.map(serializeStudentMoneyRequest),
      refundableOrders,
      balance,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/student/refunds
 *
 * Files an order-refund request. The amount is always the verified order's total,
 * resolved server-side — clients cannot request a partial or inflated refund.
 * Only VERIFIED orders are accepted; pending orders are cancelled (with automatic
 * reversal) by the student from the active coupon instead.
 */
export async function POST(request: Request) {
  try {
    const { user, student } = await getStudentContext();

    const limit = rateLimit(`student:refund:${user.id}`, 5, 10 * 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many refund requests. Please wait a few minutes before trying again.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, orderRefundRequestSchema);

    const order = await prisma.order.findFirst({
      where: { id: body.orderId, studentId: student.id },
      select: {
        id: true,
        reference: true,
        status: true,
        total: true,
        testOnly: true,
        universityId: true,
        transactionId: true,
        transaction: {
          select: { id: true, type: true, status: true, amount: true, isTest: true },
        },
      },
    });
    if (!order) throw notFound('Order not found in your wallet.');

    if (order.status === 'PENDING') {
      throw conflict(
        'This order is still waiting for vendor verification. Pending orders are cancelled from your active coupon instead of refunded.',
        { orderId: order.id, orderReference: order.reference },
      );
    }
    if (order.status === 'CANCELLED') {
      throw conflict('This order was already cancelled and reversed, so it cannot be refunded.');
    }
    if (order.status !== 'VERIFIED') {
      throw conflict(`Only vendor-verified orders can be refunded (this order is ${order.status}).`);
    }
    if (!order.transactionId || !order.transaction) {
      throw conflict('We could not find the original payment for this order.');
    }
    if (order.testOnly || order.transaction.isTest) {
      throw conflict('Test-only orders cannot be refunded as real money.');
    }
    if (order.transaction.type !== 'PAYMENT' || order.transaction.status !== 'SETTLED') {
      throw conflict('The original order payment is not settled, so it cannot be refunded.');
    }
    if (order.transaction.amount !== order.total) {
      throw conflict('The order and its payment no longer match. Contact the admin office.');
    }

    const existing = await prisma.refundRequest.findFirst({
      where: {
        orderId: order.id,
        kind: 'REFUND',
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: { id: true, status: true, reference: true },
    });
    if (existing) {
      throw conflict(
        existing.status === 'PENDING'
          ? 'A refund request for this order is already waiting for admin review.'
          : 'This order has already been refunded.',
        { orderId: order.id, requestId: existing.id, status: existing.status },
      );
    }

    const created = await prisma.refundRequest.create({
      data: {
        reference: randomReference('RFD'),
        kind: 'REFUND',
        studentId: student.id,
        universityId: order.universityId,
        amount: order.total,
        reason: body.reason,
        status: 'PENDING',
        orderId: order.id,
        transactionId: order.transactionId,
      },
      include: moneyRequestInclude,
    });

    const data: RefundCreated = {
      request: serializeStudentMoneyRequest(created),
      message: `Ombi la refund ya order ${order.reference} limewasilishwa. Admin wa chuo atakagua kisha pesa itarejeshwa kwenye wallet yako.`,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

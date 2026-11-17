import type { Prisma } from '@prisma/client';
import { maskPhone } from '@/lib/utils';
import type { CafeteriaNotice, OrderView } from './types';

export const orderInclude = {
  items: { orderBy: { name: 'asc' } },
  vendor: {
    select: { id: true, name: true, code: true, description: true },
  },
  transaction: {
    select: {
      isTest: true,
      amount: true,
      aggregatorFee: true,
      platformFee: true,
      paymentEvents: {
        orderBy: { sequence: 'desc' },
        take: 1,
        select: { stage: true },
      },
    },
  },
  student: {
    include: {
      user: { select: { name: true, phone: true } },
    },
  },
  university: { select: { id: true, name: true, code: true } },
  creditRequests: {
    where: { kind: 'VENDOR_CLOSING' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { reference: true, status: true, reason: true, adminNote: true },
  },
} satisfies Prisma.OrderInclude;

const OPEN_CASE_STATUSES = ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'];

export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function cafeteriaNotice(order: OrderRecord, declineReason: string | null): CafeteriaNotice | null {
  const unavailableCase = order.creditRequests[0];
  if (unavailableCase) {
    return {
      kind: 'UNAVAILABLE',
      reason: unavailableCase.reason,
      caseReference: unavailableCase.reference,
      caseStatus: OPEN_CASE_STATUSES.includes(unavailableCase.status)
        ? 'OPEN'
        : unavailableCase.status === 'APPROVED'
          ? 'APPROVED'
          : 'REJECTED',
      resolution: unavailableCase.adminNote,
    };
  }
  if (order.status === 'CANCELLED' && declineReason) {
    return {
      kind: 'DECLINED',
      reason: declineReason,
      caseReference: null,
      caseStatus: null,
      resolution: null,
    };
  }
  return null;
}

/**
 * `declineReason` is the cafeteria's reason for declining an unpaid request.
 * Student endpoints pass it so the student sees why, not just "declined".
 */
export function serializeOrder(
  order: OrderRecord,
  couponToken: string | null = null,
  declineReason: string | null = null,
): OrderView {
  const expired = order.status === 'PENDING' && order.expiresAt <= new Date();
  const notice = cafeteriaNotice(order, declineReason);
  // While the cafeteria's "food unavailable" case is open the coupon cannot be redeemed.
  const couponOnHold = notice?.kind === 'UNAVAILABLE' && notice.caseStatus !== 'REJECTED';
  const paymentUnconfirmed =
    order.status === 'PAYMENT_PENDING' ||
    order.status === 'PAYMENT_FAILED' ||
    order.status === 'AWAITING_ACCEPTANCE' ||
    order.status === 'AWAITING_PAYMENT' ||
    expired ||
    couponOnHold;
  return {
    id: order.id,
    reference: order.reference,
    status: expired ? 'EXPIRED' : (order.status as OrderView['status']),
    total: order.total,
    itemCount: order.itemCount,
    couponCode: paymentUnconfirmed ? '' : order.couponCode,
    couponToken: paymentUnconfirmed ? null : couponToken,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    verifiedAt: order.verifiedAt ? order.verifiedAt.toISOString() : null,
    expiresAt: order.expiresAt.toISOString(),
    paymentTest: order.testOnly || (order.transaction?.isTest ?? false),
    paymentStage: order.transaction?.paymentEvents[0]?.stage ?? null,
    amountPaid: order.transaction?.amount ?? 0,
    apiFee: order.transaction?.aggregatorFee ?? 0,
    kuponFee: order.transaction?.platformFee ?? 0,
    creditApplied: order.creditApplied,
    useCafeteriaCredit: order.useCafeteriaCredit,
    cafeteriaNotice: notice,
    vendor: {
      id: order.vendor.id,
      name: order.vendor.name,
      code: order.vendor.code,
      description: order.vendor.description,
    },
    student: {
      name: order.student.user.name,
      studentId: order.student.studentId,
      phone: maskPhone(order.student.user.phone),
    },
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
    })),
  };
}

export function serializeVendorOrder(order: OrderRecord): OrderView {
  return serializeOrder(order, null);
}

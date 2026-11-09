import type { Prisma } from '@prisma/client';
import { maskPhone } from '@/lib/utils';
import type { OrderView } from './types';

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
} satisfies Prisma.OrderInclude;

export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(order: OrderRecord, couponToken: string | null = null): OrderView {
  const expired = order.status === 'PENDING' && order.expiresAt <= new Date();
  const paymentUnconfirmed =
    order.status === 'PAYMENT_PENDING' ||
    order.status === 'PAYMENT_FAILED' ||
    order.status === 'AWAITING_ACCEPTANCE' ||
    order.status === 'AWAITING_PAYMENT' ||
    expired;
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

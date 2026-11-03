import type { Prisma } from '@prisma/client';
import { maskPhone } from '@/lib/utils';
import type { RequestKind, RequestStatus } from '@/lib/constants';
import type {
  AdminMoneyRequestView,
  MoneyRequestSummary,
  StudentMoneyRequestView,
} from './money-request-types';

/**
 * Shared Prisma includes + serializers for the two money-request products.
 *
 * Both queues read the same `RefundRequest` table, but the admin UI and audit
 * trail keep them unmistakably separate: withdrawals never show an order and
 * order refunds always show the reversed order + its original payment.
 */
const orderSelect = {
  id: true,
  reference: true,
  status: true,
  total: true,
  itemCount: true,
  couponCode: true,
  vendorId: true,
  studentId: true,
  universityId: true,
  verifiedAt: true,
  createdAt: true,
  vendor: { select: { name: true, code: true } },
  items: {
    select: { name: true, quantity: true },
    orderBy: { name: 'asc' },
    take: 4,
  },
} satisfies Prisma.OrderSelect;

export const moneyRequestOrderSelect = orderSelect;

export const moneyRequestInclude = {
  order: { select: orderSelect },
} satisfies Prisma.RefundRequestInclude;

export const adminMoneyRequestInclude = {
  ...moneyRequestInclude,
  student: {
    select: {
      studentId: true,
      course: true,
      year: true,
      walletBalance: true,
      user: { select: { name: true, phone: true } },
    },
  },
  reviewedBy: { select: { name: true } },
  transaction: { select: { reference: true } },
} satisfies Prisma.RefundRequestInclude;

export type MoneyRequestRecord = Prisma.RefundRequestGetPayload<{
  include: typeof moneyRequestInclude;
}>;

export type AdminMoneyRequestRecord = Prisma.RefundRequestGetPayload<{
  include: typeof adminMoneyRequestInclude;
}>;

type RequestOrder = NonNullable<MoneyRequestRecord['order']>;

function itemSummary(order: RequestOrder | null): string | null {
  if (!order || order.items.length === 0) return null;
  const names = order.items.map((item) => item.name);
  const remaining = order.itemCount - order.items.length;
  const base = names.join(' + ');
  return remaining > 0 ? `${base} +${remaining} more` : base;
}

function baseFields(
  request: MoneyRequestRecord | AdminMoneyRequestRecord,
): StudentMoneyRequestView {
  const order = request.order ?? null;
  return {
    id: request.id,
    reference: request.reference,
    kind: request.kind as RequestKind,
    amount: request.amount,
    reason: request.reason,
    status: request.status as RequestStatus,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    payoutStatus: request.payoutStatus,
    payoutReference: request.payoutReference,
    orderId: request.orderId,
    orderReference: order ? order.reference : null,
    orderStatus: order ? order.status : null,
    orderTotal: order ? order.total : null,
    vendorName: order ? order.vendor.name : null,
    itemSummary: itemSummary(order),
  };
}

export function serializeStudentMoneyRequest(
  request: MoneyRequestRecord,
): StudentMoneyRequestView {
  return baseFields(request);
}

export function serializeAdminMoneyRequest(
  request: AdminMoneyRequestRecord,
): AdminMoneyRequestView {
  return {
    ...baseFields(request),
    reviewedBy: request.reviewedBy?.name ?? null,
    payoutTransactionId: request.payoutTransactionId,
    originalTransactionReference: request.transaction?.reference ?? null,
    student: {
      id: request.studentId,
      name: request.student.user.name,
      studentId: request.student.studentId,
      course: request.student.course,
      year: request.student.year,
      phone: maskPhone(request.student.user.phone),
      balance: request.student.walletBalance,
    },
  };
}

type StatusGroup = {
  status: string;
  _count: { _all: number };
  _sum: { amount: number | null };
};

/**
 * Builds the per-queue summary. Callers pass a `groupBy` result already filtered
 * to ONE kind so withdrawal and refund counts never bleed into each other.
 */
export function summarizeRequestGroups(
  groups: StatusGroup[],
  statuses: readonly RequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'],
): MoneyRequestSummary {
  const counts: Record<string, number> = {};
  const amounts: Record<string, number> = {};
  for (const status of statuses) {
    counts[status] = 0;
    amounts[status] = 0;
  }
  for (const group of groups) {
    counts[group.status] = group._count._all;
    amounts[group.status] = group._sum.amount ?? 0;
  }
  return {
    pending: counts.PENDING ?? 0,
    approved: counts.APPROVED ?? 0,
    rejected: counts.REJECTED ?? 0,
    total: (counts.PENDING ?? 0) + (counts.APPROVED ?? 0) + (counts.REJECTED ?? 0),
    pendingAmount: amounts.PENDING ?? 0,
    approvedAmount: amounts.APPROVED ?? 0,
    rejectedAmount: amounts.REJECTED ?? 0,
  };
}

/** Mobile-money network inferred from an E.164 Tanzanian number (display only). */
export function networkForPhone(phone: string): string | null {
  const local = phone.replace(/^\+?255/, '0');
  if (/^0(71|74|75|76)/.test(local)) return 'M-PESA';
  if (/^0(65|67)/.test(local)) return 'TIGO_PESA';
  if (/^0(68|69|78)/.test(local)) return 'AIRTEL_MONEY';
  if (/^0(61|62)/.test(local)) return 'HALOTEL';
  return null;
}

export type { RequestKind, RequestStatus };

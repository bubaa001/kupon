import type { Prisma } from '@prisma/client';
import { maskPhone } from '@/lib/utils';

export const refundInclude = {
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
} satisfies Prisma.RefundRequestInclude;

export type RefundRecord = Prisma.RefundRequestGetPayload<{ include: typeof refundInclude }>;

export type AdminRefundRow = {
  id: string;
  reference: string;
  amount: number;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  student: {
    id: string;
    name: string;
    studentId: string;
    course: string;
    year: number;
    phone: string;
    balance: number;
  };
};

export function serializeRefund(refund: RefundRecord): AdminRefundRow {
  return {
    id: refund.id,
    reference: refund.reference,
    amount: refund.amount,
    reason: refund.reason,
    status: refund.status,
    adminNote: refund.adminNote,
    createdAt: refund.createdAt.toISOString(),
    reviewedAt: refund.reviewedAt ? refund.reviewedAt.toISOString() : null,
    reviewedBy: refund.reviewedBy?.name ?? null,
    student: {
      id: refund.studentId,
      name: refund.student.user.name,
      studentId: refund.student.studentId,
      course: refund.student.course,
      year: refund.student.year,
      phone: maskPhone(refund.student.user.phone),
      balance: refund.student.walletBalance,
    },
  };
}

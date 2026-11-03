/**
 * Client-safe DTOs for student money requests.
 *
 * `RefundRequest` rows carry two deliberately different products that share one
 * audited review queue:
 *
 * - `kind: 'WITHDRAWAL'` — cash out available wallet balance to mobile money.
 *   No order reference. Wallet is debited only on admin approval.
 * - `kind: 'REFUND'` — reverse one paid, vendor-verified order. Carries the order
 *   reference (and, for admins, the original payment transaction reference).
 *
 * These types are shared by the student pages, the admin queues and the API
 * routes so the two flows can never drift back into one ambiguous "refund".
 */
import type { RequestKind, RequestStatus } from '@/lib/constants';

export type StudentMoneyRequestView = {
  id: string;
  reference: string;
  kind: RequestKind;
  amount: number;
  reason: string;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  /** Payout leg of a withdrawal: null until approved, then PENDING/SETTLED/FAILED. */
  payoutStatus: string | null;
  payoutReference: string | null;
  /** REFUND only — the reversed order. */
  orderId: string | null;
  orderReference: string | null;
  orderStatus: string | null;
  orderTotal: number | null;
  vendorName: string | null;
  itemSummary: string | null;
};

export type AdminMoneyRequestView = StudentMoneyRequestView & {
  reviewedBy: string | null;
  payoutTransactionId: string | null;
  originalTransactionReference: string | null;
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

export type MoneyRequestSummary = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
};

export type MoneyRequestListData = {
  requests: AdminMoneyRequestView[];
  summary: MoneyRequestSummary;
};

/** One paid + vendor-verified order the student may request a refund for. */
export type RefundableOrderView = {
  id: string;
  reference: string;
  total: number;
  itemCount: number;
  vendorName: string;
  vendorCode: string;
  itemSummary: string | null;
  createdAt: string;
  verifiedAt: string | null;
  /** Refund lifecycle for this order: NONE = requestable, PENDING/APPROVED = locked. */
  refundRequestStatus: 'NONE' | 'PENDING' | 'APPROVED';
  refundRequestReference: string | null;
};

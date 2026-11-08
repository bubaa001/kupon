export const ROLES = ['STUDENT', 'VENDOR', 'ADMIN', 'SUPER_ADMIN', 'FINANCE', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const TX_TYPES = [
  'TOPUP',
  'PAYMENT',
  'REFUND',
  'WITHDRAWAL',
  'ADJUSTMENT_CREDIT',
  'ADJUSTMENT_DEBIT',
] as const;
export type TxType = (typeof TX_TYPES)[number];

export const TX_STATUSES = ['PENDING', 'SETTLED', 'FAILED'] as const;
export type TxStatus = (typeof TX_STATUSES)[number];

export const REFUND_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Two different money requests share one audited queue but never the same
 * semantics:
 *
 * - WITHDRAWAL — the student cashes out *available wallet balance* to mobile
 *   money. Not tied to an order. No money moves until an admin approves, then the
 *   wallet is debited exactly once and a WITHDRAWAL transaction is booked.
 * - REFUND — money is returned for one specific paid, vendor-verified order.
 *   Approval reverses that order's wallet debit, vendor pending credit and fee
 *   revenue exactly once. Pending orders are cancelled by the student, not
 *   refunded.
 */
export const REQUEST_KINDS = ['WITHDRAWAL', 'REFUND'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** Money requests reuse the refund review lifecycle: PENDING → APPROVED|REJECTED. */
export const REQUEST_STATUSES = REFUND_STATUSES;
export type RequestStatus = RefundStatus;

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  WITHDRAWAL: 'Withdrawal',
  REFUND: 'Order refund',
};

/** Minimum cash-out, mirroring `withdrawalRequestSchema`. */
export const MIN_WITHDRAWAL = 1000;
/** A withdrawal higher than this needs a bank-style review in a real deployment. */
export const MAX_WITHDRAWAL = 500_000;
/** Minimum reason length for either kind of money request (matches validators). */
export const MIN_REQUEST_REASON = 5;

/** Distinct audit event names — the admin audit trail never mixes the two flows. */
export const REQUEST_AUDIT_ACTIONS = {
  WITHDRAWAL_APPROVED: 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_PAYOUT_FAILED: 'WITHDRAWAL_PAYOUT_FAILED',
  ORDER_REFUND_APPROVED: 'ORDER_REFUND_APPROVED',
  ORDER_REFUND_REJECTED: 'ORDER_REFUND_REJECTED',
} as const;


export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const MOBILE_NETWORKS = [
  { id: 'M-PESA', name: 'M-Pesa', short: 'Vodacom', color: '#E60000', prefix: '071, 074, 075, 076' },
  { id: 'TIGO_PESA', name: 'Tigo Pesa', short: 'Tigo', color: '#0B5CAD', prefix: '065, 067, 071' },
  { id: 'AIRTEL_MONEY', name: 'Airtel Money', short: 'Airtel', color: '#E40000', prefix: '068, 069, 078' },
  { id: 'HALOTEL', name: 'Halotel', short: 'Halotel', color: '#F58220', prefix: '061, 062' },
] as const;

export type MobileNetwork = (typeof MOBILE_NETWORKS)[number]['id'];

export const NETWORK_LABEL: Record<string, string> = {
  'M-PESA': 'M-Pesa',
  TIGO_PESA: 'Tigo Pesa',
  AIRTEL_MONEY: 'Airtel Money',
  HALOTEL: 'Halotel',
};

export const TX_TYPE_LABEL: Record<TxType, string> = {
  TOPUP: 'Top up',
  PAYMENT: 'Meal payment',
  REFUND: 'Order refund',
  WITHDRAWAL: 'Withdrawal payout',
  ADJUSTMENT_CREDIT: 'Admin credit',
  ADJUSTMENT_DEBIT: 'Admin debit',
};

export const STATUS_BADGE: Record<
  TxStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  SETTLED: { label: 'Settled', variant: 'success' },
  PENDING: { label: 'Pending', variant: 'warning' },
  FAILED: { label: 'Failed', variant: 'danger' },
};

export const REFUND_BADGE: Record<
  RefundStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  APPROVED: { label: 'Approved', variant: 'success' },
  PENDING: { label: 'Pending', variant: 'warning' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

/** Same lifecycle badge for withdrawal queues and order-refund queues. */
export const REQUEST_BADGE = REFUND_BADGE;

/** Extra chip for a withdrawal's payout leg (wallet debit already happened). */
export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Payout pending',
  SETTLED: 'Paid out',
  FAILED: 'Payout failed',
};

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Student',
  VENDOR: 'Vendor',
  ADMIN: 'University admin',
  SUPER_ADMIN: 'Platform admin',
  FINANCE: 'Finance',
  STAFF: 'Cafeteria staff',
};

export const DEFAULT_FEES = {
  platformPercent: 2.5,
  aggregatorPercent: 1.5,
  universityShareOfFeePercent: 20,
};

export const TOPUP_AMOUNTS = [1000, 2000, 5000, 10000] as const;
export const MIN_TOPUP = 500;
export const MAX_TOPUP = 500_000;

export const QR_TTL_SECONDS = 120;
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';

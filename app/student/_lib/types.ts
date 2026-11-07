/**
 * Response shapes for the student wallet API.
 *
 * These mirror `docs/API_CONTRACTS.md` and are shared by the App Router pages
 * (client components) and the typed API routes so the two can never drift.
 */
import type { RefundStatus, TxStatus, TxType } from '@/lib/constants';
import type {
  RefundableOrderView,
  StudentMoneyRequestView,
} from '@/lib/payments/money-request-types';

export type StudentTx = {
  id: string;
  reference: string;
  amount: number;
  type: TxType;
  status: TxStatus;
  createdAt: string;
  vendor?: { name: string; code: string };
  channel: string;
  metadataSummary: string;
};

export type WalletStats = {
  todaySpent: number;
  weekSpent: number;
  mealsThisWeek: number;
  totalTopUps: number;
};

export type WalletData = {
  student: {
    name: string;
    studentId: string;
    course: string;
    year: number;
    phone: string;
    university: { name: string; code: string };
  };
  balance: number;
  stats: WalletStats;
  recentTransactions: StudentTx[];
};

export type StudentDashboardData = {
  student: {
    name: string;
    studentId: string;
    course: string;
    year: number;
    phone: string;
    university: { name: string; code: string };
  };
  stats: {
    todaySpent: number;
    weekSpent: number;
    mealsThisWeek: number;
    couponsUsed: number;
  };
  recentTransactions: StudentTx[];
};

export type TransactionsData = {
  transactions: StudentTx[];
  counts: { total: number; settled: number; pending: number; failed: number };
  totalIn: number;
  totalOut: number;
};

export type TopUpCreated = {
  transactionId: string;
  reference: string;
  status: 'PENDING';
  routeCode: string;
  message: string;
  aggregatorFee: number;
  /** Present when the top-up uses a hosted card checkout. */
  checkoutUrl?: string;
  provider?: 'whop' | 'azampay' | 'azampay-card';
};

export type TopUpStatusData = {
  transaction: {
    id: string;
    reference: string;
    amount: number;
    status: TxStatus;
    network: string | null;
    createdAt: string;
    settledAt: string | null;
  };
  balance: number;
};

export type PaymentTokenCreated = {
  tokenId: string;
  token: string;
  code: string;
  expiresAt: string;
  expiresIn: number;
  student: { name: string; studentId: string };
  balance: number;
};

export type PaymentTokenTransaction = {
  vendor: { name: string; code: string } | null;
  amount: number;
  status: TxStatus;
  createdAt: string;
};

export type PaymentTokenStatusData = {
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  expiresAt: string;
  transaction?: PaymentTokenTransaction;
};

/**
 * @deprecated Legacy flat refund row from the old mislabelled cash-out flow.
 * New pages use `MoneyRequestApi`, which carries `kind`, the order reference and
 * the payout state so withdrawals and order refunds can never be confused.
 */
export type RefundRequestApi = {
  id: string;
  reference: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** One row in the student withdrawal history or order-refund history. */
export type MoneyRequestApi = StudentMoneyRequestView;

/**
 * Cash-out page payload: available balance, how much can be requested now, and
 * every withdrawal request this student has filed.
 */
export type WithdrawalsData = {
  requests: MoneyRequestApi[];
  balance: number;
  eligibleAmount: number;
  hasPending: boolean;
  minAmount: number;
};

export type WithdrawalCreated = {
  request: MoneyRequestApi;
  message: string;
};

/** A paid + vendor-verified order the student can still request a refund for. */
export type RefundableOrder = RefundableOrderView;

/**
 * Order-refund page payload. `requests` only contains kind=REFUND rows;
 * withdrawals live on `/student/withdrawals`.
 */
export type OrderRefundsData = {
  requests: MoneyRequestApi[];
  refundableOrders: RefundableOrder[];
  balance: number;
};

export type RefundCreated = {
  request: MoneyRequestApi;
  message: string;
};

/**
 * @deprecated Old GET /api/student/refunds shape, kept so older callers still
 * typecheck. The endpoint now returns `OrderRefundsData` instead.
 */
export type RefundsData = {
  requests: RefundRequestApi[];
  balance: number;
  eligibleAmount: number;
  hasPending: boolean;
};

export type StudentProfileData = {
  student: {
    id: string;
    name: string;
    studentId: string;
    course: string;
    year: number;
    phone: string;
    joinedAt: string;
  };
  university: { id: string; name: string; code: string; city: string };
  stats: {
    mealsCount: number;
    totalSpent: number;
    transactionsCount: number;
    pendingRefunds: number;
  };
};

/**
 * Response shapes for `/api/admin/*`, mirrored for the client components.
 * All money is integer TZS. Dates are ISO strings.
 */

export type TxRow = {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  platformFee: number;
  aggregatorFee: number;
  universityRevenue: number;
  vendorSettlement: number;
  type: string;
  typeLabel: string;
  status: string;
  channel: string;
  metadataSummary: string | null;
  failureReason: string | null;
  routeCode: string | null;
  createdAt: string;
  settledAt: string | null;
  student: { id: string; name: string; studentId: string; phone: string };
  vendor: { id: string; name: string; code: string } | null;
};

export type TxSummary = { gross: number; fees: number; net: number; count: number };

export type TxListData = {
  rows: TxRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: TxSummary;
};

export type ChartPoint = {
  date: string;
  label: string;
  revenue: number;
  transactions: number;
  profit: number;
};

export type TopMeal = { name: string; orders: number; revenue: number; emoji: string };

export type DashboardData = {
  university: { id: string; name: string; code: string } | null;
  stats: {
    revenueToday: number;
    revenueYesterday: number;
    transactionsToday: number;
    transactionsYesterday: number;
    mealPaymentsToday: number;
    activeStudents: number;
    totalStudents: number;
    pendingRefunds: number;
    pendingRefundAmount: number;
  };
  chart: ChartPoint[];
  topMeals: TopMeal[];
  liveFeed: TxRow[];
};

export type VendorRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  settlementAccount: string;
  pendingBalance: number;
  totalSettled: number;
  status: string;
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
  salesToday: number;
  transactionsToday: number;
};

export type VendorListData = {
  university: { id: string; name: string; code: string } | null;
  vendors: VendorRow[];
  summary: {
    total: number;
    pending: number;
    active: number;
    suspended: number;
    salesToday: number;
    pendingSettlement: number;
    transactionsToday: number;
  };
};

export type StudentRow = {
  id: string;
  name: string;
  studentId: string;
  phone: string;
  course: string;
  year: number;
  balance: number;
  university: { name: string; code: string };
  joinedAt: string;
};

export type StudentListData = {
  students: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { totalStudents: number; totalBalance: number; averageBalance: number };
};

export type StudentRefund = {
  id: string;
  reference: string;
  amount: number;
  reason: string;
  status: string;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  entity?: string;
  entityId?: string | null;
  actorRole?: string | null;
};

export type StudentDetailData = {
  student: {
    id: string;
    name: string;
    phone: string;
    studentId: string;
    email: string | null;
    googleLinked: boolean;
    course: string;
    year: number;
    balance: number;
    currency: string;
    joinedAt: string;
    lastLoginAt: string | null;
    university: { id: string; name: string; code: string; paymentRouteCode: string };
  };
  stats: {
    totalTopUps: number;
    totalSpent: number;
    totalRefunded: number;
    adjustments: number;
    transactionCount: number;
    lastActivityAt: string | null;
  };
  transactions: TxRow[];
  refunds: StudentRefund[];
  audit: AuditEntry[];
};

export type RefundRow = {
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

export type RefundListData = {
  requests: RefundRow[];
  summary: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
    pendingAmount: number;
    approvedAmount: number;
    rejectedAmount: number;
  };
};

export type MenuItemRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  available: boolean;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string; code: string; status: string };
};

export type MenuListData = {
  items: MenuItemRow[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    unavailable: number;
  };
};

export type SettingsData = {
  university: {
    id: string;
    name: string;
    code: string;
    city: string;
    paymentRouteCode: string;
    saasFee: number;
    brandColor: string;
    status: string;
    createdAt: string;
  };
  invoices: {
    id: string;
    reference: string;
    amount: number;
    period: string;
    status: string;
    issuedAt: string;
    paidAt: string | null;
  }[];
  ledger: {
    debits: number;
    credits: number;
    balanced: boolean;
    entries: number;
    accounts: { account: string; debit: number; credit: number; net: number }[];
  };
};

export type AuditLogData = { logs: AuditEntry[]; total: number };

export type ReportData = {
  range: { key: string; label: string; start: string; end: string };
  summary: {
    grossRevenue: number;
    platformFees: number;
    vendorPayouts: number;
    universityRevenue: number;
    platformNet: number;
    aggregatorCost: number;
    transactions: number;
    averageTicket: number;
    activeVendors: number;
    refundedAmount: number;
  };
  daily: ChartPoint[];
  fees: { platform: number; aggregator: number; university: number; net: number };
  leakage: {
    failedCount: number;
    failedAmount: number;
    pendingCount: number;
    pendingAmount: number;
    refundedCount: number;
    refundedAmount: number;
    leakageRate: number;
  };
  topVendors: {
    id: string;
    name: string;
    code: string;
    revenue: number;
    transactions: number;
    share: number;
  }[];
};

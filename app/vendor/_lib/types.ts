/**
 * Response shapes shared by the vendor client screens.
 * They mirror `docs/API_CONTRACTS.md` plus the few additive fields the vendor
 * API returns (vendor summary, approval counters, payout account).
 */
export type VendorRange = 'today' | 'week' | 'month';

export type SaleRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  settledAt: string | null;
  item: string | null;
  note: string | null;
  studentName: string;
  studentNumber: string | null;
  net: number;
};

export type TopItem = {
  name: string;
  orders: number;
  revenue: number;
  emoji: string;
};

export type VendorStats = {
  vendor: {
    name: string;
    code: string;
    university: { name: string; code: string };
  };
  todaySales: number;
  transactionCount: number;
  averageSale: number;
  topItems: TopItem[];
  pendingBalance: number;
  totalSettled: number;
  recentSales: SaleRow[];
  counts: { settled: number; pending: number; failed: number };
};

export type SalesResponse = {
  range: VendorRange;
  rangeLabel: string;
  summary: {
    gross: number;
    transactions: number;
    average: number;
    netSettlement: number;
    fees: number;
  };
  topItems: TopItem[];
  payments: SaleRow[];
  counts: { total: number; settled: number; pending: number; failed: number };
};

export type MenuItemRow = {
  id: string;
  vendorId: string;
  universityId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  imageUrl: string | null;
  available: boolean;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type MenuResponse = {
  items: MenuItemRow[];
  summary: {
    total: number;
    available: number;
    pendingApproval: number;
    rejected: number;
  };
};

export type PayoutRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
};

export type SettlementResponse = {
  pendingBalance: number;
  totalSettled: number;
  settlementAccount: string;
  minimumPayout: number;
  payouts: PayoutRow[];
  recentPayments: SaleRow[];
};

export type SettlementResult = {
  settlement: PayoutRow;
  pendingBalance: number;
  totalSettled: number;
  settlementAccount: string;
  message: string;
};

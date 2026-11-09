/**
 * Shared response contracts for the super-admin console.
 *
 * These types are imported by both the API routes (server) and the client
 * views, so a change to an API payload fails the TypeScript build until the
 * matching page types are updated too.
 */

export type LedgerCheck = {
  debits: number;
  credits: number;
  balanced: boolean;
  difference: number;
  entries: number;
};

/** A minimal transaction row used for in-memory aggregation. */
export type TxSlice = {
  universityId: string;
  amount: number;
  platformFee: number;
  aggregatorFee: number;
  universityRevenue: number;
  type: string;
  status: string;
  createdAt: string;
};

/** Aggregated transaction metrics for a time window / tenant. */
export type SliceTotals = {
  gmv: number;
  platformFee: number;
  universityRevenue: number;
  apiFeesCollected: number;
  aggregatorCosts: number;
  topupVolume: number;
  transactions: number;
  settled: number;
  failed: number;
  pending: number;
};

export type InvoiceLite = {
  id: string;
  reference: string;
  period: string;
  amount: number;
  status: string;
  issuedAt: string;
};

export type TenantHealth = 'OPERATIONAL' | 'DEGRADED' | 'SUSPENDED';

export type TenantSummary = {
  id: string;
  name: string;
  code: string;
  city: string;
  routeCode: string;
  status: string;
  saasFee: number;
  brandColor: string;
  createdAt: string;
  students: number;
  vendors: number;
  adminName: string | null;
  adminPhone: string | null;
  gmvToday: number;
  revenueToday: number;
  transactionsToday: number;
  gmv30d: number;
  monthlyRevenue: number;
  platformFee30d: number;
  universityRevenue30d: number;
  apiFeesCollected30d: number;
  aggregatorCosts30d: number;
  topupVolume30d: number;
  transactionNet30d: number;
  successRate7d: number;
  failed7d: number;
  health: TenantHealth;
  lastInvoice: InvoiceLite | null;
};

export type PlatformPulse = {
  gmvToday: number;
  gmvYesterday: number;
  gmv7d: number;
  gmv30d: number;
  testGmvToday: number;
  testGmv7d: number;
  testPaymentsToday: number;
  testPayments7d: number;
  gmvChangePercent: number | null;
  platformFeeToday: number;
  platformFee7d: number;
  platformFeePrev7d: number;
  platformFee30d: number;
  platformFeeChangePercent: number | null;
  transactionNet30d: number;
  apiFeesCollected30d: number;
  aggregatorCosts30d: number;
  universityRevenue30d: number;
  topupVolume30d: number;
  saasMrr: number;
  saasCollected: number;
  saasOutstanding: number;
  activeTenants: number;
  totalTenants: number;
  totalStudents: number;
  totalVendors: number;
  transactionsToday: number;
  successRate7d: number;
  successRateToday: number;
  failedToday: number;
  pendingRefunds: number;
  ledgerBalanced: boolean;
};

export type ChartPoint = {
  date: string;
  label: string;
  revenue: number;
  transactions: number;
  gmv: number;
};

export type OverviewData = {
  generatedAt: string;
  universities: TenantSummary[];
  platform: PlatformPulse;
  chart: ChartPoint[];
};

export type TenantListData = {
  generatedAt: string;
  tenants: TenantSummary[];
  summary: {
    total: number;
    active: number;
    suspended: number;
    students: number;
    vendors: number;
    saasMrr: number;
    pendingInvoices: number;
  };
};

export type MonthPoint = {
  period: string;
  label: string;
  gmv: number;
  platformFee: number;
  saas: number;
  saasCollected: number;
  apiFeesCollected: number;
  aggregatorCosts: number;
  universityRevenue: number;
  platformNet: number;
  transactions: number;
  topupVolume: number;
};

export type TenantRevenue = {
  id: string;
  name: string;
  code: string;
  status: string;
  gmv: number;
  platformFee: number;
  universityRevenue: number;
  apiFeesCollected: number;
  aggregatorCosts: number;
  transactionNet: number;
  saasCollected: number;
  saasBilled: number;
  platformNet: number;
  transactions: number;
  topupVolume: number;
};

export type RevenueTotals = {
  saasCollected: number;
  saasBilled: number;
  saasOutstanding: number;
  platformTransactionNet: number;
  totalPlatformRevenue: number;
  topupVolume: number;
  transactionCount: number;
  failedPayments: number;
  pendingInvoices: number;
};

export type RevenueData = {
  generatedAt: string;
  grossVolume: number;
  transactionFees: number;
  platformNet: number;
  saasRevenue: number;
  apiFeesCollected: number;
  aggregatorCosts: number;
  universityRevenue: number;
  feeModel: {
    platformFeePercent: number;
    apiFeePercent: number;
    universitySharePercent: number;
  };
  totals: RevenueTotals;
  series: MonthPoint[];
  perTenant: TenantRevenue[];
  ledger: LedgerCheck;
};

export type ServiceStatus = 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';

export type ServiceHealth = {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  detail: string;
  mock: boolean;
};

export type Incident = {
  id: string;
  reference: string;
  service: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  universityName: string;
  universityCode: string;
  amount: number;
  failureReason: string;
  occurredAt: string;
};

export type HealthTrendPoint = {
  date: string;
  label: string;
  settled: number;
  failed: number;
};

export type HealthData = {
  generatedAt: string;
  uptimePercent: number;
  uptimeMock: true;
  successRate: number;
  successRateToday: number;
  settled7d: number;
  failed7d: number;
  avgLatencyMs: number;
  latencyMock: true;
  measuredDbLatencyMs: number;
  ledgerBalanced: boolean;
  failedToday: number;
  pendingRefunds: number;
  activePaymentTokens: number;
  services: ServiceHealth[];
  incidents: Incident[];
  ledger: LedgerCheck;
  trend: HealthTrendPoint[];
};

export type TenantCore = {
  id: string;
  name: string;
  code: string;
  city: string;
  routeCode: string;
  status: string;
  saasFee: number;
  brandColor: string;
  createdAt: string;
};

export type TenantMutationResult = {
  university: TenantCore;
  admin?: { name: string; phone: string };
  invoice?: InvoiceLite;
};

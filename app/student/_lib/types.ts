/** Response shapes shared by student pages and their API routes. */
import type { TxStatus } from '@/lib/constants';
import type { OrderView } from '@/lib/orders/types';

export type StudentTx = {
  id: string;
  reference: string;
  amount: number;
  type: 'PAYMENT';
  status: TxStatus;
  createdAt: string;
  vendor?: { name: string; code: string };
  channel: string;
  metadataSummary: string;
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
  pendingOrders: OrderView[];
};

export type StudentCheckoutData = {
  student: StudentDashboardData['student'];
  orders: OrderView[];
  vendors: Array<{ id: string; code: string; name: string; description: string }>;
  vendorLoadError: boolean;
};

export type TransactionsData = {
  transactions: StudentTx[];
  counts: { total: number; settled: number; pending: number; failed: number };
  totalSpent: number;
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
    pendingCreditRequests: number;
    pendingCoupons: number;
  };
};

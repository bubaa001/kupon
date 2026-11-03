import type { Prisma } from '@prisma/client';
import { NETWORK_LABEL, TX_TYPE_LABEL, type TxType } from '@/lib/constants';
import { maskPhone, safeJson } from '@/lib/utils';

/** Prisma include shared by every admin transaction list. */
export const txInclude = {
  student: {
    select: {
      studentId: true,
      user: { select: { name: true, phone: true } },
    },
  },
  vendor: { select: { id: true, name: true, code: true } },
} satisfies Prisma.TransactionInclude;

export type TxRecord = Prisma.TransactionGetPayload<{ include: typeof txInclude }>;

export type AdminTxRow = {
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
  student: {
    id: string;
    name: string;
    studentId: string;
    phone: string;
  };
  vendor: { id: string; name: string; code: string } | null;
};

export function parseMetadata(metadata: string | null | undefined): Record<string, unknown> {
  return safeJson<Record<string, unknown>>(metadata, {});
}

function metadataSummary(
  type: string,
  metadata: Record<string, unknown>,
): string | null {
  if (typeof metadata.item === 'string' && metadata.item.length > 0) return metadata.item;
  if (typeof metadata.reasonLabel === 'string' && metadata.reasonLabel.length > 0) {
    return metadata.reasonLabel;
  }
  if (typeof metadata.reason === 'string' && metadata.reason.length > 0) return metadata.reason;
  if (typeof metadata.note === 'string' && metadata.note.length > 0) return metadata.note;
  if (type === 'TOPUP' && typeof metadata.lipaNamba === 'string') {
    return `Lipa Namba ${metadata.lipaNamba}`;
  }
  if (typeof metadata.vendorName === 'string') return metadata.vendorName;
  return null;
}

function channelFor(record: TxRecord): string {
  if (record.network) return NETWORK_LABEL[record.network] ?? record.network;
  switch (record.type) {
    case 'PAYMENT':
      return 'Campus QR';
    case 'REFUND':
      return 'Wallet refund';
    case 'WITHDRAWAL':
      return 'Mobile payout';
    case 'TOPUP':
      return 'Mobile money';
    case 'ADJUSTMENT_CREDIT':
    case 'ADJUSTMENT_DEBIT':
      return 'Manual ledger';
    default:
      return 'Wallet';
  }
}

export function serializeTx(record: TxRecord): AdminTxRow {
  const metadata = parseMetadata(record.metadata);
  return {
    id: record.id,
    reference: record.reference,
    amount: record.amount,
    fee: record.fee,
    platformFee: record.platformFee,
    aggregatorFee: record.aggregatorFee,
    universityRevenue: record.universityRevenue,
    vendorSettlement: record.vendorSettlement,
    type: record.type,
    typeLabel: TX_TYPE_LABEL[record.type as TxType] ?? record.type,
    status: record.status,
    channel: channelFor(record),
    metadataSummary: metadataSummary(record.type, metadata),
    failureReason: record.failureReason ?? null,
    routeCode: record.routeCode ?? null,
    createdAt: record.createdAt.toISOString(),
    settledAt: record.settledAt ? record.settledAt.toISOString() : null,
    student: {
      id: record.studentId,
      name: record.student.user.name,
      studentId: record.student.studentId,
      // Never expose another user's full MSISDN through the admin API.
      phone: maskPhone(record.student.user.phone),
    },
    vendor: record.vendor
      ? { id: record.vendor.id, name: record.vendor.name, code: record.vendor.code }
      : null,
  };
}

export function serializeVendor(
  vendor: {
    id: string;
    name: string;
    code: string;
    description: string;
    settlementAccount: string;
    pendingBalance: number;
    totalSettled: number;
    status: string;
    createdAt: Date;
    user: { name: string; phone: string };
  },
  extra: { salesToday: number; transactionsToday: number },
) {
  return {
    id: vendor.id,
    name: vendor.name,
    code: vendor.code,
    description: vendor.description,
    settlementAccount: vendor.settlementAccount,
    pendingBalance: vendor.pendingBalance,
    totalSettled: vendor.totalSettled,
    status: vendor.status,
    ownerName: vendor.user.name,
    ownerPhone: maskPhone(vendor.user.phone),
    createdAt: vendor.createdAt.toISOString(),
    salesToday: extra.salesToday,
    transactionsToday: extra.transactionsToday,
  };
}

export function maskStudentPhone(phone: string): string {
  return maskPhone(phone);
}

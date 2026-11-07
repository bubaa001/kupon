import type { Prisma, RefundRequest } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireApiUser, requireStudent, type AuthUser } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { NETWORK_LABEL, type TxType } from '@/lib/constants';
import { safeJson } from '@/lib/utils';
import type { RefundRequestApi, StudentTx } from '@/app/student/_lib/types';

/**
 * Shared helpers for every `/api/student/**` route.
 *
 * The student profile is always derived from the signed session — a route must
 * never accept a `studentId` from the client (see docs/API_CONTRACTS.md).
 */
export type StudentContext = {
  user: AuthUser;
  student: NonNullable<AuthUser['student']>;
};

export async function getStudentContext(): Promise<StudentContext> {
  const user = await requireApiUser(['STUDENT']);
  const student = requireStudent(user);
  return { user, student };
}

export type TransactionWithVendor = Prisma.TransactionGetPayload<{
  include: { vendor: { select: { name: true; code: true } } };
}>;

function channelFor(tx: TransactionWithVendor, metadata: Record<string, unknown>): string {
  switch (tx.type) {
    case 'TOPUP':
      if (metadata.channel === 'AZAMPAY_CARD') return 'Bank card';
      return tx.network ? NETWORK_LABEL[tx.network] ?? tx.network : 'Mobile money';
    case 'PAYMENT':
      return metadata.channel === 'USSD' ? 'USSD' : 'QR';
    case 'REFUND':
      return 'Wallet refund';
    case 'WITHDRAWAL':
      return 'Mobile payout';
    default:
      return 'Admin';
  }
}

function summaryFor(tx: TransactionWithVendor, metadata: Record<string, unknown>): string {
  switch (tx.type) {
    case 'PAYMENT':
      return typeof metadata.item === 'string' && metadata.item.length > 0
        ? metadata.item
        : 'Cafeteria meal';
    case 'TOPUP':
      if (metadata.channel === 'AZAMPAY_CARD') return 'Wallet top-up by card';
      return tx.routeCode ? `Lipa Namba ${tx.routeCode}` : 'Mobile money top-up';
    case 'REFUND': {
      if (typeof metadata.reasonLabel === 'string' && metadata.reasonLabel.length > 0) {
        return metadata.reasonLabel;
      }
      return typeof metadata.reason === 'string' && metadata.reason.length > 0
        ? metadata.reason
        : 'Order refund';
    }
    case 'WITHDRAWAL':
      return typeof metadata.reason === 'string' && metadata.reason.length > 0
        ? metadata.reason
        : 'Cash-out payout';
    case 'ADJUSTMENT_CREDIT':
    case 'ADJUSTMENT_DEBIT':
      return typeof metadata.reason === 'string' && metadata.reason.length > 0
        ? metadata.reason
        : 'Admin wallet adjustment';
    default:
      return 'Kupon transaction';
  }
}

/**
 * Maps a Prisma transaction to the public `Tx` shape. Metadata is sanitised:
 * only a human summary is exposed, never provider payloads or other students'
 * identifiers.
 */
export function serializeTransaction(tx: TransactionWithVendor): StudentTx {
  const metadata = safeJson<Record<string, unknown>>(tx.metadata, {});
  return {
    id: tx.id,
    reference: tx.reference,
    amount: tx.amount,
    type: tx.type as TxType,
    status: tx.status as StudentTx['status'],
    createdAt: tx.createdAt.toISOString(),
    vendor: tx.vendor ? { name: tx.vendor.name, code: tx.vendor.code } : undefined,
    channel: channelFor(tx, metadata),
    metadataSummary: summaryFor(tx, metadata),
  };
}

/** Wallet is the accounting record; StudentProfile.walletBalance is the cache. */
export async function getStudentBalance(studentProfileId: string): Promise<number> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { walletBalance: true, wallet: { select: { balance: true } } },
  });
  if (!profile) throw notFound('Student wallet not found.');
  return profile.wallet?.balance ?? profile.walletBalance;
}

export function serializeRefund(request: RefundRequest): RefundRequestApi {
  return {
    id: request.id,
    reference: request.reference,
    amount: request.amount,
    reason: request.reason,
    status: request.status as RefundRequestApi['status'],
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

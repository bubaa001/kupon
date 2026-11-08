import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireApiUser, requireStudent, type AuthUser } from '@/lib/auth';
import { NETWORK_LABEL } from '@/lib/constants';
import { safeJson } from '@/lib/utils';
import type { StudentTx } from '@/app/student/_lib/types';

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
  if (tx.isTest) return 'Kupon test gateway';
  if (metadata.channel === 'USSD') return 'USSD';
  return tx.network ? NETWORK_LABEL[tx.network] ?? tx.network : 'Mobile money';
}

function summaryFor(tx: TransactionWithVendor, metadata: Record<string, unknown>): string {
  return typeof metadata.item === 'string' && metadata.item.length > 0
    ? metadata.item
    : tx.type === 'PAYMENT'
      ? 'Cafeteria meal'
      : 'Kupon transaction';
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
    type: 'PAYMENT',
    status: tx.status as StudentTx['status'],
    createdAt: tx.createdAt.toISOString(),
    vendor: tx.vendor ? { name: tx.vendor.name, code: tx.vendor.code } : undefined,
    channel: channelFor(tx, metadata),
    metadataSummary: summaryFor(tx, metadata),
  };
}

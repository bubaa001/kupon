import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { TX_STATUSES, TX_TYPES } from '@/lib/constants';
import { getRange } from '@/lib/dates';
import { tenantWhere } from '@/lib/tenant';
import type { AuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { txInclude, serializeTx, type AdminTxRow } from './serializers';

export const ADMIN_RANGES = ['today', '7d', '30d', 'mtd', 'all'] as const;
export type AdminRange = (typeof ADMIN_RANGES)[number];

export const txQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum([...TX_STATUSES] as [string, ...string[]]).optional(),
  type: z.enum([...TX_TYPES] as [string, ...string[]]).optional(),
  range: z.enum(ADMIN_RANGES).default('7d'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  universityId: z.string().min(1).optional(),
});

export type TxQuery = z.infer<typeof txQuerySchema>;

/** Builds the tenant-scoped `where` for transaction list, export and search. */
export function buildTxWhere(user: AuthUser, query: TxQuery): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {
    isTest: false,
    ...tenantWhere(user, query.universityId),
  };

  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  if (query.range !== 'all') {
    const { start, end } = getRange(query.range);
    where.createdAt = { gte: start, lte: end };
  }

  if (query.q) {
    const term = query.q;
    const digits = term.replace(/[^\d]/g, '');
    const search: Prisma.TransactionWhereInput[] = [
      { reference: { contains: term } },
      { student: { is: { studentId: { contains: term } } } },
      { student: { is: { user: { is: { name: { contains: term } } } } } },
      { vendor: { is: { name: { contains: term } } } },
      { vendor: { is: { code: { contains: term } } } },
    ];
    if (digits.length > 0 && digits.length <= 9) {
      search.push({ amount: Number(digits) });
    }
    where.OR = search;
  }

  return where;
}

export type TxSummary = { gross: number; fees: number; net: number; count: number };

const EMPTY_SUMMARY: TxSummary = { gross: 0, fees: 0, net: 0, count: 0 };

export async function loadTransactions(
  where: Prisma.TransactionWhereInput,
  options: { page: number; pageSize: number },
): Promise<{ rows: AdminTxRow[]; total: number; summary: TxSummary }> {
  const [records, total, settled] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: txInclude,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'PAYMENT', status: 'SETTLED' },
      _sum: { amount: true, platformFee: true },
    }),
  ]);

  const gross = settled._sum.amount ?? 0;
  const fees = settled._sum.platformFee ?? 0;

  return {
    rows: records.map(serializeTx),
    total,
    summary: total === 0 ? EMPTY_SUMMARY : { gross, fees, net: gross - fees, count: total },
  };
}

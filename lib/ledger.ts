import type { Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';

export const LEDGER_ACCOUNTS = {
  STUDENT_WALLET: 'STUDENT_WALLET',
  VENDOR_PENDING: 'VENDOR_PENDING',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  UNIVERSITY_REVENUE: 'UNIVERSITY_REVENUE',
  AGGREGATOR_PAYABLE: 'AGGREGATOR_PAYABLE',
  CASH_TRUST: 'CASH_TRUST',
} as const;

export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[keyof typeof LEDGER_ACCOUNTS];

export type LedgerLine = {
  account: LedgerAccount;
  debit?: number;
  credit?: number;
  description?: string;
};

/**
 * Writes a balanced double-entry journal for one transaction.
 * Throws (and therefore rolls back the enclosing database transaction) if debits
 * and credits do not agree. This is the invariant that keeps the ledger honest.
 */
export async function postJournal(
  tx: Prisma.TransactionClient,
  input: {
    transactionId: string;
    universityId: string;
    description?: string;
    lines: LedgerLine[];
  },
) {
  const lines = input.lines.filter((line) => (line.debit ?? 0) !== 0 || (line.credit ?? 0) !== 0);
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);

  if (totalDebit !== totalCredit) {
    throw new AppError(
      `Ledger is unbalanced: debits ${totalDebit} ≠ credits ${totalCredit}.`,
      500,
      'LEDGER_UNBALANCED',
    );
  }

  return tx.ledgerEntry.createMany({
    data: lines.map((line) => ({
      transactionId: input.transactionId,
      universityId: input.universityId,
      account: line.account,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      description: line.description ?? input.description ?? null,
    })),
  });
}

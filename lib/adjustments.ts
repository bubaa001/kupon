import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { AppError, notFound } from '@/lib/errors';
import { postJournal, LEDGER_ACCOUNTS } from '@/lib/ledger';
import { creditWallet, debitWallet } from '@/lib/wallet';
import { randomReference } from '@/lib/utils';

/**
 * Admin manual credit/debit. Money always moves through the wallet + ledger,
 * not by mutating a balance in place, and an immutable audit entry is written.
 */
export async function adjustStudentWallet(input: {
  studentProfileId: string;
  universityId: string;
  actorId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: input.studentProfileId },
      include: { user: { select: { name: true } }, university: { select: { paymentRouteCode: true } } },
    });
    if (!student) throw notFound('Student not found.');
    if (student.universityId !== input.universityId) {
      throw new AppError('Cross-tenant adjustment blocked.', 403, 'TENANT_MISMATCH');
    }

    const isCredit = input.type === 'CREDIT';
    const balance = isCredit
      ? await creditWallet(tx, student.id, input.amount)
      : await debitWallet(tx, student.id, input.amount);

    const reference = randomReference(isCredit ? 'ADJ+' : 'ADJ-');
    const transaction = await tx.transaction.create({
      data: {
        reference,
        universityId: student.universityId,
        studentId: student.id,
        amount: input.amount,
        fee: 0,
        type: isCredit ? 'ADJUSTMENT_CREDIT' : 'ADJUSTMENT_DEBIT',
        status: 'SETTLED',
        routeCode: student.university.paymentRouteCode,
        settledAt: new Date(),
        metadata: JSON.stringify({
          reason: input.reason,
          actorId: input.actorId,
          channel: 'ADMIN_ADJUSTMENT',
        }),
      },
    });

    await postJournal(tx, {
      transactionId: transaction.id,
      universityId: student.universityId,
      description: `Admin manual ${input.type.toLowerCase()}`,
      lines: isCredit
        ? [
            { account: LEDGER_ACCOUNTS.CASH_TRUST, debit: input.amount },
            { account: LEDGER_ACCOUNTS.STUDENT_WALLET, credit: input.amount },
          ]
        : [
            { account: LEDGER_ACCOUNTS.STUDENT_WALLET, debit: input.amount },
            { account: LEDGER_ACCOUNTS.CASH_TRUST, credit: input.amount },
          ],
    });

    await auditLog(
      {
        actorId: input.actorId,
        universityId: student.universityId,
        action: isCredit ? 'WALLET_MANUAL_CREDIT' : 'WALLET_MANUAL_DEBIT',
        entity: 'StudentProfile',
        entityId: student.id,
        metadata: {
          amount: input.amount,
          reason: input.reason,
          studentName: student.user.name,
          reference,
          balanceAfter: balance,
        },
      },
      tx,
    );

    return { transaction, balance, reference, studentName: student.user.name };
  });
}

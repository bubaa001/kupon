import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { AppError, conflict, notFound } from '@/lib/errors';
import { postJournal, LEDGER_ACCOUNTS } from '@/lib/ledger';
import { creditWallet, debitWallet } from '@/lib/wallet';
import { REQUEST_AUDIT_ACTIONS } from '@/lib/constants';
import { randomReference } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { getPaymentProvider } from './index';
import {
  adminMoneyRequestInclude,
  networkForPhone,
  type AdminMoneyRequestRecord,
} from './money-requests';
import type { WithdrawalPayoutResult } from './types';

/**
 * WITHDRAWAL review + money movement.
 *
 * A withdrawal is a student cashing out *available wallet balance* to mobile
 * money. It is never tied to an order. Creating the request moves no money; the
 * approve path below is the only place a wallet is debited:
 *
 *   1. one database transaction claims PENDING → APPROVED with a conditional
 *      `updateMany`, then performs the conditional wallet debit, creates a
 *      `WITHDRAWAL` transaction and posts a balanced journal. If the debit fails
 *      (insufficient funds / concurrent spend) the claim rolls back with it.
 *   2. the external payout rail is called once, using the request reference as an
 *      idempotency key.
 *   3. the withdrawal transaction is marked SETTLED and the admin audit entry is
 *      written. If the payout rail throws, a compensating transaction re-credits
 *      the wallet, reverses the journal and returns the request to PENDING.
 *
 * Two admins approving the same request cannot double-pay: the second conditional
 * claim matches zero rows and receives `409 CONFLICT`.
 */
export async function approveWithdrawal(input: {
  requestId: string;
  reviewerId: string;
  adminNote?: string | null;
}): Promise<{
  request: AdminMoneyRequestRecord;
  payout: WithdrawalPayoutResult;
  balance: number;
  transactionReference: string;
}> {
  const request = await prisma.refundRequest.findUnique({
    where: { id: input.requestId },
    include: {
      student: { include: { user: { select: { name: true, phone: true } } } },
      university: {
        select: { id: true, code: true, paymentRouteCode: true, status: true },
      },
    },
  });
  if (!request) throw notFound('Withdrawal request not found.');
  if (request.kind !== 'WITHDRAWAL') {
    throw conflict('This request is an order refund, not a withdrawal. Review it in the refunds queue.');
  }
  if (request.status !== 'PENDING') {
    throw conflict(
      `This withdrawal was already ${request.status.toLowerCase()} and can no longer be approved.`,
    );
  }
  if (request.university.status !== 'ACTIVE') {
    throw conflict('This university is suspended. Withdrawals are paused.');
  }

  const requestedNetwork = networkForPhone(request.student.user.phone);
  const adminNote = input.adminNote?.trim() || null;

  // Step 1 — claim + wallet debit + transaction + journal are one atomic unit.
  const moved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refundRequest.updateMany({
      where: { id: request.id, kind: 'WITHDRAWAL', status: 'PENDING' },
      data: {
        status: 'APPROVED',
        adminNote,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        payoutStatus: 'PENDING',
      },
    });
    if (claimed.count === 0) {
      throw conflict('Another admin just reviewed this withdrawal. Refresh the queue.');
    }

    // Conditional debit: throws 402 INSUFFICIENT_FUNDS, rolling back the claim.
    const balance = await debitWallet(tx, request.studentId, request.amount);

    const transaction = await tx.transaction.create({
      data: {
        reference: randomReference('WDR'),
        universityId: request.universityId,
        studentId: request.studentId,
        amount: request.amount,
        fee: 0,
        type: 'WITHDRAWAL',
        status: 'PENDING', // payout rail has not confirmed yet
        phone: request.student.user.phone,
        network: requestedNetwork,
        routeCode: request.university.paymentRouteCode,
        metadata: JSON.stringify({
          kind: 'WITHDRAWAL',
          provider: 'snippe-mock',
          withdrawalRequestId: request.id,
          requestReference: request.reference,
          reason: request.reason,
          reviewedBy: input.reviewerId,
          note: adminNote,
          routeCode: request.university.paymentRouteCode,
        }),
      },
    });

    await postJournal(tx, {
      transactionId: transaction.id,
      universityId: request.universityId,
      description: `Mobile-money withdrawal • ${request.reference}`,
      lines: [
        {
          account: LEDGER_ACCOUNTS.STUDENT_WALLET,
          debit: request.amount,
          description: 'Student wallet debited for cash-out',
        },
        {
          account: LEDGER_ACCOUNTS.CASH_TRUST,
          credit: request.amount,
          description: 'Cash released to mobile-money payout',
        },
      ],
    });

    return { transaction, balance };
  });

  // Step 2 — external payout, idempotent by reference.
  let payout: WithdrawalPayoutResult;
  try {
    payout = await getPaymentProvider().initiateWithdrawal({
      reference: request.reference,
      universityId: request.universityId,
      studentProfileId: request.studentId,
      amount: request.amount,
      phone: request.student.user.phone,
      network: requestedNetwork,
      actorId: input.reviewerId,
    });
    if (payout.status === 'FAILED') {
      throw new AppError(payout.message || 'The payout rail rejected this withdrawal.', 502, 'PAYOUT_FAILED');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown payout error';
    await compensateFailedPayout({
      requestId: request.id,
      transactionId: moved.transaction.id,
      transactionReference: moved.transaction.reference,
      studentId: request.studentId,
      universityId: request.universityId,
      amount: request.amount,
      reviewerId: input.reviewerId,
      studentName: request.student.user.name,
      requestReference: request.reference,
      message,
    });
    throw error instanceof AppError
      ? error
      : new AppError(
          'The payout failed, so the wallet debit was reversed. The request is back in the queue.',
          502,
          'PAYOUT_FAILED',
          { message },
        );
  }

  // Step 3 — finalise: settle the transaction, record the payout reference, audit.
  const updated = await prisma.$transaction(async (tx) => {
    if (payout.status === 'SETTLED') {
      await tx.transaction.updateMany({
        where: { id: moved.transaction.id, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
    }

    const row = await tx.refundRequest.update({
      where: { id: request.id },
      data: {
        payoutStatus: payout.status,
        payoutReference: payout.reference,
        payoutTransactionId: moved.transaction.id,
      },
      include: adminMoneyRequestInclude,
    });

    await auditLog(
      {
        actorId: input.reviewerId,
        universityId: request.universityId,
        action: REQUEST_AUDIT_ACTIONS.WITHDRAWAL_APPROVED,
        entity: 'RefundRequest',
        entityId: request.id,
        metadata: {
          kind: 'WITHDRAWAL',
          amount: request.amount,
          reference: request.reference,
          payoutReference: payout.reference,
          payoutStatus: payout.status,
          provider: payout.provider,
          transactionId: moved.transaction.id,
          transactionReference: moved.transaction.reference,
          balanceAfter: moved.balance,
          studentName: request.student.user.name,
          note: adminNote,
        },
      },
      tx,
    );

    return row;
  });

  // Nice-to-have only: the wallet is already debited and the audit trail exists.
  await sendSms(
    request.student.user.phone,
    `KUPON: TZS ${request.amount.toLocaleString('en-US')} imetumwa kwenye mobile money yako. Salio jipya: TZS ${moved.balance.toLocaleString('en-US')}. Ref: ${request.reference}.`,
  ).catch((error) => console.error('[withdrawal] payout SMS failed', error));

  return {
    request: updated,
    payout,
    balance: moved.balance,
    transactionReference: moved.transaction.reference,
  };
}

/** PENDING → REJECTED. No money moves; the wallet is untouched. */
export async function rejectWithdrawal(input: {
  requestId: string;
  reviewerId: string;
  adminNote?: string | null;
}): Promise<AdminMoneyRequestRecord> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.refundRequest.updateMany({
      where: { id: input.requestId, kind: 'WITHDRAWAL', status: 'PENDING' },
      data: {
        status: 'REJECTED',
        adminNote: input.adminNote?.trim() || null,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        payoutStatus: null,
      },
    });
    if (claimed.count === 0) {
      throw conflict('Another admin just reviewed this withdrawal. Refresh the queue.');
    }

    const row = await tx.refundRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: adminMoneyRequestInclude,
    });

    await auditLog(
      {
        actorId: input.reviewerId,
        universityId: row.universityId,
        action: REQUEST_AUDIT_ACTIONS.WITHDRAWAL_REJECTED,
        entity: 'RefundRequest',
        entityId: row.id,
        metadata: {
          kind: 'WITHDRAWAL',
          amount: row.amount,
          reference: row.reference,
          studentName: row.student.user.name,
          note: row.adminNote,
          balanceUnchanged: row.student.walletBalance,
        },
      },
      tx,
    );

    return row;
  });
}

/**
 * Defensive compensation for the (mock-only, normally unreachable) payout
 * failure window: restore the wallet, reverse the journal, fail the transaction
 * and put the request back in the review queue so an admin can retry.
 */
async function compensateFailedPayout(input: {
  requestId: string;
  transactionId: string;
  transactionReference: string;
  studentId: string;
  universityId: string;
  amount: number;
  reviewerId: string;
  studentName: string;
  requestReference: string;
  message: string;
}) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: input.transactionId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: input.message,
        metadata: JSON.stringify({
          kind: 'WITHDRAWAL',
          withdrawalRequestId: input.requestId,
          requestReference: input.requestReference,
          payoutFailed: true,
          message: input.message,
        }),
      },
    });
    if (claimed.count === 0) return; // already settled elsewhere — never double-credit

    await creditWallet(tx, input.studentId, input.amount);

    await postJournal(tx, {
      transactionId: input.transactionId,
      universityId: input.universityId,
      description: `Withdrawal payout failed — wallet re-credited • ${input.requestReference}`,
      lines: [
        {
          account: LEDGER_ACCOUNTS.CASH_TRUST,
          debit: input.amount,
          description: 'Failed payout cash returned to trust',
        },
        {
          account: LEDGER_ACCOUNTS.STUDENT_WALLET,
          credit: input.amount,
          description: 'Student wallet re-credited after failed payout',
        },
      ],
    });

    await tx.refundRequest.updateMany({
      where: { id: input.requestId, status: 'APPROVED' },
      data: {
        status: 'PENDING',
        adminNote: null,
        reviewedById: null,
        reviewedAt: null,
        payoutStatus: 'FAILED',
        payoutReference: null,
        payoutTransactionId: input.transactionId,
      },
    });

    await auditLog(
      {
        actorId: input.reviewerId,
        universityId: input.universityId,
        action: REQUEST_AUDIT_ACTIONS.WITHDRAWAL_PAYOUT_FAILED,
        entity: 'RefundRequest',
        entityId: input.requestId,
        metadata: {
          kind: 'WITHDRAWAL',
          amount: input.amount,
          reference: input.requestReference,
          transactionReference: input.transactionReference,
          studentName: input.studentName,
          message: input.message,
          walletRecredited: true,
        },
      },
      tx,
    );
  });
}

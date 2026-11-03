import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { AppError, badRequest, conflict, notFound } from '@/lib/errors';
import { calcPaymentFees } from '@/lib/fees';
import { postJournal, LEDGER_ACCOUNTS } from '@/lib/ledger';
import { creditWallet } from '@/lib/wallet';
import { sendSms } from '@/lib/sms';
import { randomReference } from '@/lib/utils';
import { orderInclude, serializeOrder } from './serialize';
import {
  ORDER_CANCEL_REASONS,
  ORDER_CANCEL_REASON_LABEL,
  type CancelOrderResult,
  type OrderCancelReason,
} from './types';

/**
 * Money reversal for a student-cancelled PENDING coupon.
 *
 * Placing an order is atomic (wallet debit + vendor pending credit + fee split +
 * balanced journal). Cancelling must be the exact mirror of that journal, once:
 *
 *   credit STUDENT_WALLET       order.total
 *   debit  VENDOR_PENDING       fees.vendorSettlement
 *   debit  UNIVERSITY_REVENUE   fees.universityRevenue
 *   debit  AGGREGATOR_PAYABLE   fees.aggregatorFee
 *   debit  PLATFORM_REVENUE     fees.platformNet
 *
 * The reversal is booked as its own `REFUND` transaction so the student's
 * history shows the money returning and the original PAYMENT transaction stays
 * immutable. The `updateMany(where: status='PENDING')` claim is the single-use
 * lock: a replayed request can never post the reversal twice.
 */
const CANCEL_AUDIT_ACTION = 'CANCELLED_BY_STUDENT';
const MAX_NOTE_LENGTH = 200;

type OriginalPayment = {
  amount: number;
  platformFee: number;
  aggregatorFee: number;
  universityRevenue: number;
  vendorSettlement: number;
};

/**
 * Prefer the fee split stored on the original payment transaction: fee
 * percentages can change between the order and its cancellation, and the
 * reversal must mirror what was actually booked. Fall back to a fresh
 * calculation only for legacy rows that cannot be reconciled.
 */
function resolveFees(orderTotal: number, original: OriginalPayment | null) {
  if (
    original &&
    original.amount === orderTotal &&
    original.vendorSettlement > 0 &&
    original.vendorSettlement + original.platformFee === orderTotal &&
    original.aggregatorFee + original.universityRevenue <= original.platformFee
  ) {
    return {
      platformFee: original.platformFee,
      aggregatorFee: original.aggregatorFee,
      universityRevenue: original.universityRevenue,
      vendorSettlement: original.vendorSettlement,
      platformNet: original.platformFee - original.aggregatorFee - original.universityRevenue,
    };
  }
  return calcPaymentFees(orderTotal);
}

function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

/**
 * SQLite serialises writers, so two cancels of the same coupon can collide with
 * a write conflict instead of both claiming the status. A single retry is
 * enough: on the second attempt the conditional claim fails cleanly and the
 * request returns the already-cancelled order without moving money again.
 */
async function withWriteRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt === 1 || !isWriteConflict(error)) throw error;
    }
  }
  throw new AppError('Could not cancel the order. Please try again.', 409, 'CANCEL_CONFLICT');
}

function readBalance(
  client: Prisma.TransactionClient | typeof prisma,
  studentProfileId: string,
): Promise<number> {
  return (async () => {
    const profile = await client.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { walletBalance: true, wallet: { select: { balance: true } } },
    });
    if (!profile) throw notFound('Student wallet not found.');
    return profile.wallet?.balance ?? profile.walletBalance;
  })();
}

export async function cancelStudentOrder(input: {
  studentProfileId: string;
  universityId: string;
  actorId: string;
  orderId: string;
  reason: OrderCancelReason;
  note?: string;
}): Promise<CancelOrderResult> {
  if (!ORDER_CANCEL_REASONS.includes(input.reason)) {
    throw badRequest('Choose a valid cancellation reason.');
  }
  const note = input.note?.trim() ?? '';
  if (note.length > MAX_NOTE_LENGTH) {
    throw badRequest(`The note can be at most ${MAX_NOTE_LENGTH} characters.`);
  }
  if (input.reason === 'OTHER' && note.length < 3) {
    throw badRequest('Tell us why you are cancelling (at least 3 characters).');
  }

  // Ownership + tenant boundary are part of the lookup, so another student's
  // order is indistinguishable from a missing one (no enumeration).
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      studentId: input.studentProfileId,
      universityId: input.universityId,
    },
    include: orderInclude,
  });
  if (!order) throw notFound('Coupon not found.');
  if (order.status === 'VERIFIED') {
    throw conflict(
      'This coupon was already verified at the counter, so it can no longer be cancelled.',
      { status: order.status },
    );
  }
  if (order.status === 'CANCELLED') {
    return {
      order: serializeOrder(order, null),
      balance: await readBalance(prisma, input.studentProfileId),
      refunded: false,
      alreadyCancelled: true,
      reversalReference: null,
      message: 'Coupon hii tayari imeghairiwa. Hakuna pesa iliyotolewa tena.',
    };
  }

  const outcome = await withWriteRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findFirst({
          where: {
            id: input.orderId,
            studentId: input.studentProfileId,
            universityId: input.universityId,
          },
          include: orderInclude,
        });
        if (!current) throw notFound('Coupon not found.');

        if (current.status === 'VERIFIED') {
          throw conflict(
            'This coupon was just verified at the counter, so it can no longer be cancelled.',
            { status: current.status },
          );
        }
        if (current.status === 'CANCELLED') {
          const balance = await readBalance(tx, input.studentProfileId);
          return {
            order: serializeOrder(current, null),
            balance,
            refunded: false,
            alreadyCancelled: true,
            reversalReference: null,
            message: 'Coupon hii tayari imeghairiwa. Hakuna pesa iliyotolewa tena.',
            cancelledReference: current.reference,
            total: 0,
          };
        }

        const original = current.transactionId
          ? await tx.transaction.findUnique({
              where: { id: current.transactionId },
              select: {
                amount: true,
                platformFee: true,
                aggregatorFee: true,
                universityRevenue: true,
                vendorSettlement: true,
              },
            })
          : null;
        const fees = resolveFees(current.total, original);

        // The single-use lock: only the first caller flips PENDING → CANCELLED.
        const claimed = await tx.order.updateMany({
          where: { id: current.id, studentId: input.studentProfileId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (claimed.count === 0) {
          throw conflict(
            'This coupon changed while you were cancelling it. Refresh and check its status.',
          );
        }

        const vendorBefore = await tx.vendor.findUnique({
          where: { id: current.vendorId },
          select: { pendingBalance: true },
        });
        const vendorPendingBefore = vendorBefore?.pendingBalance ?? 0;
        // The vendor may already have settled part of this sale; a negative
        // pending balance correctly records money the platform will recover
        // from future sales instead of silently losing the reversal.
        await tx.vendor.update({
          where: { id: current.vendorId },
          data: { pendingBalance: { decrement: fees.vendorSettlement } },
        });
        const vendorPendingAfter = vendorPendingBefore - fees.vendorSettlement;

        const reversalReference = randomReference('RVS');
        const reasonLabel = ORDER_CANCEL_REASON_LABEL[input.reason];
        const reversal = await tx.transaction.create({
          data: {
            reference: reversalReference,
            universityId: current.universityId,
            studentId: current.studentId,
            vendorId: current.vendorId,
            amount: current.total,
            fee: 0,
            platformFee: 0,
            aggregatorFee: 0,
            universityRevenue: 0,
            vendorSettlement: 0,
            type: 'REFUND',
            status: 'SETTLED',
            settledAt: new Date(),
            metadata: JSON.stringify({
              channel: 'ORDER_CANCEL',
              kind: 'STUDENT_CANCELLED_PENDING_ORDER',
              reason: input.reason,
              reasonLabel,
              note: note || null,
              orderId: current.id,
              orderReference: current.reference,
              couponCode: current.couponCode,
              vendorName: current.vendor.name,
              vendorCode: current.vendor.code,
              originalTransactionId: current.transactionId,
              item:
                current.items.length === 1
                  ? current.items[0].name
                  : `${current.items[0].name} + ${current.items.length - 1} more`,
              fees,
            }),
          },
        });

        const balance = await creditWallet(tx, current.studentId, current.total);

        await postJournal(tx, {
          transactionId: reversal.id,
          universityId: current.universityId,
          description: `Cancelled coupon • ${current.vendor.name}`,
          lines: [
            {
              account: LEDGER_ACCOUNTS.STUDENT_WALLET,
              credit: current.total,
              description: 'Wallet refund for cancelled coupon',
            },
            {
              account: LEDGER_ACCOUNTS.VENDOR_PENDING,
              debit: fees.vendorSettlement,
              description: 'Reverse vendor pending credit',
            },
            {
              account: LEDGER_ACCOUNTS.UNIVERSITY_REVENUE,
              debit: fees.universityRevenue,
              description: 'Reverse university revenue share',
            },
            {
              account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE,
              debit: fees.aggregatorFee,
              description: 'Reverse aggregator fee',
            },
            {
              account: LEDGER_ACCOUNTS.PLATFORM_REVENUE,
              debit: fees.platformNet,
              description: 'Reverse platform revenue',
            },
          ],
        });

        const updated = await tx.order.findUniqueOrThrow({
          where: { id: current.id },
          include: orderInclude,
        });

        await auditLog(
          {
            actorId: input.actorId,
            universityId: current.universityId,
            action: CANCEL_AUDIT_ACTION,
            entity: 'Order',
            entityId: current.id,
            metadata: {
              reference: current.reference,
              couponCode: current.couponCode,
              total: current.total,
              reason: input.reason,
              reasonLabel,
              note: note || null,
              vendorId: current.vendorId,
              vendorName: current.vendor.name,
              vendorPendingBefore,
              vendorPendingAfter,
              vendorPendingShortfall: vendorPendingAfter < 0,
              originalTransactionId: current.transactionId,
              reversalTransactionId: reversal.id,
              reversalReference,
              balanceAfter: balance,
              fees,
              source: 'student-app',
            },
          },
          tx,
        );

        return {
          order: serializeOrder(updated, null),
          balance,
          refunded: true,
          alreadyCancelled: false,
          reversalReference,
          message: `Order ${current.reference} imeghairiwa. TZS ${current.total.toLocaleString(
            'en-US',
          )} imerejeshwa kwenye wallet yako.`,
          cancelledReference: current.reference,
          total: current.total,
        };
      },
      { maxWait: 5_000, timeout: 10_000 },
    ),
  );

  // Best-effort SMS receipt after the money is safely reversed. Never let the
  // mock gateway turn a completed cancellation into an error response.
  if (outcome.refunded) {
    try {
      await sendSms(
        order.student.user.phone,
        `KUPON: Order ${outcome.cancelledReference} imeghairiwa. TZS ${outcome.total.toLocaleString(
          'en-US',
        )} imerejeshwa kwenye wallet yako. Salio: TZS ${outcome.balance.toLocaleString('en-US')}.`,
      );
    } catch (error) {
      console.error('[orders:cancel] Could not send cancellation SMS', error);
    }
  }

  return {
    order: outcome.order,
    balance: outcome.balance,
    refunded: outcome.refunded,
    alreadyCancelled: outcome.alreadyCancelled,
    reversalReference: outcome.reversalReference,
    message: outcome.message,
  };
}

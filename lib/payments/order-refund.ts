import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { AppError, conflict, notFound } from '@/lib/errors';
import { calcPaymentFees } from '@/lib/fees';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { creditWallet } from '@/lib/wallet';
import { REQUEST_AUDIT_ACTIONS } from '@/lib/constants';
import { randomReference } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import {
  adminMoneyRequestInclude,
  type AdminMoneyRequestRecord,
} from './money-requests';

/**
 * ORDER REFUND review + reversal.
 *
 * A refund returns money for ONE specific paid, vendor-verified order. It is the
 * exact inverse of the order placement journal:
 *
 *   student wallet      +total              (credit)
 *   vendor pending      −vendorSettlement   (debit)
 *   university revenue  −universityRevenue  (debit)
 *   aggregator payable  −aggregatorFee      (debit)
 *   platform revenue    −platformNet        (debit)
 *
 * No external payout is involved — the student's wallet is re-credited, so the
 * money never leaves the platform. Pending orders are deliberately rejected here:
 * a student cancels a pending order (auto-reversal in the orders flow) instead.
 *
 * Exactly-once guarantees:
 * - the PENDING → APPROVED claim is a conditional `updateMany` inside the same
 *   transaction as the wallet credit and journal, so two admins cannot double-pay;
 * - approval re-checks that no other approved refund exists for the order;
 * - a failed writer rolls the claim back, leaving the request PENDING.
 */
export async function approveOrderRefund(input: {
  requestId: string;
  reviewerId: string;
  adminNote?: string | null;
}): Promise<{
  request: AdminMoneyRequestRecord;
  balance: number;
  transactionReference: string;
}> {
  const request = await prisma.refundRequest.findUnique({
    where: { id: input.requestId },
    include: {
      ...adminMoneyRequestInclude,
      student: {
        select: {
          id: true,
          studentId: true,
          course: true,
          year: true,
          walletBalance: true,
          user: { select: { name: true, phone: true } },
        },
      },
      university: {
        select: { id: true, code: true, paymentRouteCode: true, status: true },
      },
      transaction: true,
    },
  });
  if (!request) throw notFound('Refund request not found.');
  if (request.kind !== 'REFUND') {
    throw conflict('This request is a withdrawal, not an order refund. Review it in the withdrawals queue.');
  }
  if (!request.order || !request.orderId) {
    throw conflict('This refund request is missing the order it refers to.');
  }
  if (!request.transaction || !request.transactionId) {
    throw conflict('This refund request is missing its original payment transaction.');
  }
  if (request.status !== 'PENDING') {
    throw conflict(
      `This refund was already ${request.status.toLowerCase()} and can no longer be approved.`,
    );
  }

  const order = request.order;
  const payment = request.transaction;

  if (order.testOnly || payment.isTest) {
    throw conflict('Test-only orders cannot be refunded as real money.');
  }

  if (order.studentId !== request.studentId || order.universityId !== request.universityId) {
    throw new AppError('Cross-tenant refund blocked.', 403, 'TENANT_MISMATCH');
  }
  if (payment.studentId !== request.studentId || payment.universityId !== request.universityId) {
    throw new AppError('The original payment belongs to another wallet.', 403, 'TENANT_MISMATCH');
  }
  if (request.university.status !== 'ACTIVE') {
    throw conflict('This university is suspended. Refunds are paused.');
  }
  if (order.status === 'PENDING') {
    throw conflict(
      'This order is still pending vendor verification. Pending orders are cancelled from the student coupon, not refunded.',
    );
  }
  if (order.status === 'CANCELLED') {
    throw conflict('This order was already cancelled and reversed, so it cannot be refunded.');
  }
  if (order.status !== 'VERIFIED') {
    throw conflict(`Only vendor-verified orders can be refunded (this order is ${order.status}).`);
  }
  if (payment.type !== 'PAYMENT' || payment.status !== 'SETTLED') {
    throw conflict('The original order payment is not settled, so it cannot be reversed.');
  }
  if (payment.amount !== order.total || request.amount !== order.total) {
    throw conflict(
      'The refund amount no longer matches the order total. Reconcile the ledger before approving.',
    );
  }

  const split = resolveOrderPaymentSplit(payment);
  const adminNote = input.adminNote?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refundRequest.updateMany({
      where: { id: request.id, kind: 'REFUND', status: 'PENDING' },
      data: {
        status: 'APPROVED',
        adminNote,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        payoutStatus: 'SETTLED',
      },
    });
    if (claimed.count === 0) {
      throw conflict('Another admin just reviewed this refund. Refresh the queue.');
    }

    // Second guard: one reversal per order, even across two different requests.
    const alreadyReversed = await tx.refundRequest.count({
      where: {
        orderId: order.id,
        kind: 'REFUND',
        status: 'APPROVED',
        id: { not: request.id },
      },
    });
    if (alreadyReversed > 0) {
      throw conflict('This order has already been refunded.');
    }

    const balance = await creditWallet(tx, request.studentId, order.total);

    // Ledger is the accounting record; the cached vendor pending balance may go
    // negative when the vendor was already settled, which represents a clawback.
    await tx.vendor.update({
      where: { id: order.vendorId },
      data: { pendingBalance: { decrement: split.vendorSettlement } },
    });

    const refundTransaction = await tx.transaction.create({
      data: {
        reference: randomReference('RFD'),
        universityId: request.universityId,
        studentId: request.studentId,
        vendorId: order.vendorId,
        amount: order.total,
        fee: 0,
        type: 'REFUND',
        status: 'SETTLED',
        phone: request.student.user.phone,
        routeCode: request.university.paymentRouteCode,
        settledAt: new Date(),
        metadata: JSON.stringify({
          kind: 'ORDER_REFUND',
          channel: 'ORDER_REFUND',
          provider: 'kupon-ledger',
          withdrawalRequest: false,
          refundRequestId: request.id,
          refundRequestReference: request.reference,
          orderId: order.id,
          orderReference: order.reference,
          couponCode: order.couponCode,
          originalTransactionId: payment.id,
          originalTransactionReference: payment.reference,
          vendorName: order.vendor.name,
          vendorCode: order.vendor.code,
          reason: request.reason,
          reviewedBy: input.reviewerId,
          note: adminNote,
          split,
        }),
      },
    });

    await postJournal(tx, {
      transactionId: refundTransaction.id,
      universityId: request.universityId,
      description: `Order refund • ${order.reference} • ${order.vendor.name}`,
      lines: [
        {
          account: LEDGER_ACCOUNTS.VENDOR_PENDING,
          debit: split.vendorSettlement,
          description: 'Vendor pending credit reversed',
        },
        {
          account: LEDGER_ACCOUNTS.UNIVERSITY_REVENUE,
          debit: split.universityRevenue,
          description: 'University fee share reversed',
        },
        {
          account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE,
          debit: split.aggregatorFee,
          description: 'Aggregator fee reversed',
        },
        {
          account: LEDGER_ACCOUNTS.PLATFORM_REVENUE,
          debit: split.platformNet,
          description: 'Kupon net revenue reversed',
        },
        {
          account: LEDGER_ACCOUNTS.STUDENT_WALLET,
          credit: order.total,
          description: 'Student wallet refunded for verified order',
        },
      ],
    });

    const updated = await tx.refundRequest.update({
      where: { id: request.id },
      data: {
        payoutTransactionId: refundTransaction.id,
        payoutReference: refundTransaction.reference,
        payoutStatus: 'SETTLED',
      },
      include: adminMoneyRequestInclude,
    });

    await auditLog(
      {
        actorId: input.reviewerId,
        universityId: request.universityId,
        action: REQUEST_AUDIT_ACTIONS.ORDER_REFUND_APPROVED,
        entity: 'RefundRequest',
        entityId: request.id,
        metadata: {
          kind: 'REFUND',
          amount: order.total,
          reference: request.reference,
          orderId: order.id,
          orderReference: order.reference,
          vendorName: order.vendor.name,
          originalTransactionId: payment.id,
          originalTransactionReference: payment.reference,
          transactionId: refundTransaction.id,
          transactionReference: refundTransaction.reference,
          balanceAfter: balance,
          studentName: request.student.user.name,
          note: adminNote,
          splitFallback: split.fallback,
        },
      },
      tx,
    );

    return {
      request: updated,
      balance,
      transactionReference: refundTransaction.reference,
    };
  });

  await sendSms(
    request.student.user.phone,
    `KUPON: TZS ${order.total.toLocaleString('en-US')} imerejeshwa kwenye wallet yako kwa order ${order.reference}. Salio jipya: TZS ${result.balance.toLocaleString('en-US')}.`,
  ).catch((error) => console.error('[order-refund] refund SMS failed', error));

  return result;
}

/** PENDING → REJECTED. No money moves; the original order stays VERIFIED. */
export async function rejectOrderRefund(input: {
  requestId: string;
  reviewerId: string;
  adminNote?: string | null;
}): Promise<AdminMoneyRequestRecord> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.refundRequest.updateMany({
      where: { id: input.requestId, kind: 'REFUND', status: 'PENDING' },
      data: {
        status: 'REJECTED',
        adminNote: input.adminNote?.trim() || null,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        payoutStatus: null,
      },
    });
    if (claimed.count === 0) {
      throw conflict('Another admin just reviewed this refund. Refresh the queue.');
    }

    const row = await tx.refundRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: adminMoneyRequestInclude,
    });

    await auditLog(
      {
        actorId: input.reviewerId,
        universityId: row.universityId,
        action: REQUEST_AUDIT_ACTIONS.ORDER_REFUND_REJECTED,
        entity: 'RefundRequest',
        entityId: row.id,
        metadata: {
          kind: 'REFUND',
          amount: row.amount,
          reference: row.reference,
          orderId: row.orderId,
          orderReference: row.order?.reference ?? null,
          studentName: row.student.user.name,
          note: row.adminNote,
        },
      },
      tx,
    );

    return row;
  });
}

export type OrderPaymentSplit = {
  vendorSettlement: number;
  universityRevenue: number;
  aggregatorFee: number;
  platformNet: number;
  /** True when the stored payment split was unusable and fees were recomputed. */
  fallback: boolean;
};

/**
 * Resolves the fee waterfall that was booked on the original order payment so the
 * refund reverses exactly those amounts. Legacy rows can have zeroed split
 * columns, so we recompute from `calcPaymentFees` only when the stored split does
 * not add up to the payment amount.
 */
export function resolveOrderPaymentSplit(payment: {
  amount: number;
  platformFee: number;
  universityRevenue: number;
  aggregatorFee: number;
  vendorSettlement: number;
}): OrderPaymentSplit {
  const platformNet = Math.max(
    0,
    payment.platformFee - payment.universityRevenue - payment.aggregatorFee,
  );
  const storedTotal =
    payment.vendorSettlement + payment.universityRevenue + payment.aggregatorFee + platformNet;
  const sane =
    payment.vendorSettlement >= 0 &&
    payment.universityRevenue >= 0 &&
    payment.aggregatorFee >= 0 &&
    storedTotal === payment.amount;

  if (sane) {
    return {
      vendorSettlement: payment.vendorSettlement,
      universityRevenue: payment.universityRevenue,
      aggregatorFee: payment.aggregatorFee,
      platformNet,
      fallback: false,
    };
  }

  const fees = calcPaymentFees(payment.amount);
  return {
    vendorSettlement: fees.vendorSettlement,
    universityRevenue: fees.universityRevenue,
    aggregatorFee: fees.aggregatorFee,
    platformNet: fees.platformNet,
    fallback: true,
  };
}

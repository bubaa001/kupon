import type { Prisma } from '@prisma/client';
import { auditLog } from '@/lib/audit';
import { API_PAYOUT_FEE } from '@/lib/constants';
import { conflict } from '@/lib/errors';
import { formatTZS } from '@/lib/utils';

export const CASH_REFUNDED = 'CASH_REFUNDED';

/**
 * Finance chose to give the buyer their money back instead of credit. The
 * cafeteria pays it: the order amount plus the withdrawal charge leave its
 * balance, because sending money out through the payment provider costs a
 * payout fee. In the current test gateway this is recorded only; no money moves.
 */
export async function refundCash(input: {
  tx: Prisma.TransactionClient;
  request: {
    id: string;
    reference: string;
    orderId: string;
    studentId: string;
    vendorId: string;
    universityId: string;
    amount: number;
  };
  withdrawalFee: number;
  actorId: string;
  note: string;
}) {
  const order = await input.tx.order.findUnique({
    where: { id: input.request.orderId },
    select: { studentId: true, vendorId: true, status: true },
  });
  if (
    !order ||
    order.studentId !== input.request.studentId ||
    order.vendorId !== input.request.vendorId
  ) {
    throw conflict('The case no longer matches its order.');
  }
  if (order.status !== 'PENDING') {
    throw conflict('This order is no longer eligible for a refund.');
  }

  const totalCost = input.request.amount + input.withdrawalFee;
  const charged = await input.tx.vendor.updateMany({
    where: {
      id: input.request.vendorId,
      universityId: input.request.universityId,
      pendingBalance: { gte: totalCost },
    },
    data: { pendingBalance: { decrement: totalCost } },
  });
  if (!charged.count) {
    throw conflict(
      `The cafeteria balance is below ${formatTZS(totalCost)} (refund plus ${formatTZS(input.withdrawalFee)} payout charge). Give credit instead, or wait for more sales.`,
    );
  }

  const cancelled = await input.tx.order.updateMany({
    where: { id: input.request.orderId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  if (!cancelled.count) throw conflict('This order was just completed or cancelled.');

  const claimed = await input.tx.creditRequest.updateMany({
    where: { id: input.request.id, status: 'PENDING_FINANCE' },
    data: {
      status: CASH_REFUNDED,
      reviewedById: input.actorId,
      reviewedAt: new Date(),
      adminNote: input.note,
    },
  });
  if (!claimed.count) throw conflict('This case was already decided.');

  await auditLog(
    {
      actorId: input.actorId,
      universityId: input.request.universityId,
      action: 'CAFETERIA_CASH_REFUND_RECORDED',
      entity: 'CreditRequest',
      entityId: input.request.id,
      metadata: {
        reference: input.request.reference,
        amount: input.request.amount,
        withdrawalFee: input.withdrawalFee,
        providerFee: API_PAYOUT_FEE,
        kuponFee: Math.max(0, input.withdrawalFee - API_PAYOUT_FEE),
        vendorId: input.request.vendorId,
        note: input.note,
        mode: 'internal-test-simulation',
      },
    },
    input.tx,
  );
  return { totalCost };
}

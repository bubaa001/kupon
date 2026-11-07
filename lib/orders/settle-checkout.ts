import { prisma } from '@/lib/db';
import { conflict, notFound } from '@/lib/errors';
import { calcPaymentFees } from '@/lib/fees';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { safeJson } from '@/lib/utils';

/**
 * Confirms a direct mobile-money order only after the payment rail reports
 * success. The transaction claim makes repeated callbacks harmless.
 */
export async function settleOrderCheckout(input: {
  reference: string;
  providerTransactionId?: string | null;
}) {
  const payment = await prisma.transaction.findUnique({
    where: { reference: input.reference },
    include: { order: true },
  });
  if (!payment || payment.type !== 'PAYMENT' || !payment.order) {
    throw notFound('Order payment not found.');
  }
  const order = payment.order;
  const orderId = order.id;
  if (payment.amount !== order.total) {
    throw conflict('The order total does not match its payment.');
  }

  const metadata = safeJson<Record<string, unknown>>(payment.metadata, {});
  if (metadata.channel !== 'MOBILE_MONEY_ORDER') {
    throw conflict('This payment is not a mobile-money order checkout.');
  }
  if (payment.status === 'FAILED') throw conflict('This order payment already failed.');
  if (payment.status === 'SETTLED') return { settled: false, orderId };

  const fees = calcPaymentFees(payment.amount);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: payment.id, type: 'PAYMENT', status: 'PENDING' },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        fee: fees.platformFee,
        platformFee: fees.platformFee,
        aggregatorFee: fees.aggregatorFee,
        universityRevenue: fees.universityRevenue,
        vendorSettlement: fees.vendorSettlement,
        metadata: JSON.stringify({
          ...metadata,
          providerTransactionId: input.providerTransactionId ?? null,
          paymentConfirmedAt: new Date().toISOString(),
        }),
      },
    });
    if (claimed.count === 0) {
      const current = await tx.transaction.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (current?.status === 'SETTLED') {
        return { settled: false, orderId };
      }
      throw conflict('This order payment is no longer pending.');
    }

    const orderClaim = await tx.order.updateMany({
      where: { id: orderId, status: 'PAYMENT_PENDING' },
      data: { status: 'PENDING' },
    });
    if (orderClaim.count === 0) {
      throw conflict('The order is no longer waiting for payment.');
    }

    await tx.vendor.update({
      where: { id: order.vendorId },
      data: { pendingBalance: { increment: fees.vendorSettlement } },
    });

    await postJournal(tx, {
      transactionId: payment.id,
      universityId: payment.universityId,
      description: `Mobile-money order • ${order.reference}`,
      lines: [
        {
          account: LEDGER_ACCOUNTS.CASH_TRUST,
          debit: payment.amount,
          description: 'Mobile-money payment received',
        },
        { account: LEDGER_ACCOUNTS.VENDOR_PENDING, credit: fees.vendorSettlement },
        { account: LEDGER_ACCOUNTS.UNIVERSITY_REVENUE, credit: fees.universityRevenue },
        { account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE, credit: fees.aggregatorFee },
        { account: LEDGER_ACCOUNTS.PLATFORM_REVENUE, credit: fees.platformNet },
      ],
    });

    return { settled: true, orderId };
  });
}

export async function failOrderCheckout(reference: string, reason: string) {
  const payment = await prisma.transaction.findUnique({
    where: { reference },
    select: { id: true, type: true, order: { select: { id: true } } },
  });
  if (!payment || payment.type !== 'PAYMENT' || !payment.order) {
    throw notFound('Order payment not found.');
  }
  const orderId = payment.order.id;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: reason },
    });
    if (claimed.count === 0) return;

    await tx.order.updateMany({
      where: { id: orderId, status: 'PAYMENT_PENDING' },
      data: { status: 'PAYMENT_FAILED' },
    });
  });
}

import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { conflict, notFound } from '@/lib/errors';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { randomReference, safeJson } from '@/lib/utils';
import { TEST_PAYMENT_TTL_MS } from './payment-ttl';
import { calcOrderCheckoutFees } from '@/lib/fees';

/**
 * Confirms a test order only after the Kupon test gateway records receipt and
 * before its one-minute request window closes. The transaction claim makes
 * retries safe.
 */
export async function settleOrderCheckout(input: {
  reference: string;
}) {
  const payment = await prisma.transaction.findUnique({
    where: { reference: input.reference },
    include: {
      order: true,
      paymentEvents: { orderBy: { sequence: 'desc' }, take: 1 },
    },
  });
  if (!payment || payment.type !== 'PAYMENT' || !payment.order) {
    throw notFound('Order payment not found.');
  }
  const order = payment.order;
  const orderId = order.id;
  const cashDue = order.total - order.creditApplied;
  const fees = calcOrderCheckoutFees(cashDue);
  if (payment.amount !== fees.amountCharged) {
    throw conflict('The amount due, including the API fee, does not match this payment.');
  }

  const metadata = safeJson<Record<string, unknown>>(payment.metadata, {});
  if (metadata.channel !== 'MOBILE_MONEY_ORDER') {
    throw conflict('This payment is not a mobile-money order checkout.');
  }
  if (!payment.isTest || payment.paymentEvents[0]?.stage !== 'RECEIVED') {
    throw conflict('A test payment must be received before it can be confirmed.');
  }
  if (payment.status === 'FAILED') throw conflict('This order payment already failed.');
  if (payment.status === 'SETTLED') return { settled: false, orderId };

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: {
        id: payment.id,
        type: 'PAYMENT',
        status: 'PENDING',
        isTest: true,
        createdAt: { gt: new Date(Date.now() - TEST_PAYMENT_TTL_MS) },
      },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        fee: fees.apiFee + fees.kuponFee,
        platformFee: fees.kuponFee,
        aggregatorFee: fees.apiFee,
        universityRevenue: 0,
        vendorSettlement: fees.vendorSettlement,
        metadata: JSON.stringify({
          ...metadata,
          gatewayFee: fees.apiFee,
          kuponFee: fees.kuponFee,
          vendorSettlement: fees.vendorSettlement,
          stage: 'CONFIRMED',
          confirmedAt: new Date().toISOString(),
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
      data: { status: order.requiresAcceptance ? 'AWAITING_ACCEPTANCE' : 'PENDING' },
    });
    if (orderClaim.count === 0) {
      throw conflict('The order is no longer waiting for payment.');
    }

    await postJournal(tx, {
      transactionId: payment.id,
      universityId: payment.universityId,
      description: `TEST PAYMENT • ${order.reference} (no money collected)`,
      lines: [
        {
          account: LEDGER_ACCOUNTS.TEST_PAYMENT_CLEARING,
          debit: payment.amount,
          description: 'Simulated test confirmation; not cash',
        },
        {
          account: LEDGER_ACCOUNTS.VENDOR_PENDING,
          credit: fees.vendorSettlement,
          description: 'Simulated vendor settlement',
        },
        {
          account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE,
          credit: fees.apiFee,
          description: 'Simulated API collection fee',
        },
        {
          account: LEDGER_ACCOUNTS.PLATFORM_REVENUE,
          credit: fees.kuponFee,
          description: 'Simulated Kupon transaction share',
        },
      ],
    });
    if (!payment.vendorId) throw notFound('Vendor not found for this payment.');
    await tx.vendor.update({
      where: { id: payment.vendorId },
      data: { pendingBalance: { increment: fees.vendorSettlement } },
    });

    await tx.paymentEvent.create({
      data: {
        transactionId: payment.id,
        sequence: (payment.paymentEvents[0]?.sequence ?? 0) + 1,
        stage: 'CONFIRMED',
        source: 'KUPON_TEST_GATEWAY',
      },
    });
    await auditLog(
      {
        universityId: payment.universityId,
        action: 'TEST_PAYMENT_CONFIRMED',
        entity: 'Transaction',
        entityId: payment.id,
        metadata: {
          reference: payment.reference,
          amount: payment.amount,
          source: 'KUPON_TEST_GATEWAY',
        },
      },
      tx,
    );

    return { settled: true, orderId };
  });
}

export async function failOrderCheckout(input: {
  reference: string;
  reason: string;
  stage: 'FAILED' | 'EXPIRED';
}) {
  const payment = await prisma.transaction.findUnique({
    where: { reference: input.reference },
    include: {
      order: {
        select: {
          id: true,
          studentId: true,
          vendorId: true,
          creditApplied: true,
        },
      },
      paymentEvents: { orderBy: { sequence: 'desc' }, take: 1 },
    },
  });
  if (!payment || payment.type !== 'PAYMENT' || !payment.order) {
    throw notFound('Order payment not found.');
  }
  if (!payment.isTest) throw conflict('Only internal test payments can be failed here.');
  const order = payment.order;
  const orderId = order.id;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: payment.id, status: 'PENDING', isTest: true },
      data: {
        status: 'FAILED',
        failureReason: input.reason,
        metadata: JSON.stringify({
          ...safeJson<Record<string, unknown>>(payment.metadata, {}),
          stage: input.stage,
        }),
      },
    });
    if (claimed.count === 0) return;

    const orderClaim = await tx.order.updateMany({
      where: { id: orderId, status: 'PAYMENT_PENDING' },
      data: { status: 'PAYMENT_FAILED' },
    });
    if (!orderClaim.count) throw conflict('The order is no longer waiting for payment.');

    if (order.creditApplied > 0) {
      const account = await tx.cafeteriaCredit.update({
        where: {
          studentId_vendorId_isTest: {
            studentId: order.studentId,
            vendorId: order.vendorId,
            isTest: true,
          },
        },
        data: { balance: { increment: order.creditApplied } },
        select: { id: true, balance: true },
      });
      await tx.creditMovement.create({
        data: {
          reference: randomReference('CRD'),
          creditId: account.id,
          orderId: order.id,
          kind: 'RESTORE',
          amount: order.creditApplied,
          balanceAfter: account.balance,
          createdById: null,
        },
      });
    }

    await tx.paymentEvent.create({
      data: {
        transactionId: payment.id,
        sequence: (payment.paymentEvents[0]?.sequence ?? 0) + 1,
        stage: input.stage,
        source: 'KUPON_TEST_GATEWAY',
        note: input.reason,
      },
    });
    await auditLog(
      {
        universityId: payment.universityId,
        action: `TEST_PAYMENT_${input.stage}`,
        entity: 'Transaction',
        entityId: payment.id,
        metadata: {
          reference: payment.reference,
          reason: input.reason,
          source: 'KUPON_TEST_GATEWAY',
        },
      },
      tx,
    );
  });
}

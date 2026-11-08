import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { conflict } from '@/lib/errors';
import { failOrderCheckout, settleOrderCheckout } from '@/lib/orders/settle-checkout';
import { TEST_PAYMENT_RECEIVE_DELAY_MS, TEST_PAYMENT_TTL_MS } from '@/lib/orders/payment-ttl';
import { safeJson } from '@/lib/utils';

const CONFIRMATION_DELAY_MS = 1_500;

async function recordReceipt(payment: {
  id: string;
  reference: string;
  universityId: string;
  metadata: string | null;
  sequence: number;
}) {
  await prisma.$transaction(async (tx) => {
    const metadata = safeJson<Record<string, unknown>>(payment.metadata, {});
    const claimed = await tx.transaction.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        isTest: true,
        metadata: payment.metadata,
      },
      data: { metadata: JSON.stringify({ ...metadata, stage: 'RECEIVED' }) },
    });
    if (!claimed.count) return;

    await tx.paymentEvent.create({
      data: {
        transactionId: payment.id,
        sequence: payment.sequence + 1,
        stage: 'RECEIVED',
        source: 'KUPO_TEST_GATEWAY',
      },
    });
    await auditLog(
      {
        universityId: payment.universityId,
        action: 'TEST_PAYMENT_RECEIVED',
        entity: 'Transaction',
        entityId: payment.id,
        metadata: { reference: payment.reference, source: 'KUPO_TEST_GATEWAY' },
      },
      tx,
    );
  });
}

/**
 * Advances the internal test gateway from server-side reads. It mimics the
 * asynchronous receipt and confirmation callbacks without collecting money.
 */
export async function processKuponTestGatewayPayments(input: {
  studentId?: string;
}) {
  const payments = await prisma.transaction.findMany({
    where: {
      type: 'PAYMENT',
      status: 'PENDING',
      isTest: true,
      order: {
        is: {
          status: 'PAYMENT_PENDING',
          ...(input.studentId ? { studentId: input.studentId } : {}),
        },
      },
    },
    select: {
      id: true,
      reference: true,
      universityId: true,
      metadata: true,
      createdAt: true,
      paymentEvents: {
        orderBy: { sequence: 'desc' },
        take: 1,
        select: { stage: true, sequence: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const now = Date.now();
  for (const payment of payments) {
    const latestEvent = payment.paymentEvents[0];
    if (!latestEvent) {
      throw conflict(`Test payment ${payment.reference} has no lifecycle event.`);
    }

    if (now - payment.createdAt.getTime() >= TEST_PAYMENT_TTL_MS) {
      await failOrderCheckout({
        reference: payment.reference,
        reason: 'The test payment request expired after one minute.',
        stage: 'EXPIRED',
      });
      continue;
    }

    if (
      latestEvent.stage === 'INITIATED' &&
      now - payment.createdAt.getTime() >= TEST_PAYMENT_RECEIVE_DELAY_MS
    ) {
      await recordReceipt({
        id: payment.id,
        reference: payment.reference,
        universityId: payment.universityId,
        metadata: payment.metadata,
        sequence: latestEvent.sequence,
      });
      continue;
    }

    if (
      latestEvent.stage === 'RECEIVED' &&
      now - latestEvent.createdAt.getTime() >= CONFIRMATION_DELAY_MS
    ) {
      await settleOrderCheckout({
        reference: payment.reference,
      });
    }
  }
}

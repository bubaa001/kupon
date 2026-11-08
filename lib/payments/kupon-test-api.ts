import { conflict, notFound } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { failOrderCheckout, settleOrderCheckout } from '@/lib/orders/settle-checkout';
import { safeJson } from '@/lib/utils';
import { TEST_PAYMENT_TTL_MS } from '@/lib/orders/payment-ttl';

export type TestPaymentStage = 'RECEIVED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';

export async function advanceKuponTestPayment(input: {
  reference: string;
  stage: TestPaymentStage;
  actorId: string;
  note?: string;
}) {
  const payment = await prisma.transaction.findUnique({
    where: { reference: input.reference },
    include: {
      order: { select: { id: true } },
      paymentEvents: { orderBy: { sequence: 'desc' }, take: 1 },
    },
  });
  if (!payment || payment.type !== 'PAYMENT' || !payment.order) {
    throw notFound('Test order payment not found.');
  }
  if (!payment.isTest) throw conflict('This transaction is not a Kupon test payment.');

  const currentStage = payment.paymentEvents[0]?.stage;
  if (payment.status === 'PENDING' && Date.now() - payment.createdAt.getTime() >= TEST_PAYMENT_TTL_MS) {
    await failOrderCheckout({
      reference: input.reference,
      reason: 'The test payment request expired after one minute.',
      stage: 'EXPIRED',
      actorId: input.actorId,
    });
    return { advanced: true, stage: 'EXPIRED' as const };
  }
  if (currentStage === input.stage) {
    return { advanced: false, stage: currentStage };
  }
  if (payment.status !== 'PENDING') {
    throw conflict('This test payment is already final and cannot be changed.');
  }

  if (input.stage === 'RECEIVED') {
    if (currentStage !== 'INITIATED') {
      throw conflict('Only an initiated test payment can be marked received.');
    }

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
      if (!claimed.count) throw conflict('This test payment changed during review.');

      await tx.paymentEvent.create({
        data: {
          transactionId: payment.id,
          sequence: (payment.paymentEvents[0]?.sequence ?? 0) + 1,
          stage: 'RECEIVED',
          source: 'KUPO_TEST_API',
          actorId: input.actorId,
          note: input.note,
        },
      });
      await auditLog(
        {
          actorId: input.actorId,
          universityId: payment.universityId,
          action: 'TEST_PAYMENT_RECEIVED',
          entity: 'Transaction',
          entityId: payment.id,
          metadata: { reference: payment.reference, note: input.note ?? null },
        },
        tx,
      );
    });

    return { advanced: true, stage: 'RECEIVED' as const };
  }

  if (input.stage === 'CONFIRMED') {
    if (currentStage !== 'RECEIVED') {
      throw conflict('Record receipt before confirming this test payment.');
    }
    const result = await settleOrderCheckout({
      reference: input.reference,
      actorId: input.actorId,
    });
    return { advanced: result.settled, stage: 'CONFIRMED' as const };
  }

  if (currentStage !== 'INITIATED' && currentStage !== 'RECEIVED') {
    throw conflict('This test payment cannot be failed or expired from its current stage.');
  }

  await failOrderCheckout({
    reference: input.reference,
    reason: input.note?.trim() || `Internal test payment ${input.stage.toLowerCase()}.`,
    stage: input.stage,
    actorId: input.actorId,
  });
  return { advanced: true, stage: input.stage };
}

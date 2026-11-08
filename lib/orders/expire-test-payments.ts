import { prisma } from '@/lib/db';
import { failOrderCheckout } from '@/lib/orders/settle-checkout';
import { TEST_PAYMENT_TTL_MS } from './payment-ttl';

export async function expireStaleTestPayments(input: {
  actorId: string;
  studentId?: string;
}): Promise<void> {
  const payments = await prisma.transaction.findMany({
    where: {
      type: 'PAYMENT',
      status: 'PENDING',
      isTest: true,
      createdAt: { lte: new Date(Date.now() - TEST_PAYMENT_TTL_MS) },
      order: {
        is: {
          status: 'PAYMENT_PENDING',
          ...(input.studentId ? { studentId: input.studentId } : {}),
        },
      },
    },
    select: { reference: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  for (const payment of payments) {
    await failOrderCheckout({
      reference: payment.reference,
      reason: 'The test payment request expired after one minute.',
      stage: 'EXPIRED',
      actorId: input.actorId,
    });
  }
}

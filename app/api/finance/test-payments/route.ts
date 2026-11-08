import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { expireStaleTestPayments } from '@/lib/orders/expire-test-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser(['FINANCE']);
    await expireStaleTestPayments({ actorId: user.id });
    const transactions = await prisma.transaction.findMany({
      where: { isTest: true, type: 'PAYMENT' },
      include: {
        order: { select: { reference: true, status: true } },
        student: {
          select: { studentId: true, user: { select: { name: true } } },
        },
        vendor: { select: { name: true, code: true } },
        university: { select: { name: true, code: true } },
        paymentEvents: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ok({
      transactions: transactions.map((transaction) => ({
        reference: transaction.reference,
        amount: transaction.amount,
        status: transaction.status,
        stage: transaction.paymentEvents.at(-1)?.stage ?? 'INITIATED',
        createdAt: transaction.createdAt.toISOString(),
        order: transaction.order,
        student: transaction.student,
        vendor: transaction.vendor,
        university: transaction.university,
        events: transaction.paymentEvents.map((event) => ({
          stage: event.stage,
          source: event.source,
          note: event.note,
          createdAt: event.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { randomReference } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});

export async function GET() {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    const [credits, requests, tickets] = await Promise.all([
      prisma.cafeteriaCredit.findMany({
        where: { studentId: student.id, isTest: true, balance: { gt: 0 } },
        include: { vendor: { select: { id: true, name: true, code: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.creditRequest.findMany({
        where: { studentId: student.id },
        include: {
          vendor: { select: { name: true, code: true } },
          order: { select: { reference: true, total: true, expiresAt: true } },
          supportTicket: { select: { reference: true, status: true, feeAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.supportTicket.findMany({
        where: { studentId: student.id },
        select: {
          reference: true,
          status: true,
          feeAmount: true,
          reason: true,
          createdAt: true,
          adminNote: true,
          order: { select: { reference: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return ok({
      credits: credits.map((credit) => ({
        vendorId: credit.vendorId,
        vendor: credit.vendor,
        balance: credit.balance,
      })),
      requests,
      tickets,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    const limit = rateLimit(`student:credit-request:${student.id}`, 4, 10 * 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many credit requests. Wait a few minutes and try again.');
    }

    const body = await parseJson(request, requestSchema);
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, studentId: student.id },
      select: {
        id: true,
        reference: true,
        studentId: true,
        vendorId: true,
        universityId: true,
        total: true,
        creditApplied: true,
        testOnly: true,
        status: true,
        expiresAt: true,
        transaction: { select: { id: true, status: true, amount: true } },
      },
    });
    if (!order) throw notFound('Order not found.');
    if (
      order.status !== 'PENDING' ||
      (order.status === 'PENDING' && order.expiresAt <= new Date())
    ) {
      throw conflict('Only an active, unredeemed coupon can be submitted for cafeteria credit.');
    }
    const paidByTestPayment =
      order.transaction?.status === 'SETTLED';
    const paidByCafeteriaCredit =
      !order.transaction && order.testOnly && order.creditApplied === order.total;
    if (!paidByTestPayment && !paidByCafeteriaCredit) {
      throw conflict('The original order payment is not confirmed.');
    }

    const existing = await prisma.creditRequest.findUnique({
      where: { orderId: order.id },
      select: { reference: true, status: true },
    });
    if (existing) throw conflict(`A credit case already exists (${existing.reference}).`);

    const creditRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.creditRequest.create({
        data: {
          reference: randomReference('CRQ'),
          orderId: order.id,
          studentId: student.id,
          vendorId: order.vendorId,
          universityId: order.universityId,
          kind: 'STUDENT_UNFULFILLED',
          status: 'PENDING_VENDOR',
          amount: order.total,
          reason: body.reason,
        },
        select: { id: true, reference: true, status: true, amount: true, createdAt: true },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId: order.universityId,
          action: 'CAFETERIA_CREDIT_REQUESTED',
          entity: 'CreditRequest',
          entityId: created.id,
          metadata: { reference: created.reference, orderReference: order.reference },
        },
        tx,
      );
      return created;
    });

    return ok({ request: creditRequest }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

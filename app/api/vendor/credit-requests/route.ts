import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireVendor } from '@/lib/auth';
import { conflict, forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { randomReference } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const closingRequestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});

export async function GET() {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = requireVendor(user);
    const requests = await prisma.creditRequest.findMany({
      where: { vendorId: vendor.id },
      include: {
        order: { select: { reference: true, total: true, expiresAt: true } },
        student: { select: { studentId: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok({ requests });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = requireVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');
    const limit = rateLimit(`vendor:closing-credit:${vendor.id}`, 10, 10 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many requests. Try again later.');
    const body = await parseJson(request, closingRequestSchema);

    const order = await prisma.order.findFirst({
      where: { id: body.orderId, vendorId: vendor.id, universityId: user.universityId },
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
        transaction: { select: { status: true, amount: true } },
      },
    });
    if (!order) throw notFound('Order not found for this cafeteria.');
    if (
      order.status !== 'PENDING' ||
      (order.status === 'PENDING' && order.expiresAt <= new Date())
    ) {
      throw conflict('Only an active, unredeemed coupon can be submitted for closing-time credit.');
    }
    const paidByTestPayment = order.transaction?.status === 'SETTLED';
    const paidByCafeteriaCredit =
      !order.transaction && order.testOnly && order.creditApplied === order.total;
    if (!paidByTestPayment && !paidByCafeteriaCredit) {
      throw conflict('The original order payment is not confirmed.');
    }
    if (await prisma.creditRequest.findUnique({ where: { orderId: order.id } })) {
      throw conflict('A credit case already exists for this order.');
    }

    const created = await prisma.$transaction(async (tx) => {
      const requestRow = await tx.creditRequest.create({
        data: {
          reference: randomReference('CRQ'),
          orderId: order.id,
          studentId: order.studentId,
          vendorId: vendor.id,
          universityId: order.universityId,
          kind: 'VENDOR_CLOSING',
          status: 'PENDING_FINANCE',
          amount: order.total,
          reason: body.reason,
        },
        select: { id: true, reference: true, status: true, amount: true, createdAt: true },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId: order.universityId,
          action: 'CLOSING_TIME_CREDIT_REQUESTED',
          entity: 'CreditRequest',
          entityId: requestRow.id,
          metadata: { reference: requestRow.reference, orderReference: order.reference },
        },
        tx,
      );
      return requestRow;
    });

    return ok({ request: created }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

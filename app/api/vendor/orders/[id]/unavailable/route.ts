import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { conflict, forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { randomReference } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';
import { assertOrderRequestAccess } from '@/lib/orders/accept-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');
    const limit = rateLimit(`vendor:unavailable-order:${vendor.id}`, 20, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many requests. Try again shortly.');
    const body = await parseJson(request, requestSchema);
    const orderKey = await assertOrderRequestAccess(params.id, vendor.id, user.universityId);
    const order = await prisma.order.findUnique({
      where: { id: orderKey.id },
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
        transaction: { select: { status: true } },
      },
    });
    if (!order) throw notFound('Order request not found.');
    if (
      !['PENDING', 'AWAITING_ACCEPTANCE'].includes(order.status) ||
      (order.status === 'PENDING' && order.expiresAt <= new Date())
    ) {
      throw conflict('Only an active order can be reported as unavailable.');
    }
    const paid =
      order.transaction?.status === 'SETTLED' ||
      (!order.transaction && order.testOnly && order.creditApplied === order.total);
    if (!paid) throw conflict('The original payment has not been confirmed.');
    if (await prisma.creditRequest.findUnique({ where: { orderId: order.id } })) {
      throw conflict('A credit case already exists for this order.');
    }

    const creditRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.creditRequest.create({
        data: {
          reference: randomReference('CRQ'),
          orderId: order.id,
          studentId: order.studentId,
          vendorId: order.vendorId,
          universityId: order.universityId,
          kind: 'VENDOR_CLOSING',
          status: 'PENDING_ADMIN',
          amount: order.total,
          reason: body.reason,
        },
        select: { id: true, reference: true, status: true, amount: true, createdAt: true },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId: order.universityId,
          action: 'CAFETERIA_UNAVAILABLE_CREDIT_REQUESTED',
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

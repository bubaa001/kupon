import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireVendor } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  note: z.string().trim().max(250).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = requireVendor(user);
    const limit = await rateLimit(`vendor:credit-review:${vendor.id}`, 30, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many review actions. Try again shortly.');
    const body = await parseJson(request, decisionSchema);

    const creditRequest = await prisma.creditRequest.findFirst({
      where: { id: params.id, vendorId: vendor.id, kind: 'STUDENT_UNFULFILLED' },
    });
    if (!creditRequest) throw notFound('Student credit request not found.');
    if (creditRequest.status !== 'PENDING_VENDOR') {
      throw conflict('This request has already been reviewed.');
    }

    if (body.decision === 'ACCEPT') {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.creditRequest.updateMany({
          where: { id: creditRequest.id, status: 'PENDING_VENDOR' },
          data: {
            status: 'PENDING_FINANCE',
            reviewedById: user.id,
            vendorReviewedAt: new Date(),
            vendorNote: body.note ?? null,
          },
        });
        if (!claimed.count) throw conflict('This request was already reviewed.');
        await auditLog(
          {
            actorId: user.id,
            universityId: creditRequest.universityId,
            action: 'CAFETERIA_CREDIT_FORWARDED_TO_FINANCE',
            entity: 'CreditRequest',
            entityId: creditRequest.id,
            metadata: { reference: creditRequest.reference, note: body.note ?? null },
          },
          tx,
        );
      });
      return ok({ status: 'PENDING_FINANCE' });
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.creditRequest.updateMany({
        where: { id: creditRequest.id, status: 'PENDING_VENDOR' },
        data: {
          status: 'REJECTED',
          reviewedById: user.id,
          vendorReviewedAt: new Date(),
          vendorNote: body.note ?? null,
        },
      });
      if (!claimed.count) throw conflict('This request was already reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId: creditRequest.universityId,
          action: 'CAFETERIA_CREDIT_REJECTED',
          entity: 'CreditRequest',
          entityId: creditRequest.id,
          metadata: { reference: creditRequest.reference, note: body.note ?? null },
        },
        tx,
      );
    });
    return ok({ status: 'REJECTED' });
  } catch (error) {
    return fail(error);
  }
}

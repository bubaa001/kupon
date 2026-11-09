import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { issueCafeteriaCredit } from '@/lib/credits/issue-credit';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(250).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const limit = await rateLimit(`platform:credit-review:${user.id}`, 30, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many review actions. Try again shortly.');
    const body = await parseJson(request, decisionSchema);
    const creditRequest = await prisma.creditRequest.findFirst({
      where: { id: params.id, status: 'PENDING_ADMIN' },
    });
    if (!creditRequest) throw notFound('Pending cafeteria credit request not found.');

    if (body.decision === 'APPROVE') {
      const account = await prisma.$transaction((tx) =>
        issueCafeteriaCredit({
          tx,
          request: creditRequest,
          expectedStatus: 'PENDING_ADMIN',
          actorId: user.id,
          note: body.note,
        }),
      );
      return ok({ status: 'APPROVED', creditBalance: account.balance });
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.creditRequest.updateMany({
        where: { id: creditRequest.id, status: 'PENDING_ADMIN' },
        data: {
          status: 'REJECTED',
          reviewedById: user.id,
          reviewedAt: new Date(),
          adminNote: body.note ?? null,
        },
      });
      if (!claimed.count) throw conflict('This request was already reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId: creditRequest.universityId,
          action: 'CAFETERIA_CREDIT_REJECTED_BY_PLATFORM',
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

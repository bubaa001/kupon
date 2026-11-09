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
  note: z.string().trim().min(5).max(500),
}).strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['FINANCE']);
    const limit = await rateLimit(`finance:credit-review:${user.id}`, 30, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many credit review actions. Try again shortly.');
    const body = await parseJson(request, decisionSchema);
    const creditRequest = await prisma.creditRequest.findFirst({
      where: {
        id: params.id,
        status: 'PENDING_FINANCE',
        ...(user.managedVendor ? { vendorId: user.managedVendor.id } : {}),
      },
    });
    if (!creditRequest) throw notFound('Pending finance credit case not found.');

    if (body.decision === 'APPROVE') {
      const account = await prisma.$transaction((tx) =>
        issueCafeteriaCredit({
          tx,
          request: creditRequest,
          expectedStatus: 'PENDING_FINANCE',
          actorId: user.id,
          note: body.note,
        }),
      );
      return ok({ status: 'APPROVED', creditBalance: account.balance });
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.creditRequest.updateMany({
        where: { id: creditRequest.id, status: 'PENDING_FINANCE' },
        data: {
          status: 'REJECTED',
          reviewedById: user.id,
          reviewedAt: new Date(),
          adminNote: body.note,
        },
      });
      if (!claimed.count) throw conflict('This credit case was already reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId: creditRequest.universityId,
          action: 'CAFETERIA_CREDIT_REJECTED_BY_FINANCE',
          entity: 'CreditRequest',
          entityId: creditRequest.id,
          metadata: { reference: creditRequest.reference, note: body.note },
        },
        tx,
      );
    });
    return ok({ status: 'REJECTED' });
  } catch (error) {
    return fail(error);
  }
}

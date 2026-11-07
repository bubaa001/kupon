import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(5).max(500),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['FINANCE']);
    const limit = rateLimit(`finance:support-review:${user.id}`, 30, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many review actions. Try again shortly.');
    const body = await parseJson(request, decisionSchema);
    const existing = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      select: { id: true, reference: true, status: true, universityId: true },
    });
    if (!existing) throw notFound('Support ticket not found.');
    if (existing.status !== 'OPEN') throw conflict('This ticket has already been reviewed.');

    const status = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.supportTicket.updateMany({
        where: { id: existing.id, status: 'OPEN' },
        data: {
          status,
          adminNote: body.note,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      if (!claimed.count) throw conflict('This ticket was already reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId: existing.universityId,
          action: `SUPPORT_ESCALATION_${status}`,
          entity: 'SupportTicket',
          entityId: existing.id,
          metadata: {
            reference: existing.reference,
            note: body.note,
            payoutProvider: null,
            testOnly: true,
          },
        },
        tx,
      );
    });

    return ok({
      status,
      message:
        'Decision recorded. The internal test system cannot send a cash refund; any real payout requires a connected payment rail.',
    });
  } catch (error) {
    return fail(error);
  }
}

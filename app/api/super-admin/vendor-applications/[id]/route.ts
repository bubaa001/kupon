import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  physicalSiteVerified: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const body = await parseJson(request, reviewSchema);
    const application = await prisma.vendor.findFirst({
      where: { id: params.id, status: 'PENDING', applicationRejectedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        universityId: true,
        businessRegistrationNumber: true,
        physicalAddress: true,
        registrationDocumentUrl: true,
      },
    });
    if (!application) throw notFound('Pending vendor application not found.');

    if (body.decision === 'APPROVE') {
      if (!body.physicalSiteVerified) {
        throw badRequest('Confirm that the cafeteria physically exists before approval.');
      }
      if (
        !application.businessRegistrationNumber ||
        !application.physicalAddress ||
        !application.registrationDocumentUrl.startsWith('https://')
      ) {
        throw badRequest('The application is missing required business documents or location details.');
      }
    } else if (!body.note || body.note.length < 5) {
      throw badRequest('Add a short reason so the vendor knows what to correct.');
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.updateMany({
        where: { id: application.id, status: 'PENDING', applicationRejectedAt: null },
        data:
          body.decision === 'APPROVE'
            ? {
                status: 'ACTIVE',
                physicalSiteVerified: true,
                applicationReviewedAt: now,
                applicationReviewNote: body.note ?? null,
              }
            : {
                applicationRejectedAt: now,
                applicationReviewNote: body.note,
                applicationReviewedAt: now,
              },
      });
      if (!updated.count) throw conflict('This application was just reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId: application.universityId,
          action:
            body.decision === 'APPROVE'
              ? 'VENDOR_APPLICATION_APPROVED'
              : 'VENDOR_APPLICATION_REJECTED',
          entity: 'Vendor',
          entityId: application.id,
          metadata: {
            code: application.code,
            decision: body.decision,
            physicalSiteVerified: body.decision === 'APPROVE',
            note: body.note ?? null,
          },
        },
        tx,
      );
    });

    return ok({
      status: body.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
      message:
        body.decision === 'APPROVE'
          ? 'Vendor approved after document and physical-site review.'
          : 'Application returned to the vendor for correction.',
    });
  } catch (error) {
    return fail(error);
  }
}

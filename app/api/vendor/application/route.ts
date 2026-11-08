import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { conflict, forbidden } from '@/lib/errors';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const applicationSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(500),
  businessRegistrationNumber: z.string().trim().min(3).max(80),
  physicalAddress: z.string().trim().min(8).max(250),
  registrationDocumentUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.startsWith('https://'), 'Use a secure HTTPS document link.'),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = user.vendor;
    if (!vendor) throw forbidden('A vendor account is required for this action.');
    const body = await parseJson(request, applicationSchema);
    if (!user.universityId) throw forbidden('Your vendor account is not linked to a university.');
    const universityId = user.universityId;

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.vendor.findFirst({
        where: {
          id: vendor.id,
          userId: user.id,
          universityId,
          status: 'PENDING',
          applicationRejectedAt: { not: null },
        },
        select: { id: true, name: true, code: true },
      });
      if (!current) throw conflict('Only a rejected pending application can be resubmitted.');

      const result = await tx.vendor.update({
        where: { id: current.id },
        data: {
          name: body.businessName,
          description: body.description,
          businessRegistrationNumber: body.businessRegistrationNumber,
          physicalAddress: body.physicalAddress,
          registrationDocumentUrl: body.registrationDocumentUrl,
          applicationRejectedAt: null,
          applicationReviewNote: null,
          applicationReviewedAt: null,
          physicalSiteVerified: false,
        },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_APPLICATION_RESUBMITTED',
          entity: 'Vendor',
          entityId: result.id,
          metadata: { code: result.code },
        },
        tx,
      );
      return result;
    });

    return ok({ vendor: { id: updated.id, name: updated.name, code: updated.code } });
  } catch (error) {
    return fail(error);
  }
}

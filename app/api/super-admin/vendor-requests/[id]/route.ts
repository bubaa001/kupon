import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { normalizePhone } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REOPEN']),
  universityId: z.string().min(1).optional(),
  physicalSiteVerified: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});

const institutionPhoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => /^\+255\d{9}$/.test(value));

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const body = await parseJson(request, reviewSchema);
    const application = await prisma.vendorApplication.findFirst({
      where: {
        id: params.id,
        status: body.decision === 'REOPEN' ? 'REJECTED' : 'PENDING',
      },
      select: {
        id: true,
        email: true,
        businessName: true,
        universityName: true,
        nidaNumber: true,
        phone: true,
        institutionPhone: true,
        tinDocumentKey: true,
      },
    });
    if (!application) throw notFound('Pending cafeteria application not found.');

    let universityId: string | null = null;
    if (body.decision === 'APPROVE') {
      if (!body.physicalSiteVerified) {
        throw badRequest('Confirm that the cafeteria physically exists before approval.');
      }
      if (!body.universityId) {
        throw badRequest('Choose the Kupon campus this application belongs to.');
      }
      if (
        !/^\d{20}$/.test(application.nidaNumber) ||
        !phoneSchema.safeParse(application.phone).success ||
        !institutionPhoneSchema.safeParse(application.institutionPhone).success ||
        !application.tinDocumentKey
      ) {
        throw badRequest(
          'The application is missing a valid owner NIDA number, reliable phone numbers, or TIN/TRA document.',
        );
      }
      const document = await prisma.storedFile.findUnique({
        where: { key: application.tinDocumentKey },
        select: { key: true },
      });
      if (!document) throw badRequest('The uploaded TIN/TRA document is unavailable. Ask the applicant to resubmit.');
      const university = await prisma.university.findFirst({
        where: { id: body.universityId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!university) throw badRequest('Choose an active Kupon campus.');
      universityId = university.id;
    } else if (body.decision === 'REJECT' && (!body.note || body.note.length < 5)) {
      throw badRequest('Add a short reason so the applicant knows what to correct.');
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.vendorApplication.updateMany({
        where: {
          id: application.id,
          status: body.decision === 'REOPEN' ? 'REJECTED' : 'PENDING',
        },
        data: {
          status:
            body.decision === 'REOPEN'
              ? 'PENDING'
              : body.decision === 'APPROVE'
                ? 'APPROVED'
                : 'REJECTED',
          universityId: body.decision === 'REOPEN' ? null : universityId,
          reviewNote: body.decision === 'REOPEN' ? null : body.note ?? null,
          reviewedAt: body.decision === 'REOPEN' ? null : now,
        },
      });
      if (!updated.count) throw conflict('This application was just reviewed.');
      await auditLog(
        {
          actorId: user.id,
          universityId,
          action:
            body.decision === 'REOPEN'
              ? 'VENDOR_REQUEST_REOPENED'
              : body.decision === 'APPROVE'
              ? 'VENDOR_REQUEST_APPROVED'
              : 'VENDOR_REQUEST_REJECTED',
          entity: 'VendorApplication',
          entityId: application.id,
          metadata: {
            businessName: application.businessName,
            requestedUniversity: application.universityName,
            decision: body.decision,
            assignedUniversityId: universityId,
            note: body.note ?? null,
          },
        },
        tx,
      );
    });

    return ok({
      status:
        body.decision === 'REOPEN'
          ? 'PENDING'
          : body.decision === 'APPROVE'
            ? 'APPROVED'
            : 'REJECTED',
      message:
        body.decision === 'REOPEN'
          ? 'Application returned to the review queue.'
          : body.decision === 'APPROVE'
            ? 'Application approved. The owner can now continue with Google sign-in.'
            : 'Application rejected. Feedback is saved in Rejected applications; no email is sent.',
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id, status: 'PENDING', applicationRejectedAt: { not: null } },
      select: {
        id: true,
        userId: true,
        code: true,
        name: true,
        universityId: true,
        applicationReviewNote: true,
        _count: {
          select: {
            transactions: true,
            orders: true,
            settlements: true,
            cafeteriaCredits: true,
            creditRequests: true,
            supportTickets: true,
            teamMembers: true,
          },
        },
      },
    });
    if (!vendor) throw notFound('Rejected vendor account not found.');
    const hasOperationalData = Object.values(vendor._count).some((count) => count > 0);
    if (hasOperationalData) {
      throw conflict(
        'This vendor has staff or operational records and cannot be permanently deleted. Reopen it for review instead.',
      );
    }

    await prisma.$transaction(async (tx) => {
      const stillRejected = await tx.vendor.findFirst({
        where: {
          id: vendor.id,
          status: 'PENDING',
          applicationRejectedAt: { not: null },
        },
        select: { id: true },
      });
      if (!stillRejected) throw conflict('This vendor account was just changed.');

      await auditLog(
        {
          actorId: user.id,
          universityId: vendor.universityId,
          action: 'VENDOR_APPLICATION_DELETED',
          entity: 'Vendor',
          entityId: vendor.id,
        },
        tx,
      );
      await tx.auditLog.updateMany({
        where: { actorId: vendor.userId },
        data: { actorId: null },
      });
      await tx.auditLog.updateMany({
        where: { entity: 'Vendor', entityId: vendor.id },
        data: { metadata: null },
      });
      await tx.user.delete({ where: { id: vendor.userId } });
    });

    return ok({ message: 'Rejected vendor account permanently deleted.' });
  } catch (error) {
    return fail(error);
  }
}

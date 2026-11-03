import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { tenantWhere } from '@/lib/tenant';
import { requireAdmin } from '../../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // null / empty removes the link; a valid email pre-links the wallet so the
  // student can use Google OAuth when SMS OTP is unavailable.
  email: z.string().trim().email('Enter a valid email address').nullable(),
});

/**
 * POST /api/admin/students/[id]/google-link
 *
 * The admin is the trust anchor: they set the student's Google email. The
 * student still has to complete Google OAuth, at which point googleId is bound
 * and the email is proven. Setting a new email clears googleId so a stale
 * Google identity can never sign into the wallet.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const body = await parseJson(request, bodySchema);
    const email = body.email ? body.email.toLowerCase() : null;

    const student = await prisma.studentProfile.findFirst({
      where: { id: params.id, ...tenantWhere(admin) },
      include: { user: { select: { id: true, email: true, googleId: true, name: true } } },
    });
    if (!student) throw notFound('Student not found in your university.');

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing && existing.id !== student.user.id) {
        throw conflict('That email is already linked to another Kupon account.');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.user.id },
        data: { email, googleId: null },
      });

      await auditLog(
        {
          actorId: admin.id,
          universityId: student.universityId,
          action: email ? 'GOOGLE_EMAIL_LINKED' : 'GOOGLE_EMAIL_UNLINKED',
          entity: 'StudentProfile',
          entityId: student.id,
          metadata: {
            studentName: student.user.name,
            previousEmail: student.user.email,
            email,
            note: email
              ? 'Admin pre-linked Google email; student must complete Google OAuth.'
              : 'Google email removed; OTP remains available.',
          },
        },
        tx,
      );
    });

    return ok({
      email,
      googleLinked: false,
      message: email
        ? `${email} is now ready for Google sign-in. The student should choose Continue with Google.`
        : 'Google email removed. The student can still sign in with the phone OTP.',
    });
  } catch (error) {
    return fail(error);
  }
}

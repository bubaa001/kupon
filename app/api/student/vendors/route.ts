import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Active vendors in the student's own university. The student scanner uses this
 * as a discoverable fallback when the camera is unavailable, so vendor names and
 * codes always come from the database instead of a hardcoded demo list.
 */
export async function GET() {
  try {
    const user = await requireApiUser(['STUDENT']);
    requireStudent(user);

    const vendors = await prisma.vendor.findMany({
      where: { universityId: user.universityId ?? '', status: 'ACTIVE' },
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return ok({ vendors });
  } catch (error) {
    return fail(error);
  }
}

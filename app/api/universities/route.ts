import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public tenant directory for the login screen. No financial identifiers leak. */
export async function GET() {
  try {
    const universities = await prisma.university.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        brandColor: true,
      },
      orderBy: { name: 'asc' },
    });
    return ok({ universities });
  } catch (error) {
    return fail(error);
  }
}

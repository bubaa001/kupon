import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const requests = await prisma.creditRequest.findMany({
      where: { status: 'PENDING_ADMIN' },
      include: {
        order: { select: { reference: true, status: true, expiresAt: true } },
        student: { select: { studentId: true, user: { select: { name: true } } } },
        vendor: { select: { name: true, code: true } },
        university: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return ok({ requests });
  } catch (error) {
    return fail(error);
  }
}

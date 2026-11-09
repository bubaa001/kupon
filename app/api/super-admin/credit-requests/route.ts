import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const requests = await prisma.creditRequest.findMany({
      where: { status: { in: ['PENDING_ADMIN', 'PENDING_FINANCE', 'APPROVED', 'REJECTED'] } },
      include: {
        order: { select: { reference: true, status: true, expiresAt: true } },
        student: { select: { studentId: true, user: { select: { name: true } } } },
        vendor: { select: { name: true, code: true } },
        university: { select: { name: true, code: true } },
        reviewer: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok({ requests });
  } catch (error) {
    return fail(error);
  }
}

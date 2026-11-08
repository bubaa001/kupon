import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const applications = await prisma.vendor.findMany({
      where: { status: 'PENDING', applicationRejectedAt: null },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        university: { select: { id: true, name: true, code: true, city: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return ok({ applications });
  } catch (error) {
    return fail(error);
  }
}

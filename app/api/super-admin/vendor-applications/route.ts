import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const [applications, requests, universities] = await Promise.all([
      prisma.vendor.findMany({
        where: { status: 'PENDING', applicationRejectedAt: null },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          university: { select: { id: true, name: true, code: true, city: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.vendorApplication.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.university.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true, city: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return ok({ applications, requests, universities });
  } catch (error) {
    return fail(error);
  }
}

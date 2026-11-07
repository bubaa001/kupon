import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['FINANCE']);
    const [creditRequests, supportTickets] = await Promise.all([
      prisma.creditRequest.findMany({
        include: {
          order: { select: { reference: true, status: true, expiresAt: true } },
          student: { select: { studentId: true, user: { select: { name: true } } } },
          vendor: { select: { name: true, code: true } },
          university: { select: { name: true, code: true } },
          supportTicket: { select: { reference: true, status: true, feeAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.supportTicket.findMany({
        include: {
          order: { select: { reference: true, total: true } },
          student: { select: { studentId: true, user: { select: { name: true } } } },
          vendor: { select: { name: true, code: true } },
          university: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return ok({ creditRequests, supportTickets });
  } catch (error) {
    return fail(error);
  }
}

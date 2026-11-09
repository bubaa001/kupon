import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser(['FINANCE']);
    const vendorScope = user.managedVendor ? { vendorId: user.managedVendor.id } : {};
    const [creditRequests, supportTickets, emergencySettlement, withdrawalLimit] = await Promise.all([
      prisma.creditRequest.findMany({
        where: {
          ...vendorScope,
          status: { in: ['PENDING_FINANCE', 'APPROVED', 'REJECTED'] },
        },
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
        where: vendorScope,
        include: {
          order: { select: { reference: true, total: true } },
          student: { select: { studentId: true, user: { select: { name: true } } } },
          vendor: { select: { name: true, code: true } },
          university: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      user.managedVendor
        ? prisma.vendor.findUnique({
            where: { id: user.managedVendor.id },
            select: { pendingBalance: true },
          })
        : Promise.resolve(null),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { emergencyWithdrawalLimit: true },
      }),
    ]);

    return ok({
      creditRequests,
      supportTickets,
      emergencySettlement: user.managedVendor
        ? {
            pendingBalance: emergencySettlement?.pendingBalance ?? 0,
            authorizedLimit: withdrawalLimit?.emergencyWithdrawalLimit ?? 0,
          }
        : null,
    });
  } catch (error) {
    return fail(error);
  }
}

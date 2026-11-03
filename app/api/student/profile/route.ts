import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { snippeMock } from '@/lib/payments/snippe';
import type { StudentProfileData } from '@/app/student/_lib/types';
import { getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/student/profile
 *
 * Everything the profile/settings screen shows: registration details, the
 * university context, the wallet and a few lifetime stats.
 */
export async function GET() {
  try {
    const { student } = await getStudentContext();
    await snippeMock.settleStaleTopUps(student.id);

    const [profile, totalTopUps, mealsCount, totalSpent, transactionsCount, pendingRefunds] =
      await Promise.all([
        prisma.studentProfile.findUnique({
          where: { id: student.id },
          include: {
            user: { select: { name: true, phone: true, createdAt: true } },
            university: { select: { id: true, name: true, code: true, city: true } },
            wallet: { select: { balance: true, currency: true } },
          },
        }),
        prisma.transaction.count({
          where: { studentId: student.id, type: 'TOPUP', status: 'SETTLED' },
        }),
        prisma.transaction.count({
          where: {
            studentId: student.id,
            type: 'PAYMENT',
            status: 'SETTLED',
            order: { is: { status: { not: 'CANCELLED' } } },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            studentId: student.id,
            type: 'PAYMENT',
            status: 'SETTLED',
            order: { is: { status: { not: 'CANCELLED' } } },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.count({ where: { studentId: student.id } }),
        prisma.refundRequest.count({
          where: { studentId: student.id, status: 'PENDING' },
        }),
      ]);

    if (!profile) throw notFound('Student profile not found.');

    const data: StudentProfileData = {
      student: {
        id: profile.id,
        name: profile.user.name,
        studentId: profile.studentId,
        course: profile.course,
        year: profile.year,
        phone: profile.user.phone,
        joinedAt: profile.user.createdAt.toISOString(),
      },
      university: {
        id: profile.university.id,
        name: profile.university.name,
        code: profile.university.code,
        city: profile.university.city,
      },
      wallet: {
        balance: profile.wallet?.balance ?? profile.walletBalance,
        currency: profile.wallet?.currency ?? 'TZS',
      },
      stats: {
        totalTopUps,
        mealsCount,
        totalSpent: totalSpent._sum.amount ?? 0,
        transactionsCount,
        pendingRefunds,
      },
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

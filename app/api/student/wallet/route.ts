import { subDays, startOfDay } from 'date-fns';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { snippeMock } from '@/lib/payments/snippe';
import type { WalletData } from '@/app/student/_lib/types';
import { getStudentContext, serializeTransaction } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/student/wallet
 *
 * Powers the student home screen: profile snapshot, live balance, spending
 * stats and the most recent transactions. Stale mock top-ups are settled first
 * so the balance is correct even when the 2-second aggregator timer was lost.
 */
export async function GET() {
  try {
    const { student } = await getStudentContext();
    await snippeMock.settleStaleTopUps(student.id);

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfDay(subDays(now, 6));

    const [profile, todaySpent, weekSpent, mealsThisWeek, totalTopUps, recent] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: student.id },
        include: {
          user: { select: { name: true, phone: true } },
          university: { select: { name: true, code: true } },
          wallet: { select: { balance: true, currency: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          studentId: student.id,
          type: 'PAYMENT',
          status: 'SETTLED',
          createdAt: { gte: todayStart },
          // A cancelled order was reversed by a REFUND row; do not count the
          // original payment as spending.
          order: { is: { status: { not: 'CANCELLED' } } },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          studentId: student.id,
          type: 'PAYMENT',
          status: 'SETTLED',
          createdAt: { gte: weekStart },
          order: { is: { status: { not: 'CANCELLED' } } },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          studentId: student.id,
          type: 'PAYMENT',
          status: 'SETTLED',
          createdAt: { gte: weekStart },
          order: { is: { status: { not: 'CANCELLED' } } },
        },
      }),
      prisma.transaction.count({
        where: { studentId: student.id, type: 'TOPUP', status: 'SETTLED' },
      }),
      prisma.transaction.findMany({
        where: { studentId: student.id },
        include: { vendor: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    if (!profile) throw notFound('Student wallet not found.');

    const data: WalletData = {
      student: {
        name: profile.user.name,
        studentId: profile.studentId,
        course: profile.course,
        year: profile.year,
        phone: profile.user.phone,
        university: { name: profile.university.name, code: profile.university.code },
      },
      balance: profile.wallet?.balance ?? profile.walletBalance,
      stats: {
        todaySpent: todaySpent._sum.amount ?? 0,
        weekSpent: weekSpent._sum.amount ?? 0,
        mealsThisWeek,
        totalTopUps,
      },
      recentTransactions: recent.map(serializeTransaction),
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

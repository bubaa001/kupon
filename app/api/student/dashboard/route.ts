import { subDays, startOfDay } from 'date-fns';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import type { StudentDashboardData } from '@/app/student/_lib/types';
import { getStudentContext, serializeTransaction } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { student } = await getStudentContext();
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfDay(subDays(now, 6));

    const [profile, todaySpent, weekSpent, mealsThisWeek, couponsUsed, recent] =
      await Promise.all([
        prisma.studentProfile.findUnique({
          where: { id: student.id },
          include: {
            user: { select: { name: true, phone: true } },
            university: { select: { name: true, code: true } },
          },
        }),
        prisma.transaction.aggregate({
          where: {
            studentId: student.id,
            type: 'PAYMENT',
            status: 'SETTLED',
            createdAt: { gte: todayStart },
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
        prisma.order.count({
          where: { studentId: student.id, status: 'VERIFIED' },
        }),
        prisma.transaction.findMany({
          where: {
            studentId: student.id,
            type: { in: ['PAYMENT', 'REFUND'] },
          },
          include: { vendor: { select: { name: true, code: true } } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

    if (!profile) throw notFound('Student profile not found.');

    const data: StudentDashboardData = {
      student: {
        name: profile.user.name,
        studentId: profile.studentId,
        course: profile.course,
        year: profile.year,
        phone: profile.user.phone,
        university: { name: profile.university.name, code: profile.university.code },
      },
      stats: {
        todaySpent: todaySpent._sum.amount ?? 0,
        weekSpent: weekSpent._sum.amount ?? 0,
        mealsThisWeek,
        couponsUsed,
      },
      recentTransactions: recent.map(serializeTransaction),
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

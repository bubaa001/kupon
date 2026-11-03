import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { maskPhone } from '@/lib/utils';
import { tenantWhere } from '@/lib/tenant';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const studentsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  universityId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, studentsQuerySchema);
    const tenant = tenantWhere(user, query.universityId);

    const where: Prisma.StudentProfileWhereInput = { ...tenant };
    if (query.q) {
      where.OR = [
        { studentId: { contains: query.q } },
        { course: { contains: query.q } },
        { user: { is: { name: { contains: query.q } } } },
        { user: { is: { phone: { contains: query.q } } } },
      ];
    }

    const [students, total, balanceAgg] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true } },
          university: { select: { name: true, code: true } },
        },
        orderBy: { user: { name: 'asc' } },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.studentProfile.count({ where }),
      prisma.studentProfile.aggregate({
        where: tenant,
        _sum: { walletBalance: true },
        _avg: { walletBalance: true },
        _count: { _all: true },
      }),
    ]);

    return ok({
      students: students.map((student) => ({
        id: student.id,
        name: student.user.name,
        studentId: student.studentId,
        // Student MSISDNs are always masked for admins; support can unmask on request.
        phone: maskPhone(student.user.phone),
        course: student.course,
        year: student.year,
        balance: student.walletBalance,
        university: student.university,
        joinedAt: student.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        totalStudents: balanceAgg._count._all,
        totalBalance: balanceAgg._sum.walletBalance ?? 0,
        averageBalance: Math.round(balanceAgg._avg.walletBalance ?? 0),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

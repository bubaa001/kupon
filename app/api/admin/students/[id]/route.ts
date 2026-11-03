import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { maskPhone } from '@/lib/utils';
import { tenantWhere } from '@/lib/tenant';
import { requireAdmin } from '../../_lib/scope';
import { parseMetadata, serializeTx, txInclude } from '../../_lib/serializers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();

    const student = await prisma.studentProfile.findFirst({
      where: { id: params.id, ...tenantWhere(user) },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            googleId: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        university: { select: { id: true, name: true, code: true, paymentRouteCode: true } },
        wallet: { select: { balance: true, currency: true, updatedAt: true } },
      },
    });
    if (!student) throw notFound('Student not found in your university.');

    const [transactions, refunds, audit, totals, lastTransaction] = await Promise.all([
      prisma.transaction.findMany({
        where: { studentId: student.id },
        include: txInclude,
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.refundRequest.findMany({
        where: { studentId: student.id },
        include: { reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.auditLog.findMany({
        where: { entity: 'StudentProfile', entityId: student.id },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.transaction.groupBy({
        by: ['type', 'status'],
        where: { studentId: student.id },
        _sum: { amount: true },
      }),
      prisma.transaction.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const sumFor = (type: string, status?: string) =>
      totals
        .filter((row) => row.type === type && (!status || row.status === status))
        .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

    const txCount = await prisma.transaction.count({ where: { studentId: student.id } });

    return ok({
      student: {
        id: student.id,
        name: student.user.name,
        phone: maskPhone(student.user.phone),
        studentId: student.studentId,
        email: student.user.email,
        googleLinked: Boolean(student.user.googleId),
        course: student.course,
        year: student.year,
        balance: student.wallet?.balance ?? student.walletBalance,
        currency: student.wallet?.currency ?? 'TZS',
        joinedAt: student.createdAt.toISOString(),
        lastLoginAt: student.user.lastLoginAt ? student.user.lastLoginAt.toISOString() : null,
        university: student.university,
      },
      stats: {
        totalTopUps: sumFor('TOPUP', 'SETTLED'),
        totalSpent: sumFor('PAYMENT', 'SETTLED'),
        totalRefunded: sumFor('REFUND', 'SETTLED'),
        adjustments: sumFor('ADJUSTMENT_CREDIT') - sumFor('ADJUSTMENT_DEBIT'),
        transactionCount: txCount,
        lastActivityAt: lastTransaction ? lastTransaction.createdAt.toISOString() : null,
      },
      transactions: transactions.map(serializeTx),
      refunds: refunds.map((refund) => ({
        id: refund.id,
        reference: refund.reference,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        adminNote: refund.adminNote,
        reviewedBy: refund.reviewedBy?.name ?? null,
        reviewedAt: refund.reviewedAt ? refund.reviewedAt.toISOString() : null,
        createdAt: refund.createdAt.toISOString(),
      })),
      audit: audit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entity: 'StudentProfile',
        entityId: student.id,
        actor: entry.actor?.name ?? 'System',
        metadata: parseMetadata(entry.metadata),
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

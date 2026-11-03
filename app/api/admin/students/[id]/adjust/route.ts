import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { adjustStudentWallet } from '@/lib/adjustments';
import { adminAdjustmentSchema } from '@/lib/validators';
import { tenantWhere } from '@/lib/tenant';
import { requireAdmin } from '../../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const adjustSchema = adminAdjustmentSchema.omit({ studentProfileId: true });

/**
 * Manual wallet credit/debit. Delegates the money movement to
 * `adjustStudentWallet()` so the wallet, double-entry ledger, transaction row
 * and immutable audit entry are all written in one transaction.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, adjustSchema);

    const student = await prisma.studentProfile.findFirst({
      where: { id: params.id, ...tenantWhere(user) },
      select: { id: true, universityId: true },
    });
    if (!student) throw notFound('Student not found in your university.');

    const result = await adjustStudentWallet({
      studentProfileId: student.id,
      universityId: student.universityId,
      actorId: user.id,
      type: body.type,
      amount: body.amount,
      reason: body.reason,
    });

    return ok({
      balance: result.balance,
      reference: result.reference,
      transactionId: result.transaction.id,
      studentName: result.studentName,
      type: body.type,
      amount: body.amount,
      message:
        body.type === 'CREDIT'
          ? `Credited ${result.studentName}. New balance TZS ${result.balance.toLocaleString('en-US')}.`
          : `Debited ${result.studentName}. New balance TZS ${result.balance.toLocaleString('en-US')}.`,
    });
  } catch (error) {
    return fail(error);
  }
}

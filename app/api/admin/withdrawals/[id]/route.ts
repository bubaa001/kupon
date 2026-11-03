import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound } from '@/lib/errors';
import { withdrawalDecisionSchema } from '@/lib/validators';
import { tenantWhere } from '@/lib/tenant';
import { serializeAdminMoneyRequest } from '@/lib/payments/money-requests';
import { approveWithdrawal, rejectWithdrawal } from '@/lib/payments/withdrawal';
import { requireAdmin } from '../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/withdrawals/[id]
 *
 * Review ONE withdrawal request.
 *
 * APPROVED → atomically claim PENDING → APPROVED, debit the wallet once (conditional
 *            update), book a WITHDRAWAL transaction + balanced journal, pay out via
 *            the payment provider, audit `WITHDRAWAL_APPROVED`. A failed payout is
 *            compensated and the request returns to the queue.
 * REJECTED → claim, store note/reviewer, audit `WITHDRAWAL_REJECTED`. No money moves.
 *
 * The conditional claim inside the money transaction means two admins cannot
 * double-pay the same withdrawal.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, withdrawalDecisionSchema);

    const existing = await prisma.refundRequest.findFirst({
      where: { id: params.id, kind: 'WITHDRAWAL', ...tenantWhere(user) },
      select: { id: true, status: true },
    });
    if (!existing) throw notFound('Withdrawal request not found in your university.');
    if (existing.status !== 'PENDING') {
      throw conflict(
        `This withdrawal was already ${existing.status.toLowerCase()} and can no longer be reviewed.`,
      );
    }

    if (body.decision === 'REJECTED') {
      const row = await rejectWithdrawal({
        requestId: params.id,
        reviewerId: user.id,
        adminNote: body.adminNote,
      });
      return ok({ kind: 'WITHDRAWAL', request: serializeAdminMoneyRequest(row) });
    }

    const result = await approveWithdrawal({
      requestId: params.id,
      reviewerId: user.id,
      adminNote: body.adminNote,
    });

    return ok({
      kind: 'WITHDRAWAL',
      request: serializeAdminMoneyRequest(result.request),
      payout: {
        reference: result.payout.reference,
        status: result.payout.status,
        provider: result.payout.provider,
        balance: result.balance,
        transactionReference: result.transactionReference,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

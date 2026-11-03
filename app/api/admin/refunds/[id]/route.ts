import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound } from '@/lib/errors';
import { orderRefundDecisionSchema } from '@/lib/validators';
import { tenantWhere } from '@/lib/tenant';
import { serializeAdminMoneyRequest } from '@/lib/payments/money-requests';
import { approveOrderRefund, rejectOrderRefund } from '@/lib/payments/order-refund';
import { requireAdmin } from '../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/refunds/[id]
 *
 * Review ONE order-refund request.
 *
 * APPROVED → atomically claim PENDING → APPROVED, re-credit the student wallet with
 *            the verified order total, reverse the vendor pending credit and the
 *            fee revenue on a balanced journal, book a REFUND transaction and audit
 *            `ORDER_REFUND_APPROVED`. This reverses the original payment exactly
 *            once; two admins cannot double-pay thanks to the conditional claim.
 * REJECTED → claim, store note/reviewer, audit `ORDER_REFUND_REJECTED`. No money moves.
 *
 * This route never calls a payment provider: an order refund returns money to the
 * wallet, it does not send money out to mobile money (that is a withdrawal).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, orderRefundDecisionSchema);

    const existing = await prisma.refundRequest.findFirst({
      where: { id: params.id, kind: 'REFUND', ...tenantWhere(user) },
      select: { id: true, status: true },
    });
    if (!existing) throw notFound('Refund request not found in your university.');
    if (existing.status !== 'PENDING') {
      throw conflict(
        `This refund was already ${existing.status.toLowerCase()} and can no longer be reviewed.`,
      );
    }

    if (body.decision === 'REJECTED') {
      const row = await rejectOrderRefund({
        requestId: params.id,
        reviewerId: user.id,
        adminNote: body.adminNote,
      });
      return ok({ kind: 'REFUND', request: serializeAdminMoneyRequest(row) });
    }

    const result = await approveOrderRefund({
      requestId: params.id,
      reviewerId: user.id,
      adminNote: body.adminNote,
    });

    return ok({
      kind: 'REFUND',
      request: serializeAdminMoneyRequest(result.request),
      refund: {
        transactionReference: result.transactionReference,
        balance: result.balance,
        orderReference: result.request.order?.reference ?? null,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

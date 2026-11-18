import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/db';
import { safeJson } from '@/lib/utils';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS: Record<string, string> = {
  FINANCE_EMERGENCY_TEST_SETTLEMENT_RECORDED: 'Withdrew money',
  CAFETERIA_CREDIT_ISSUED: 'Gave credit',
  CAFETERIA_CASH_REFUND_RECORDED: 'Gave money back',
  CAFETERIA_CREDIT_REJECTED_BY_FINANCE: 'Rejected a case',
};

/**
 * GET /api/vendor/finance-activity
 * Everything this cafeteria's Finance people did with money, newest first, so
 * the owner can see it even when they were away.
 */
export async function GET() {
  try {
    const { vendor } = await requireVendorAccess();
    const team = await prisma.user.findMany({
      where: { managedVendorId: vendor.id, role: { in: ['FINANCE', 'DISABLED'] } },
      select: { id: true, name: true },
    });
    if (!team.length) return ok({ items: [] });
    const names = new Map(team.map((member) => [member.id, member.name]));

    const rows = await prisma.auditLog.findMany({
      where: { actorId: { in: team.map((member) => member.id) }, action: { in: Object.keys(ACTIONS) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, actorId: true, action: true, metadata: true, createdAt: true },
    });

    return ok({
      items: rows.map((row) => {
        const meta = safeJson<Record<string, unknown>>(row.metadata, {});
        const amount = Number(meta.amount);
        return {
          id: row.id,
          who: names.get(row.actorId ?? '') ?? 'Finance',
          what: ACTIONS[row.action] ?? row.action,
          amount: Number.isFinite(amount) ? amount : null,
          note:
            typeof meta.emergencyReason === 'string'
              ? meta.emergencyReason
              : typeof meta.note === 'string'
                ? meta.note
                : null,
          reference: typeof meta.reference === 'string' ? meta.reference : null,
          at: row.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    return fail(error);
  }
}

import { prisma } from '@/lib/db';
import { safeJson } from '@/lib/utils';

/**
 * The cafeteria's reason for declining unpaid order requests, keyed by order id.
 * Declines are recorded in the audit log, so this reads the latest entry per order.
 */
export async function getDeclineReasons(
  orders: Array<{ id: string; status: string }>,
): Promise<Map<string, string>> {
  const ids = orders.filter((order) => order.status === 'CANCELLED').map((order) => order.id);
  const reasons = new Map<string, string>();
  if (!ids.length) return reasons;

  const rows = await prisma.auditLog.findMany({
    where: { action: 'UNPAID_ORDER_REQUEST_DECLINED', entity: 'Order', entityId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, metadata: true },
  });
  for (const row of rows) {
    if (!row.entityId || reasons.has(row.entityId)) continue;
    const reason = safeJson<{ reason?: unknown }>(row.metadata, {}).reason;
    if (typeof reason === 'string' && reason.trim()) reasons.set(row.entityId, reason.trim());
  }
  return reasons;
}

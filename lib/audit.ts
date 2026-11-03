import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type AuditInput = {
  actorId?: string | null;
  universityId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only audit trail for money-moving admin actions. Every manual
 * adjustment, refund decision, vendor suspension and menu approval uses this.
 */
export async function auditLog(input: AuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  return client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      universityId: input.universityId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

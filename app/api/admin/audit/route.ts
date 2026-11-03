import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { parseMetadata } from '../_lib/serializers';
import { tenantWhere } from '@/lib/tenant';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  universityId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, auditQuerySchema);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: tenantWhere(user, query.universityId),
        include: { actor: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      }),
      prisma.auditLog.count({ where: tenantWhere(user, query.universityId) }),
    ]);

    return ok({
      logs: logs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        actor: entry.actor?.name ?? 'System',
        actorRole: entry.actor?.role ?? null,
        metadata: parseMetadata(entry.metadata),
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
    });
  } catch (error) {
    return fail(error);
  }
}

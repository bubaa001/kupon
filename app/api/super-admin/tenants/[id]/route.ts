import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { conflict, notFound } from '@/lib/errors';
import type { TenantMutationResult } from '@/app/super-admin/_components/types';
import { serializeTenantCore } from '../../_lib/platform';

export const dynamic = 'force-dynamic';

const tenantPatchSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    paymentRouteCode: z
      .string()
      .regex(/^\d{6}$/, 'Lipa Namba must be exactly 6 digits')
      .optional(),
    saasFee: z.number().int().min(0).max(10_000_000).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.paymentRouteCode !== undefined ||
      value.saasFee !== undefined,
    { message: 'Choose at least one field to update.' },
  );

/**
 * PATCH /api/super-admin/tenants/[id]
 *
 * Suspend/reactivate a tenant, reassign its Lipa Namba route code, or change
 * its SaaS subscription fee. Every mutation is audit-logged with before/after
 * values; route codes stay globally unique so money can never route to the
 * wrong campus.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const input = await parseJson(request, tenantPatchSchema);

    const existing = await prisma.university.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound('That university could not be found.');

    if (input.paymentRouteCode && input.paymentRouteCode !== existing.paymentRouteCode) {
      const clash = await prisma.university.findFirst({
        where: {
          paymentRouteCode: input.paymentRouteCode,
          id: { not: existing.id },
        },
        select: { name: true },
      });
      if (clash) {
        throw conflict(
          `Lipa Namba ${input.paymentRouteCode} is already assigned to ${clash.name}.`,
        );
      }
    }

    const data: Prisma.UniversityUpdateInput = {};
    const audits: Array<{ action: string; metadata: Record<string, unknown> }> = [];

    if (input.status && input.status !== existing.status) {
      data.status = input.status;
      audits.push({
        action: input.status === 'SUSPENDED' ? 'UNIVERSITY_SUSPENDED' : 'UNIVERSITY_REACTIVATED',
        metadata: { from: existing.status, to: input.status },
      });
    }

    if (input.paymentRouteCode && input.paymentRouteCode !== existing.paymentRouteCode) {
      data.paymentRouteCode = input.paymentRouteCode;
      audits.push({
        action: 'UNIVERSITY_ROUTE_CODE_UPDATED',
        metadata: { from: existing.paymentRouteCode, to: input.paymentRouteCode },
      });
    }

    if (typeof input.saasFee === 'number' && input.saasFee !== existing.saasFee) {
      data.saasFee = input.saasFee;
      audits.push({
        action: 'UNIVERSITY_SAAS_FEE_UPDATED',
        metadata: { from: existing.saasFee, to: input.saasFee },
      });
    }

    if (audits.length === 0) {
      // Nothing actually changed — treat as an idempotent success.
      const noop: TenantMutationResult = { university: serializeTenantCore(existing) };
      return ok(noop);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const university = await tx.university.update({
        where: { id: existing.id },
        data,
      });

      for (const entry of audits) {
        await auditLog(
          {
            actorId: user.id,
            universityId: university.id,
            action: entry.action,
            entity: 'University',
            entityId: university.id,
            metadata: entry.metadata,
          },
          tx,
        );
      }

      return university;
    });

    const result: TenantMutationResult = { university: serializeTenantCore(updated) };
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

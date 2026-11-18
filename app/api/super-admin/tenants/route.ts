import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { conflict } from '@/lib/errors';
import { universitySchema } from '@/lib/validators';
import type {

  TenantListData,
  TenantMutationResult,
} from '@/app/super-admin/_components/types';
import { buildTenantSummaries, serializeTenantCore } from '../_lib/platform';

export const dynamic = 'force-dynamic';

/** GET /api/super-admin/tenants — every tenant with its revenue + billing health. */
export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);

    const { tenants, totals, invoices } = await buildTenantSummaries();

    const data: TenantListData = {
      generatedAt: new Date().toISOString(),
      tenants,
      summary: {
        total: totals.total,
        active: totals.active,
        suspended: totals.suspended,
        students: totals.students,
        vendors: totals.vendors,
        saasMrr: totals.saasMrr,
        pendingInvoices: invoices.pendingCount,
      },
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/super-admin/tenants — onboard a university.
 *
 * Creates the University (unique name and code; Kupon generates the internal
 * route code) and an
 * audit-log entry. Universities get no admin account or invoice: Kupon serves
 * cafeterias directly.
 *
 * If any step fails the whole onboarding rolls back — no half-provisioned tenant.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const input = await parseJson(request, universitySchema);

    const existing = await prisma.university.findMany({
      select: { name: true, code: true, paymentRouteCode: true },
    });

    const normalizedName = input.name.trim().toLowerCase();
    if (existing.some((tenant) => tenant.name.trim().toLowerCase() === normalizedName)) {
      throw conflict(`A university named "${input.name}" already exists on Kupon.`);
    }
    if (existing.some((tenant) => tenant.code === input.code)) {
      throw conflict(`The university code ${input.code} is already in use.`);
    }
    const taken = new Set(existing.map((tenant) => tenant.paymentRouteCode));
    let paymentRouteCode = input.paymentRouteCode;
    if (paymentRouteCode && taken.has(paymentRouteCode)) {
      throw conflict(`Route code ${paymentRouteCode} is already assigned to another university.`);
    }
    while (!paymentRouteCode || taken.has(paymentRouteCode)) {
      paymentRouteCode = String(randomInt(100_000, 1_000_000));
    }
    const saasFee = input.saasFee ?? 0;

    const created = await prisma.$transaction(async (tx) => {
      const university = await tx.university.create({
        data: {
          name: input.name,
          code: input.code,
          paymentRouteCode,
          city: input.city,
          saasFee,
          brandColor: input.brandColor,
          status: 'ACTIVE',
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: university.id,
          action: 'UNIVERSITY_ONBOARDED',
          entity: 'University',
          entityId: university.id,
          metadata: {
            code: university.code,
            paymentRouteCode: university.paymentRouteCode,
            city: university.city,
            saasFee: university.saasFee,
          },
        },
        tx,
      );

      return { university };
    });

    const data: TenantMutationResult = {
      university: serializeTenantCore(created.university),
    };

    return ok(data);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(conflict('That university code was just taken. Please retry.'));
    }
    return fail(error);
  }
}

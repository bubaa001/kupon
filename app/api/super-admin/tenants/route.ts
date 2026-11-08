import bcrypt from 'bcryptjs';
import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { requireApiUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { conflict } from '@/lib/errors';
import { randomReference } from '@/lib/utils';
import { universitySchema } from '@/lib/validators';
import type {
  InvoiceLite,
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
 * Creates, in one transaction:
 *   1. the University (unique name, code and Lipa Namba route code),
 *   2. its first ADMIN user with a bcrypt password hash,
 *   3. the first SaaS invoice for the current billing period,
 *   4. an audit-log entry.
 *
 * If any step fails the whole onboarding rolls back — no half-provisioned tenant.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const input = await parseJson(request, universitySchema);

    const [existing, phoneOwner] = await Promise.all([
      prisma.university.findMany({
        select: { name: true, code: true, paymentRouteCode: true },
      }),
      prisma.user.findUnique({ where: { phone: input.adminPhone }, select: { id: true } }),
    ]);

    const normalizedName = input.name.trim().toLowerCase();
    if (existing.some((tenant) => tenant.name.trim().toLowerCase() === normalizedName)) {
      throw conflict(`A university named "${input.name}" already exists on Kupon.`);
    }
    if (existing.some((tenant) => tenant.code === input.code)) {
      throw conflict(`The university code ${input.code} is already in use.`);
    }
    if (existing.some((tenant) => tenant.paymentRouteCode === input.paymentRouteCode)) {
      throw conflict(
        `Lipa Namba ${input.paymentRouteCode} is already assigned to another university.`,
      );
    }
    if (phoneOwner) {
      throw conflict(
        `An account already exists for ${input.adminPhone}. Sign in as that user or use another number.`,
      );
    }

    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    const period = format(new Date(), 'yyyy-MM');
    // `universitySchema` applies a default SaaS fee; guard the optional input
    // type so the (required) invoice amount is never undefined.
    const saasFee = input.saasFee ?? 250_000;

    const created = await prisma.$transaction(async (tx) => {
      const university = await tx.university.create({
        data: {
          name: input.name,
          code: input.code,
          paymentRouteCode: input.paymentRouteCode,
          city: input.city,
          saasFee,
          brandColor: input.brandColor,
          status: 'ACTIVE',
        },
      });

      const admin = await tx.user.create({
        data: {
          name: input.adminName,
          phone: input.adminPhone,
          role: 'ADMIN',
          universityId: university.id,
          passwordHash,
        },
        select: { id: true, name: true, phone: true },
      });

      const invoice = await tx.saasInvoice.create({
        data: {
          reference: randomReference('INV'),
          universityId: university.id,
          amount: saasFee,
          period,
          status: 'PENDING',
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
            adminUserId: admin.id,
            adminPhone: admin.phone,
            firstInvoice: invoice.reference,
          },
        },
        tx,
      );

      return { university, admin, invoice };
    });

    const invoice: InvoiceLite = {
      id: created.invoice.id,
      reference: created.invoice.reference,
      period: created.invoice.period,
      amount: created.invoice.amount,
      status: created.invoice.status,
      issuedAt: created.invoice.issuedAt.toISOString(),
    };

    const data: TenantMutationResult = {
      university: serializeTenantCore(created.university),
      admin: { name: created.admin.name, phone: created.admin.phone ?? input.adminPhone },
      invoice,
    };

    return ok(data);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(conflict('That university code or Lipa Namba was just taken. Please retry.'));
    }
    return fail(error);
  }
}

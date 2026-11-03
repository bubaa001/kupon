import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { conflict, notFound } from '@/lib/errors';
import { parseQuery, requireAdmin, requireUniversityId } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settingsQuerySchema = z.object({
  universityId: z.string().min(1).optional(),
});

const settingsPatchSchema = z
  .object({
    name: z.string().trim().min(4, 'University name is too short').max(120).optional(),
    city: z.string().trim().min(2, 'Add the city').max(60).optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #10B981')
      .optional(),
    paymentRouteCode: z
      .string()
      .regex(/^\d{6}$/, 'The Lipa Namba must be exactly 6 digits')
      .optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Change at least one field before saving.',
  });

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    parseQuery(request, settingsQuerySchema);
    const universityId = requireUniversityId(user, request);

    const [university, invoices, ledgerTotals, ledgerByAccount] = await Promise.all([
      prisma.university.findUnique({ where: { id: universityId } }),
      prisma.saasInvoice.findMany({
        where: { universityId },
        orderBy: { issuedAt: 'desc' },
        take: 24,
      }),
      prisma.ledgerEntry.aggregate({
        where: { universityId },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ['account'],
        where: { universityId },
        _sum: { debit: true, credit: true },
      }),
    ]);

    if (!university) throw notFound('University not found.');

    const debits = ledgerTotals._sum.debit ?? 0;
    const credits = ledgerTotals._sum.credit ?? 0;

    return ok({
      university: {
        id: university.id,
        name: university.name,
        code: university.code,
        city: university.city,
        paymentRouteCode: university.paymentRouteCode,
        saasFee: university.saasFee,
        brandColor: university.brandColor,
        status: university.status,
        createdAt: university.createdAt.toISOString(),
      },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        reference: invoice.reference,
        amount: invoice.amount,
        period: invoice.period,
        status: invoice.status,
        issuedAt: invoice.issuedAt.toISOString(),
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      })),
      ledger: {
        debits,
        credits,
        balanced: debits === credits,
        entries: ledgerTotals._count._all,
        accounts: ledgerByAccount
          .map((row) => ({
            account: row.account,
            debit: row._sum.debit ?? 0,
            credit: row._sum.credit ?? 0,
            net: (row._sum.debit ?? 0) - (row._sum.credit ?? 0),
          }))
          .sort((a, b) => a.account.localeCompare(b.account)),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, settingsPatchSchema);
    const universityId = requireUniversityId(user, request);

    const university = await prisma.university.findUnique({ where: { id: universityId } });
    if (!university) throw notFound('University not found.');

    if (
      body.paymentRouteCode &&
      body.paymentRouteCode !== university.paymentRouteCode
    ) {
      const taken = await prisma.university.findUnique({
        where: { paymentRouteCode: body.paymentRouteCode },
        select: { id: true, name: true },
      });
      if (taken && taken.id !== university.id) {
        throw conflict(
          `Lipa Namba ${body.paymentRouteCode} is already assigned to ${taken.name}.`,
        );
      }
    }

    const updated = await prisma.university.update({
      where: { id: university.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.brandColor !== undefined ? { brandColor: body.brandColor } : {}),
        ...(body.paymentRouteCode !== undefined
          ? { paymentRouteCode: body.paymentRouteCode }
          : {}),
      },
    });

    await auditLog({
      actorId: user.id,
      universityId: university.id,
      action:
        body.paymentRouteCode && body.paymentRouteCode !== university.paymentRouteCode
          ? 'LIPA_NAMBA_UPDATED'
          : 'UNIVERSITY_UPDATED',
      entity: 'University',
      entityId: university.id,
      metadata: {
        before: {
          name: university.name,
          city: university.city,
          brandColor: university.brandColor,
          paymentRouteCode: university.paymentRouteCode,
        },
        after: {
          name: updated.name,
          city: updated.city,
          brandColor: updated.brandColor,
          paymentRouteCode: updated.paymentRouteCode,
        },
        actorRole: user.role,
      },
    });

    return ok({
      university: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        city: updated.city,
        paymentRouteCode: updated.paymentRouteCode,
        saasFee: updated.saasFee,
        brandColor: updated.brandColor,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
      },
      message: 'University settings saved.',
    });
  } catch (error) {
    return fail(error);
  }
}

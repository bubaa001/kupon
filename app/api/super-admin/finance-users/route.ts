import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';
import { MIN_WITHDRAWAL } from '@/lib/constants';
import { safeJson } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTeamAccountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
  role: z.enum(['FINANCE', 'STAFF']).default('FINANCE'),
  vendorId: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (value.role === 'STAFF' && !value.vendorId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vendorId'],
      message: 'Choose a cafeteria for a staff account.',
    });
  }
});

const withdrawalLimitSchema = z.object({
  userId: z.string().min(1),
  emergencyWithdrawalLimit: z
    .number()
    .int()
    .min(0)
    .max(5_000_000)
    .refine((value) => value === 0 || value >= MIN_WITHDRAWAL),
}).strict();

export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const [vendors, accounts, withdrawalEvents] = await Promise.all([
      prisma.vendor.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true, university: { select: { name: true } } },
        orderBy: [{ university: { name: 'asc' } }, { name: 'asc' }],
      }),
      prisma.user.findMany({
        where: { role: 'FINANCE' },
        select: {
          id: true,
          name: true,
          phone: true,
          emergencyWithdrawalLimit: true,
          managedVendor: { select: { id: true, name: true, code: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { action: 'FINANCE_EMERGENCY_TEST_SETTLEMENT_RECORDED' },
        select: {
          id: true,
          actor: { select: { name: true } },
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const emergencyWithdrawals = withdrawalEvents.map((event) => {
      const metadata = safeJson<Record<string, unknown>>(event.metadata, {});
      return {
        id: event.id,
        actorName: event.actor?.name ?? 'Former Finance user',
        vendorName: typeof metadata.vendorName === 'string' ? metadata.vendorName : 'Cafeteria',
        vendorCode: typeof metadata.vendorCode === 'string' ? metadata.vendorCode : '',
        amount: typeof metadata.amount === 'number' ? metadata.amount : 0,
        reason: typeof metadata.emergencyReason === 'string' ? metadata.emergencyReason : '',
        reference: typeof metadata.reference === 'string' ? metadata.reference : '',
        createdAt: event.createdAt.toISOString(),
      };
    });
    return ok({ vendors, accounts, emergencyWithdrawals });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireApiUser(['SUPER_ADMIN']);
    const body = await parseJson(request, withdrawalLimitSchema);
    const account = await prisma.user.findFirst({
      where: { id: body.userId, role: 'FINANCE', managedVendorId: { not: null } },
      select: { id: true, managedVendorId: true, universityId: true },
    });
    if (!account?.managedVendorId || !account.universityId) {
      throw notFound('A cafeteria-scoped Finance account is required.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.id },
        data: { emergencyWithdrawalLimit: body.emergencyWithdrawalLimit },
      });
      await auditLog(
        {
          actorId: actor.id,
          universityId: account.universityId,
          action: 'FINANCE_EMERGENCY_WITHDRAWAL_LIMIT_UPDATED',
          entity: 'User',
          entityId: account.id,
          metadata: {
            vendorId: account.managedVendorId,
            emergencyWithdrawalLimit: body.emergencyWithdrawalLimit,
          },
        },
        tx,
      );
    });
    return ok({ emergencyWithdrawalLimit: body.emergencyWithdrawalLimit });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser(['SUPER_ADMIN']);
    const limit = await rateLimit(`super-admin:create-finance:${actor.id}`, 5, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many team accounts created. Try again later.');
    const body = await parseJson(request, createTeamAccountSchema);
    const vendor = body.vendorId
      ? await prisma.vendor.findFirst({
          where: { id: body.vendorId, status: 'ACTIVE' },
          select: { id: true, code: true, universityId: true },
        })
      : null;
    if (body.vendorId && !vendor) throw notFound('The selected cafeteria is not active.');

    if (await prisma.user.findUnique({ where: { phone: body.phone }, select: { id: true } })) {
      throw conflict('That phone number is already linked to a Kupon account.');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name,
          phone: body.phone,
          role: body.role,
          passwordHash,
          universityId: vendor?.universityId ?? null,
          managedVendorId: vendor?.id ?? null,
        },
        select: { id: true, name: true, phone: true, role: true },
      });
      await auditLog(
        {
          actorId: actor.id,
          action: body.role === 'STAFF' ? 'STAFF_USER_CREATED' : 'FINANCE_USER_CREATED',
          entity: 'User',
          entityId: created.id,
          metadata: { role: created.role, vendorId: vendor?.id ?? null },
        },
        tx,
      );
      return created;
    });

    return ok({ user }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

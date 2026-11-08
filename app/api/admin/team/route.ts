import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';
import { externalUrl } from '@/lib/request-origin';
import { requireUniversityId, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTeamInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  role: z.enum(['STAFF', 'FINANCE']),
  vendorId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const requestedUniversityId = new URL(request.url).searchParams.get('universityId');
    const universityId =
      user.role === 'SUPER_ADMIN'
        ? requestedUniversityId || undefined
        : requireUniversityId(user, request);
    const [vendors, accounts, invites] = await Promise.all([
      prisma.vendor.findMany({
        where: { ...(universityId ? { universityId } : {}), status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          ...(universityId ? { universityId } : {}),
          role: { in: ['STAFF', 'FINANCE'] },
          managedVendorId: { not: null },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          managedVendor: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teamInvite.findMany({
        where: {
          ...(universityId ? { universityId } : {}),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          vendor: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return ok({
      vendors,
      invites: invites.map((invite) => ({
        ...invite,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      })),
      accounts: accounts.map((account) => ({
        ...account,
        createdAt: account.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const scopeUniversityId =
      actor.role === 'SUPER_ADMIN' ? null : requireUniversityId(actor, request);
    const limit = rateLimit(`admin:create-team-account:${actor.id}`, 10, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many team accounts created. Try again later.');

    const body = await parseJson(request, createTeamInviteSchema);
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: body.vendorId,
        ...(scopeUniversityId ? { universityId: scopeUniversityId } : {}),
        status: 'ACTIVE',
      },
      select: { id: true, universityId: true },
    });
    if (!vendor) throw notFound('The selected cafeteria is not active in your university.');
    const universityId = vendor.universityId;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone: body.phone }, { email: body.email }] },
      select: { id: true },
    });
    if (existing) throw conflict('That email or phone number already belongs to a Kupon account.');
    const pendingInvite = await prisma.teamInvite.findFirst({
      where: { email: body.email, vendorId: vendor.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pendingInvite) throw conflict('An active invite already exists for that email.');

    const rawToken = randomBytes(32).toString('base64url');
    const invite = await prisma.$transaction(async (tx) => {
      const created = await tx.teamInvite.create({
        data: {
          tokenHash: createHash('sha256').update(rawToken).digest('hex'),
          name: body.name,
          email: body.email,
          phone: body.phone,
          role: body.role,
          universityId,
          vendorId: vendor.id,
          createdById: actor.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        },
        select: { id: true, name: true, email: true, phone: true, role: true, expiresAt: true },
      });

      await auditLog(
        {
          actorId: actor.id,
          universityId,
          action: body.role === 'STAFF' ? 'STAFF_INVITE_CREATED' : 'FINANCE_INVITE_CREATED',
          entity: 'TeamInvite',
          entityId: created.id,
          metadata: { role: body.role, vendorId: vendor.id, email: created.email },
        },
        tx,
      );
      return created;
    });

    return ok(
      {
        invite: {
          ...invite,
          expiresAt: invite.expiresAt.toISOString(),
          inviteUrl: new URL(`/staff/invite/${rawToken}`, externalUrl(request, '/')).toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(error);
  }
}

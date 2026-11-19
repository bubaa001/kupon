import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { disableAccount } from '@/lib/accounts/disable-account';
import { getFeeSettings } from '@/lib/platform-settings';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';
import { externalUrl } from '@/lib/request-origin';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTeamInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  role: z.enum(['STAFF', 'FINANCE']),
});

export async function GET() {
  try {
    const { vendor } = await requireVendorAccess();
    const [accounts, invites] = await Promise.all([
      prisma.user.findMany({
      where: { managedVendorId: vendor.id, role: { in: ['STAFF', 'FINANCE'] } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        emergencyWithdrawalLimit: true,
      },
      orderBy: { createdAt: 'desc' },
      }),
      prisma.teamInvite.findMany({
        where: { vendorId: vendor.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, name: true, email: true, role: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return ok({ accounts, invites });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user: actor, vendor, universityId } = await requireVendorAccess();
    const limit = await rateLimit(`vendor:create-team-account:${vendor.id}`, 10, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many team accounts created. Try again later.');

    const body = await parseJson(request, createTeamInviteSchema);
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
          action: 'VENDOR_TEAM_INVITE_CREATED',
          entity: 'TeamInvite',
          entityId: created.id,
          metadata: { role: created.role, vendorId: vendor.id, email: created.email },
        },
        tx,
      );
      return created;
    });

    const inviteUrl = new URL(`/staff/invite/${rawToken}`, externalUrl(request, '/')).toString();
    return ok({ invite: { ...invite, inviteUrl } }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

const financeLimitSchema = z
  .object({
    userId: z.string().min(1),
    /** TZS a Finance person may withdraw per day without the owner. 0 turns it off. */
    dailyWithdrawalLimit: z.number().int().min(0).max(50_000_000),
  })
  .strict();

/** PATCH /api/vendor/team: the owner sets a Finance person's daily withdrawal limit. */
export async function PATCH(request: Request) {
  try {
    const { user: actor, vendor, universityId } = await requireVendorAccess();
    const body = await parseJson(request, financeLimitSchema);
    const { minWithdrawal } = await getFeeSettings();
    if (body.dailyWithdrawalLimit !== 0 && body.dailyWithdrawalLimit < minWithdrawal) {
      throw conflict(
        `Use 0 to turn withdrawals off, or at least the TZS ${minWithdrawal.toLocaleString()} minimum withdrawal.`,
      );
    }
    const updated = await prisma.user.updateMany({
      where: { id: body.userId, managedVendorId: vendor.id, role: 'FINANCE' },
      data: { emergencyWithdrawalLimit: body.dailyWithdrawalLimit },
    });
    if (!updated.count) throw notFound('Finance account not found in your cafeteria.');
    await auditLog({
      actorId: actor.id,
      universityId,
      action: 'FINANCE_WITHDRAWAL_LIMIT_SET',
      entity: 'User',
      entityId: body.userId,
      metadata: { vendorId: vendor.id, dailyWithdrawalLimit: body.dailyWithdrawalLimit },
    });
    return ok({ userId: body.userId, dailyWithdrawalLimit: body.dailyWithdrawalLimit });
  } catch (error) {
    return fail(error);
  }
}

/**
 * DELETE /api/vendor/team?userId=…: the owner removes a staff or Finance account. History stays.
 * DELETE /api/vendor/team?inviteId=…: the owner cancels an invitation nobody has accepted yet.
 */
export async function DELETE(request: Request) {
  try {
    const { user: actor, vendor, universityId } = await requireVendorAccess();
    const params = new URL(request.url).searchParams;
    const inviteId = params.get('inviteId');
    if (inviteId) {
      const removed = await prisma.teamInvite.deleteMany({
        where: { id: inviteId, vendorId: vendor.id, acceptedAt: null },
      });
      if (!removed.count) throw notFound('That invitation was already used or cancelled.');
      await auditLog({
        actorId: actor.id,
        universityId,
        action: 'TEAM_INVITE_CANCELLED',
        entity: 'TeamInvite',
        entityId: inviteId,
        metadata: { vendorId: vendor.id },
      });
      return ok({ inviteId });
    }
    const userId = params.get('userId');
    if (!userId) throw notFound('Choose a team member to remove.');
    const result = await disableAccount({
      userId,
      actorId: actor.id,
      reason: 'Removed by cafeteria owner',
      where: { managedVendorId: vendor.id, role: { in: ['STAFF', 'FINANCE'] } },
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

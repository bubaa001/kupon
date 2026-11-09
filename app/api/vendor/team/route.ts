import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, tooManyRequests } from '@/lib/errors';
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
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
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

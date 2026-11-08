import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, forbidden, notFound } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { roleHome, signSession, setSessionCookie } from '@/lib/auth';
import type { Role } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const acceptSchema = z.object({
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
});

async function findActiveInvite(token: string) {
  if (!/^[\w-]{40,60}$/.test(token)) return null;
  return prisma.teamInvite.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    include: {
      vendor: { select: { id: true, name: true, status: true } },
      university: { select: { status: true } },
    },
  });
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const invite = await findActiveInvite(params.token);
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw notFound('This team invitation is invalid or has expired.');
    }
    if (invite.vendor.status !== 'ACTIVE' || invite.university.status !== 'ACTIVE') {
      throw forbidden('This cafeteria or university is not active. Ask the platform administrator for help.');
    }
    return ok({
      invite: {
        name: invite.name,
        email: invite.email,
        role: invite.role,
        vendorName: invite.vendor.name,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const invite = await findActiveInvite(params.token);
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw notFound('This team invitation is invalid or has expired.');
    }
    if (invite.vendor.status !== 'ACTIVE' || invite.university.status !== 'ACTIVE') {
      throw forbidden('This cafeteria or university is not active. Ask the platform administrator for help.');
    }

    const body = await parseJson(request, acceptSchema);
    if (
      await prisma.user.findFirst({
        where: { OR: [{ email: invite.email }, { phone: invite.phone }] },
        select: { id: true },
      })
    ) {
      throw conflict('This email or phone number already belongs to a Kupon account.');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.teamInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw conflict('This invitation has already been used.');

      const created = await tx.user.create({
        data: {
          name: invite.name,
          email: invite.email,
          phone: invite.phone,
          role: invite.role,
          passwordHash,
          universityId: invite.universityId,
          managedVendorId: invite.vendorId,
        },
        select: { id: true, name: true, phone: true, role: true, universityId: true },
      });
      await auditLog(
        {
          actorId: created.id,
          universityId: invite.universityId,
          action: 'TEAM_INVITE_ACCEPTED',
          entity: 'TeamInvite',
          entityId: invite.id,
          metadata: { role: invite.role, vendorId: invite.vendorId, email: invite.email },
        },
        tx,
      );
      return created;
    });

    const role = user.role as Role;
    const token = await signSession({
      uid: user.id,
      role,
      universityId: user.universityId,
      name: user.name,
      phone: user.phone ?? '',
    });
    const response = ok({ user, redirectTo: roleHome(role) }, { status: 201 });
    return setSessionCookie(response, token);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(conflict('This email or phone number already belongs to a Kupon account.'));
    }
    return fail(error);
  }
}

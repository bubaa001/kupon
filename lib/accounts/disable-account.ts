import type { Prisma } from '@prisma/client';
import { auditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { conflict, notFound } from '@/lib/errors';

export const DISABLED_ROLE = 'DISABLED';

/**
 * "Deletes" an account without breaking the books: the person can never sign in
 * again (role, sign-in identifiers and password are cleared, sessions revoked),
 * their name is hidden, and every order, payment and audit record stays.
 * Disabling a cafeteria owner also suspends their cafeteria.
 */
export async function disableAccount(input: {
  userId: string;
  actorId: string;
  reason: string;
  /** Only disable when the account matches, e.g. a team member of one cafeteria. */
  where?: Prisma.UserWhereInput;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: input.userId, ...(input.where ?? {}) },
      select: {
        id: true,
        role: true,
        name: true,
        universityId: true,
        managedVendorId: true,
        vendor: { select: { id: true } },
      },
    });
    if (!target) throw notFound('Account not found.');
    if (target.role === DISABLED_ROLE) throw conflict('This account is already removed.');
    if (target.role === 'SUPER_ADMIN') {
      const otherOwners = await tx.user.count({
        where: { role: 'SUPER_ADMIN', id: { not: target.id } },
      });
      if (!otherOwners) throw conflict('Kupon must keep at least one platform admin.');
    }

    await tx.user.update({
      where: { id: target.id },
      data: {
        role: DISABLED_ROLE,
        name: 'Removed account',
        email: null,
        phone: null,
        username: null,
        googleId: null,
        passwordHash: null,
        otp: null,
        otpExpiresAt: null,
        emergencyWithdrawalLimit: 0,
        sessionVersion: { increment: 1 },
      },
    });
    if (target.vendor) {
      await tx.vendor.update({ where: { id: target.vendor.id }, data: { status: 'SUSPENDED' } });
    }
    await tx.teamInvite.deleteMany({ where: { createdById: target.id, acceptedAt: null } });

    await auditLog(
      {
        actorId: input.actorId,
        universityId: target.universityId,
        action: 'ACCOUNT_DISABLED',
        entity: 'User',
        entityId: target.id,
        metadata: {
          previousRole: target.role,
          previousName: target.name,
          vendorId: target.vendor?.id ?? target.managedVendorId,
          reason: input.reason,
        },
      },
      tx,
    );
    return { id: target.id, previousRole: target.role };
  });
}

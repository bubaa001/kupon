import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { badRequest, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { disableAccount } from '@/lib/accounts/disable-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Buyer',
  VENDOR: 'Cafeteria owner',
  STAFF: 'Cafeteria staff',
  FINANCE: 'Cafeteria Finance',
  SUPER_ADMIN: 'Kupon admin',
  ADMIN: 'University admin (retired)',
};

/**
 * GET /api/super-admin/accounts?q=…  Search people who can (or could) sign in.
 * DELETE /api/super-admin/accounts?userId=…  Remove an account; history stays.
 */
export async function GET(request: Request) {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'DISABLED' },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { username: { contains: q, mode: 'insensitive' } },
                { vendor: { name: { contains: q, mode: 'insensitive' } } },
                { managedVendor: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        vendor: { select: { name: true, code: true } },
        managedVendor: { select: { name: true, code: true } },
      },
    });
    return ok({
      accounts: users.map((user) => ({
        id: user.id,
        name: user.name,
        contact: user.email ?? user.phone ?? '',
        role: user.role,
        roleLabel: ROLE_LABEL[user.role] ?? user.role,
        cafeteria: user.vendor?.name ?? user.managedVendor?.name ?? null,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiUser(['SUPER_ADMIN']);
    const limit = await rateLimit(`super-admin:disable-account:${actor.id}`, 30, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many removals. Try again later.');
    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) throw badRequest('Choose an account to remove.');
    if (userId === actor.id) throw badRequest('You cannot remove your own account.');
    const result = await disableAccount({ userId, actorId: actor.id, reason: 'Removed by Kupon' });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

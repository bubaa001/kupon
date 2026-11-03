import type { AuthUser } from '@/lib/auth';
import { assertTenant, requireApiUser, requireVendor } from '@/lib/auth';
import { forbidden } from '@/lib/errors';

/**
 * One guard for every /api/vendor route: authenticated VENDOR role, active
 * vendor account, and a resolved tenant boundary. Returning `universityId`
 * explicitly keeps every Prisma query tenant-scoped even though
 * `requireVendor()` returns a narrow vendor projection.
 */
export async function requireVendorAccess(): Promise<{
  user: AuthUser;
  vendor: NonNullable<AuthUser['vendor']>;
  universityId: string;
}> {
  const user = await requireApiUser(['VENDOR']);
  const vendor = requireVendor(user);
  const universityId = user.universityId;

  if (!universityId) {
    throw forbidden('Your vendor account is not linked to a university. Contact your manager.');
  }
  assertTenant(user, universityId);

  return { user, vendor, universityId };
}

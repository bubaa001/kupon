import type { AuthUser } from '@/lib/auth';
import { forbidden } from '@/lib/errors';

/**
 * Resolves the tenant scope for an admin request.
 *
 * - ADMIN always resolves to their own university (even if they try to pass a
 *   different universityId — we throw instead of silently ignoring it).
 * - SUPER_ADMIN may pass a universityId, or omit it for all tenants.
 */
export function resolveTenantScope(
  user: AuthUser,
  requestedUniversityId?: string | null,
): string | undefined {
  if (user.role === 'SUPER_ADMIN') {
    return requestedUniversityId ?? undefined;
  }

  if (!user.universityId) {
    throw forbidden('Your admin account is not linked to a university.');
  }
  if (requestedUniversityId && requestedUniversityId !== user.universityId) {
    throw forbidden('You cannot access another university’s records.');
  }
  return user.universityId;
}

/** The Prisma `where` fragment for tenant-scoped lists. */
export function tenantWhere(user: AuthUser, requested?: string | null) {
  const universityId = resolveTenantScope(user, requested);
  return universityId ? { universityId } : {};
}

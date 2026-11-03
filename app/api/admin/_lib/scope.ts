import type { ZodType, ZodTypeDef } from 'zod';
import type { AuthUser } from '@/lib/auth';
import { requireApiUser } from '@/lib/auth';
import { resolveTenantScope } from '@/lib/tenant';
import { badRequest } from '@/lib/errors';

/**
 * Every admin route starts here: ADMIN + SUPER_ADMIN only, then a tenant scope.
 * `tenantWhere()` / `resolveTenantScope()` are the only sanctioned ways to touch
 * tenant data, so a university admin can never read or write another campus.
 */
export async function requireAdmin(): Promise<AuthUser> {
  return requireApiUser(['ADMIN', 'SUPER_ADMIN']);
}

/** Search params without the empty strings native selects send for "all". */
export function searchValues(request: Request): Record<string, string> {
  const values: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    if (value !== '') values[key] = value;
  });
  return values;
}

export function parseQuery<T>(
  request: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
): T {
  return schema.parse(searchValues(request));
}

/** Resolves the tenant for single-tenant routes (settings, vendor creation). */
export function requireUniversityId(user: AuthUser, request: Request): string {
  const scope = resolveTenantScope(
    user,
    new URL(request.url).searchParams.get('universityId'),
  );
  if (!scope) {
    throw badRequest('Select a university before continuing.');
  }
  return scope;
}

/** Tenant `where` fragment for a route that followed `parseQuery`. */
export function tenantFragment(user: AuthUser, requestedUniversityId?: string | null) {
  return resolveTenantScope(user, requestedUniversityId);
}

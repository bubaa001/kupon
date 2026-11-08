import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH() {
  try {
    await requireApiUser(['FINANCE']);
    throw new AppError(
      'Cafeteria credit requests are reviewed by the platform admin.',
      410,
      'PLATFORM_ADMIN_REVIEW_REQUIRED',
    );
  } catch (error) {
    return fail(error);
  }
}

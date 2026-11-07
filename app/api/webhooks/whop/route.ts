import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return fail(new AppError('Legacy wallet payment callbacks are no longer accepted.', 410, 'PAYMENT_PROVIDER_DISABLED'));
}

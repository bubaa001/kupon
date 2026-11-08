import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return fail(new AppError('External payment callbacks are disabled.', 410, 'PAYMENT_PROVIDER_DISABLED'));
}

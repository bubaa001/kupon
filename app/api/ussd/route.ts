import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return fail(new AppError('The legacy USSD wallet simulator is disabled.', 404, 'USSD_DISABLED'));
}

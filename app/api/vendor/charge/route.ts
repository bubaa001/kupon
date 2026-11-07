import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireApiUser(['VENDOR']);
    return fail(new AppError('Wallet-based counter charges are no longer available.', 410, 'WALLET_DISABLED'));
  } catch (error) {
    return fail(error);
  }
}

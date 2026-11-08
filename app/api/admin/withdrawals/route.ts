import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    throw new AppError(
      'Student wallet withdrawals are retired. Kupon does not store or pay out student balances.',
      410,
      'WALLET_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

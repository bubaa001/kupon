import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireAdmin } from '../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH() {
  try {
    await requireAdmin();
    throw new AppError(
      'Wallet refunds are retired. Review eligible cafeteria credit requests in the platform admin workspace.',
      410,
      'WALLET_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

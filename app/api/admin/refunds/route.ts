import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    throw new AppError(
      'Student wallet refund requests are retired. Unfulfilled-order claims use the cafeteria credit review flow.',
      410,
      'WALLET_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

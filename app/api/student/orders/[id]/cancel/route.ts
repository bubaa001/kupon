import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireApiUser(['STUDENT']);
    throw new AppError(
      'Order cancellation into a student balance is retired. For an unfulfilled order, submit a cafeteria credit request.',
      410,
      'WALLET_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

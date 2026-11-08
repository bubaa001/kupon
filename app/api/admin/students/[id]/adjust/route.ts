import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireAdmin } from '../../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireAdmin();
    throw new AppError(
      'Student wallet adjustments are retired. Use the cafeteria credit review flow for eligible orders.',
      410,
      'WALLET_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(['STUDENT']);
    return fail(
      new AppError('Student top-ups are retired. Checkout is order-specific.', 410, 'WALLET_DISABLED'),
    );
  } catch (error) {
    return fail(error);
  }
}

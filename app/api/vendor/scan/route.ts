import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireVendorAccess();
    throw new AppError(
      'Student payment codes are retired. Students place orders and staff verify the issued coupon.',
      410,
      'PAYMENT_CODE_DISABLED',
    );
  } catch (error) {
    return fail(error);
  }
}

import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireApiUser(['FINANCE']);
    return fail(
      new AppError(
        'Payment stages are controlled automatically by Kupon’s test gateway.',
        410,
        'PAYMENT_GATEWAY_AUTOMATIC',
      ),
    );
  } catch (error) {
    return fail(error);
  }
}

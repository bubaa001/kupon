import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function disabled() {
  await requireApiUser(['STUDENT']);
  return fail(new AppError('Wallet payment codes are no longer available.', 410, 'WALLET_DISABLED'));
}

export async function GET() {
  try {
    return await disabled();
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    return await disabled();
  } catch (error) {
    return fail(error);
  }
}

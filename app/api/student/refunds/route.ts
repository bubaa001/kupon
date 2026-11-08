import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function rejectLegacyRefunds() {
  await requireApiUser(['STUDENT']);
  return fail(
    new AppError(
      'Wallet refunds are retired. For an unfulfilled order, submit a cafeteria credit request.',
      410,
      'WALLET_DISABLED',
    ),
  );
}

export async function GET() {
  return rejectLegacyRefunds();
}

export async function POST() {
  return rejectLegacyRefunds();
}

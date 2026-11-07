import { fail } from '@/lib/api';
import { AppError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rejectWalletTopUp() {
  return fail(
    new AppError(
      'Wallet top-ups are no longer available. Use the cafeteria order test checkout.',
      410,
      'WALLET_DISABLED',
    ),
  );
}

export async function GET() {
  return rejectWalletTopUp();
}

export async function POST() {
  return rejectWalletTopUp();
}

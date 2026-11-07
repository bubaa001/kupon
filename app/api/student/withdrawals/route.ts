import { AppError } from '@/lib/errors';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rejectWalletWithdrawal() {
  return fail(
    new AppError('Student wallet withdrawals are not part of Kupon checkout.', 410, 'WALLET_DISABLED'),
  );
}

export async function GET() {
  return rejectWalletWithdrawal();
}

export async function POST() {
  return rejectWalletWithdrawal();
}

import { badRequest } from '@/lib/errors';
import { fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rejectWalletWithdrawal() {
  try {
    throw badRequest('Student wallet withdrawals are not part of Kupon checkout.');
  } catch (error) {
    return fail(error);
  }
}

export async function GET() {
  return rejectWalletWithdrawal();
}

export async function POST() {
  return rejectWalletWithdrawal();
}

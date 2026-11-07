import { fail } from '@/lib/api';
import { badRequest } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rejectWalletTopUp() {
  try {
    throw badRequest(
      'Wallet top-ups are no longer available. Pay for each cafeteria order with mobile money at checkout.',
    );
  } catch (error) {
    return fail(error);
  }
}

export async function GET() {
  return rejectWalletTopUp();
}

export async function POST() {
  return rejectWalletTopUp();
}

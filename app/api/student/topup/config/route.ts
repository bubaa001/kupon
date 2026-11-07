import { ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Legacy wallet top-ups are disabled; checkout is order-specific. */
export async function GET() {
  await requireApiUser(['STUDENT']);
  return ok({ enabled: false, message: 'Wallet top-ups are not available.' });
}

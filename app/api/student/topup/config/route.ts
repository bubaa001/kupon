import { ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { isWhopEnabled } from '@/lib/payments/whop';
import { isAzamPayEnabled } from '@/lib/payments/azampay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tells the student top-up screen whether to use the Whop card checkout. */
export async function GET() {
  await requireApiUser(['STUDENT']);
  return ok({
    whopEnabled: isWhopEnabled(),
    azampayEnabled: isAzamPayEnabled(),
    preferredProvider: isAzamPayEnabled() ? 'azampay' : isWhopEnabled() ? 'whop' : 'mock',
  });
}

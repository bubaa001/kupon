import { ok } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = ok({ message: 'Signed out.' });
  return clearSessionCookie(response);
}

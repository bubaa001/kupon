import { fail, ok } from '@/lib/api';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      await prisma.user.updateMany({
        where: { id: session.uid, sessionVersion: session.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
    }
    const response = ok({ message: 'Signed out.' });
    return clearSessionCookie(response);
  } catch (error) {
    const response = fail(error);
    return clearSessionCookie(response);
  }
}

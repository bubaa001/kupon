import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ProfileView, type ProfileIdentity } from './_components/profile-view';

export const metadata: Metadata = {
  title: 'Wasifu',
  description: 'Taarifa zako za chuo, oda na usalama wa akaunti yako ya Google.',
};

export const dynamic = 'force-dynamic';

/**
 * Server shell for the student profile.
 *
 * The Google session facts (linked email, Google `sub`, last login) are read
 * from the database on the server — never from a client-supplied identity — and
 * passed to the client view. The layout already enforces the STUDENT role; this
 * guard keeps the page safe if it is ever rendered outside that layout.
 */
export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, googleId: true, lastLoginAt: true },
  });

  const identity: ProfileIdentity = {
    email: account?.email ?? null,
    googleLinked: Boolean(account?.googleId),
    lastLoginAt: account?.lastLoginAt?.toISOString() ?? null,
  };

  return <ProfileView identity={identity} />;
}

/* eslint-disable no-console */
/**
 * Link a Google email to an existing Kupon student wallet.
 *
 *   pnpm link:google +255712345678 you@gmail.com
 *
 * Use this when a student cannot receive SMS OTPs. After linking, they can use
 * "Continue with Google" on the login screen. The script only updates the
 * existing wallet; it never creates an account or moves money.
 */
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  throw new Error('Set DATABASE_URL and DIRECT_URL before linking a Google email.');
}

const prisma = new PrismaClient();

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+255')) return digits;
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  if (digits.startsWith('7') || digits.startsWith('6')) return `+255${digits}`;
  return digits;
}

async function main() {
  const [phoneArg, emailArg] = process.argv.slice(2);
  if (!phoneArg || !emailArg) {
    console.error('Usage: pnpm link:google +255712345678 student@university.ac.tz');
    process.exit(1);
  }

  const phone = normalizePhone(phoneArg);
  const email = emailArg.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('That does not look like a valid email address.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, name: true, role: true, email: true, universityId: true },
  });
  if (!user) {
    console.error(`No Kupon user found for ${phone}. Check the number and try again.`);
    process.exit(1);
  }
  if (user.role !== 'STUDENT') {
    console.error(`${phone} belongs to a ${user.role} account, not a student wallet.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email, googleId: null },
  });

  console.log(`Linked ${email} to ${user.name} (${phone}).`);
  console.log('The student can now choose "Continue with Google" on the login screen.');
}

main()
  .catch((error) => {
    console.error('Could not link the Google email:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

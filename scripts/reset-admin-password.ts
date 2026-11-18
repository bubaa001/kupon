/* eslint-disable no-console */
/**
 * Set a new password for a Kupon admin, Finance or staff account.
 *
 *   pnpm reset:password            (asks for the username, default "bubaa")
 *   pnpm reset:password bubaa
 *
 * The password is typed into the terminal and never shown, logged or sent
 * anywhere except as a bcrypt hash to the database. Every device signed in to
 * that account is signed out.
 *
 * Needs DATABASE_URL and DIRECT_URL (copy them from Vercel → Settings →
 * Environment Variables into a local .env file).
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE', 'STAFF'];
const MIN_LENGTH = 10;

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = '';
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          process.stdout.write('\nCancelled.\n');
          process.exit(1);
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) process.stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        process.stdout.write(hidden ? '*' : char);
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error('Set DATABASE_URL and DIRECT_URL first (see the note at the top of this script).');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const username = (process.argv[2] ?? (await ask('Username [bubaa]: '))).trim() || 'bubaa';
    const user = await prisma.user.findFirst({
      where: { username },
      select: { id: true, name: true, role: true },
    });
    if (!user) {
      console.error(`No account with the username "${username}".`);
      process.exit(1);
    }
    if (!ALLOWED_ROLES.includes(user.role)) {
      console.error(`"${username}" is a ${user.role} account; this script only resets admin, Finance and staff passwords.`);
      process.exit(1);
    }
    console.log(`Resetting the password for ${user.name} (${user.role}).`);

    const password = await ask(`New password (at least ${MIN_LENGTH} characters): `, true);
    if (password.length < MIN_LENGTH) {
      console.error(`Too short. Use at least ${MIN_LENGTH} characters.`);
      process.exit(1);
    }
    const again = await ask('Type it again: ', true);
    if (again !== password) {
      console.error('The two passwords do not match. Nothing was changed.');
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        sessionVersion: { increment: 1 },
      },
    });
    console.log(`Done. Sign in at /login with the username "${username}" and your new password.`);
    console.log('Every device that was signed in to this account has been signed out.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Could not reset the password:', error instanceof Error ? error.message : error);
  process.exit(1);
});

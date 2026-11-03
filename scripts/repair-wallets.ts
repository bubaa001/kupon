import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Backfill a Wallet for any StudentProfile that lost one. Idempotent. */
async function main() {
  const profiles = await prisma.studentProfile.findMany({
    where: { wallet: null },
    select: { id: true, studentId: true, walletBalance: true },
  });

  for (const profile of profiles) {
    await prisma.wallet.upsert({
      where: { studentId: profile.id },
      update: {},
      create: {
        studentId: profile.id,
        balance: profile.walletBalance,
        currency: 'TZS',
      },
    });
    console.log(`repaired wallet for ${profile.studentId}`);
  }

  console.log(`repair complete: ${profiles.length} wallet(s) created`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

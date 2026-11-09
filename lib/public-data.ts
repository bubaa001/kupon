import { prisma } from '@/lib/db';

export type LandingData = {
  liveTotalsAvailable: boolean;
  stats: {
    universities: number;
    vendors: number;
    students: number;
    mealSales: number;
  };
};

export async function getLandingData(): Promise<LandingData> {
  // A Vercel Preview can build without production database credentials. Keep
  // its public landing page usable and avoid presenting fake zero totals.
  if (process.env.VERCEL_ENV === 'preview' && !process.env.DATABASE_URL) {
    return {
      liveTotalsAvailable: false,
      stats: { universities: 0, vendors: 0, students: 0, mealSales: 0 },
    };
  }

  const [universities, vendors, students, servedMeals] = await Promise.all([
    prisma.university.count({ where: { status: 'ACTIVE' } }),
    prisma.vendor.count({ where: { status: 'ACTIVE' } }),
    prisma.studentProfile.count(),
    prisma.order.aggregate({
      where: { status: 'VERIFIED' },
      _sum: { total: true },
    }),
  ]);

  return {
    liveTotalsAvailable: true,
    stats: {
      universities,
      vendors,
      students,
      mealSales: servedMeals._sum.total ?? 0,
    },
  };
}

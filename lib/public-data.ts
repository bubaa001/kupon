import { prisma } from '@/lib/db';

export type LandingData = {
  stats: {
    universities: number;
    vendors: number;
    students: number;
    mealSales: number;
  };
};

export async function getLandingData(): Promise<LandingData> {
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
    stats: {
      universities,
      vendors,
      students,
      mealSales: servedMeals._sum.total ?? 0,
    },
  };
}

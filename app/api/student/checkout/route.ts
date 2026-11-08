import { prisma } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getStudentActiveOrders } from '../_lib/orders';
import { getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Small bootstrap payload for the scan-and-order screen. */
export async function GET() {
  try {
    const { user, student } = await getStudentContext();
    const [ordersResult, vendorsResult] = await Promise.allSettled([
      getStudentActiveOrders(student.id, user.id),
      prisma.vendor.findMany({
        where: { universityId: user.universityId ?? '', status: 'ACTIVE' },
        select: { id: true, code: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    if (ordersResult.status === 'rejected') throw ordersResult.reason;

    return ok({
      student: {
        name: user.name,
        studentId: student.studentId,
        course: student.course,
        year: student.year,
        phone: user.phone,
        university: {
          name: user.university?.name ?? '',
          code: user.university?.code ?? '',
        },
      },
      orders: ordersResult.value,
      vendors: vendorsResult.status === 'fulfilled' ? vendorsResult.value : [],
      vendorLoadError: vendorsResult.status === 'rejected',
    });
  } catch (error) {
    return fail(error);
  }
}

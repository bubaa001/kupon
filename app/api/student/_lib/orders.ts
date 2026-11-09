import { prisma } from '@/lib/db';
import { signCouponToken } from '@/lib/orders/coupon';
import { orderInclude, serializeOrder } from '@/lib/orders/serialize';
import type { OrderView } from '@/lib/orders/types';
import { processKuponTestGatewayPayments } from '@/lib/payments/kupon-test-gateway';

export async function getStudentActiveOrders(studentId: string): Promise<OrderView[]> {
  await processKuponTestGatewayPayments({ studentId });

  const orders = await prisma.order.findMany({
    where: {
      studentId,
      status: {
        in: ['PAYMENT_PENDING', 'AWAITING_ACCEPTANCE', 'AWAITING_PAYMENT', 'PENDING'],
      },
      OR: [
        { status: 'PAYMENT_PENDING' },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return Promise.all(
    orders.map(async (order) => {
      const couponToken =
        order.status === 'PENDING'
          ? await signCouponToken(
              {
                orderId: order.id,
                couponCode: order.couponCode,
                vendorId: order.vendorId,
                universityId: order.universityId,
                studentId: order.studentId,
              },
              order.expiresAt,
            )
          : null;
      return serializeOrder(order, couponToken);
    }),
  );
}

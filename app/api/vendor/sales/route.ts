import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, searchParams } from '@/lib/api';
import { requireVendorAccess } from '../_lib/access';
import {
  aggregateTopItems,
  emojiLookup,
  netAmountFor,
  paymentSelect,
  platformFeeFor,
  parseVendorRange,
  rangeBounds,
  saleRow,
  studentSummarySelect,
} from '../_lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rangeQuerySchema = z.enum(['today', 'week', 'month']).catch('today');

/**
 * GET /api/vendor/sales?range=today|week|month
 * Sales ledger for the selected window: summary, fee breakdown, top sellers and
 * every payment row (settled, pending and failed) so the vendor can reconcile
 * the till.
 */
export async function GET(request: Request) {
  try {
    const { vendor, universityId } = await requireVendorAccess();

    const range = parseVendorRange(rangeQuerySchema.parse(searchParams(request).get('range')));
    const { start, end, label } = rangeBounds(range);

    const [payments, menuItems] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          vendorId: vendor.id,
          universityId,
          type: 'PAYMENT',
          createdAt: { gte: start, lte: end },
        },
        select: { ...paymentSelect, student: { select: studentSummarySelect } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.menuItem.findMany({
        where: { vendorId: vendor.id },
        select: { name: true, emoji: true },
      }),
    ]);

    const settled = payments.filter((payment) => payment.status === 'SETTLED');
    const gross = settled.reduce((sum, payment) => sum + payment.amount, 0);
    const netSettlement = settled.reduce((sum, payment) => sum + netAmountFor(payment), 0);
    const fees = settled.reduce((sum, payment) => sum + platformFeeFor(payment), 0);

    return ok({
      range,
      rangeLabel: label,
      summary: {
        gross,
        transactions: settled.length,
        average: settled.length ? Math.round(gross / settled.length) : 0,
        netSettlement,
        fees,
      },
      topItems: aggregateTopItems(settled, emojiLookup(menuItems), 5),
      payments: payments.map(saleRow),
      counts: {
        total: payments.length,
        settled: settled.length,
        pending: payments.filter((payment) => payment.status === 'PENDING').length,
        failed: payments.filter((payment) => payment.status === 'FAILED').length,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

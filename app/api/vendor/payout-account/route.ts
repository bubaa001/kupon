import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { formatPayoutAccount, parsePayoutAccount, payoutAccountSchema } from '@/lib/payouts/payout-account';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET/PUT where this cafeteria's withdrawals are sent. Owner only. */
export async function GET() {
  try {
    const { vendor } = await requireVendorAccess();
    const record = await prisma.vendor.findUnique({
      where: { id: vendor.id },
      select: { settlementAccount: true },
    });
    const account = parsePayoutAccount(record?.settlementAccount);
    return ok({
      account,
      label: formatPayoutAccount(record?.settlementAccount),
      ready: account !== null,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();
    const limit = await rateLimit(`vendor:payout-account:${vendor.id}`, 10, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many changes. Try again later.');
    const account = await parseJson(request, payoutAccountSchema);
    const stored = JSON.stringify(account);
    await prisma.vendor.update({ where: { id: vendor.id }, data: { settlementAccount: stored } });
    // Changing where money goes is sensitive: always audit it (without the full number).
    await auditLog({
      actorId: user.id,
      universityId,
      action: 'VENDOR_PAYOUT_ACCOUNT_CHANGED',
      entity: 'Vendor',
      entityId: vendor.id,
      metadata: { method: account.method, label: formatPayoutAccount(stored) },
    });
    return ok({ account, label: formatPayoutAccount(stored), ready: true });
  } catch (error) {
    return fail(error);
  }
}

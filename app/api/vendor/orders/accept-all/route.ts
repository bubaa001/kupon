import { fail, ok } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { acceptAllOrderRequests } from '@/lib/orders/accept-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');
    return ok(
      await acceptAllOrderRequests({
        vendorId: vendor.id,
        universityId: user.universityId,
        actorId: user.id,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

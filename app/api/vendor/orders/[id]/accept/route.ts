import { fail, ok } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { acceptOrderRequest } from '@/lib/orders/accept-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);
    if (!user.universityId) throw forbidden('Vendor is not linked to a university.');
    const order = await acceptOrderRequest({
      orderId: params.id,
      vendorId: vendor.id,
      universityId: user.universityId,
      actorId: user.id,
    });
    return ok({ order });
  } catch (error) {
    return fail(error);
  }
}

import { fail, ok } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { forbidden, notFound } from '@/lib/errors';
import { vendorQrValue } from '@/lib/orders/qr-payload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the short counter QR that students scan to open this vendor's menu.
 * The QR contains only the public vendor code, no student data and no signing
 * secret; ordering still requires an authenticated student and an available
 * menu. Legacy signed JWTs remain accepted by the scan endpoint.
 */
export async function GET() {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);
    if (!user.universityId || !user.university) {
      throw forbidden('Vendor account is not linked to a university.');
    }

    const vendorRecord = await prisma.vendor.findUnique({
      where: { id: vendor.id },
      select: { description: true },
    });
    if (!vendorRecord) throw notFound('Vendor not found.');

    // Short pointer, not a JWT: a 20-character QR is much easier for a phone
    // camera to resolve than a 250+ character signed token.
    const payload = vendorQrValue(vendor.code);

    return ok({
      payload,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        code: vendor.code,
        description: vendorRecord.description,
      },
      university: { name: user.university.name, code: user.university.code },
      menuHint: 'Scan to see today’s menu. Checkout is simulated in this build; no money moves.',
    });
  } catch (error) {
    return fail(error);
  }
}

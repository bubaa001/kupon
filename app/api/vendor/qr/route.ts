import { fail, ok } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
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
    const user = await requireApiUser(['VENDOR']);
    if (!user.vendor || !user.universityId || !user.university) {
      throw forbidden('Vendor account is not linked to a university.');
    }
    if (user.vendor.status !== 'ACTIVE') throw forbidden('Vendor account is suspended.');

    const vendorRecord = await prisma.vendor.findUnique({
      where: { id: user.vendor.id },
      select: { description: true },
    });
    if (!vendorRecord) throw notFound('Vendor not found.');

    // Short pointer, not a JWT: a 20-character QR is much easier for a phone
    // camera to resolve than a 250+ character signed token.
    const payload = vendorQrValue(user.vendor.code);

    return ok({
      payload,
      vendor: {
        id: user.vendor.id,
        name: user.vendor.name,
        code: user.vendor.code,
        description: vendorRecord.description,
      },
      university: { name: user.university.name, code: user.university.code },
      menuHint: 'Scan to see today’s approved menu and pay from your wallet.',
    });
  } catch (error) {
    return fail(error);
  }
}

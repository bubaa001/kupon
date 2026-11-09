import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { verifyVendorQr } from '@/lib/orders/coupon';
import { parseVendorQr } from '@/lib/orders/qr-payload';
import { vendorMenuScanSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/student/vendor-scan
 *
 * The new flow is student-scans-vendor. The student scans the compact counter
 * QR (`KPN:V:<code>`) or a legacy signed QR, or types the vendor code. The
 * server resolves the vendor inside the student's own university and returns
 * the approved, available menu. No money moves here.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    if (!user.universityId || !user.university) {
      throw forbidden('Your student profile is not linked to a university.');
    }

    const limit = await rateLimit(`student:vendor-scan:${student.id}`, 30, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many menu scans. Wait a minute and try again.');
    }

    const body = await parseJson(request, vendorMenuScanSchema);

    let vendorId: string;
    let tokenUniversityId: string | null = null;
    const compactCode = body.token ? parseVendorQr(body.token) : null;

    if (compactCode) {
      const vendorByCode = await prisma.vendor.findUnique({
        where: { code: compactCode },
        select: { id: true },
      });
      if (!vendorByCode) throw notFound('Vendor code not found. Check the code and try again.');
      vendorId = vendorByCode.id;
    } else if (body.token) {
      const payload = await verifyVendorQr(body.token);
      vendorId = payload.vendorId;
      tokenUniversityId = payload.universityId;
    } else {
      const vendorByCode = await prisma.vendor.findUnique({
        where: { code: body.code! },
        select: { id: true },
      });
      if (!vendorByCode) throw notFound('Vendor code not found. Check the code and try again.');
      vendorId = vendorByCode.id;
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        university: { select: { id: true, name: true, code: true, status: true } },
      },
    });
    if (!vendor) throw notFound('This vendor is no longer on Kupon.');
    if (tokenUniversityId && tokenUniversityId !== vendor.universityId) {
      throw forbidden('This vendor QR is not valid for this campus.');
    }
    if (vendor.universityId !== user.universityId) {
      throw forbidden('You can only order from vendors at your own university.');
    }
    if (vendor.status !== 'ACTIVE' || vendor.university.status !== 'ACTIVE') {
      throw notFound('This vendor is not accepting orders right now.');
    }

    const items = await prisma.menuItem.findMany({
      where: {
        vendorId: vendor.id,
        universityId: user.universityId,
        approvalStatus: 'APPROVED',
        available: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        emoji: true,
        imageUrl: true,
        available: true,
      },
    });

    const cafeteriaCredit = await prisma.cafeteriaCredit.findUnique({
      where: {
        studentId_vendorId_isTest: {
          studentId: student.id,
          vendorId: vendor.id,
          isTest: true,
        },
      },
      select: { balance: true },
    });

    return ok({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        code: vendor.code,
        description: vendor.description,
        universityId: vendor.universityId,
        universityName: vendor.university.name,
      },
      student: {
        name: user.name,
        studentId: student.studentId,
        cafeteriaCreditBalance: cafeteriaCredit?.balance ?? 0,
      },
      items,
    });
  } catch (error) {
    return fail(error);
  }
}

import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { cafeteriaHoursSchema, formatHours, isCafeteriaOpen } from '@/lib/cafeteria-hours';
import { prisma } from '@/lib/db';
import { forbidden, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function cafeteria() {
  const user = await requireApiUser(['VENDOR', 'STAFF']);
  const vendor = requireOperationalVendor(user);
  if (!user.universityId) throw forbidden('Your account is not linked to a university.');
  return { user, vendorId: vendor.id, universityId: user.universityId };
}

function view(hours: { openTime: string | null; closeTime: string | null }) {
  return { ...hours, label: formatHours(hours), openNow: isCafeteriaOpen(hours) };
}

/** GET/PUT the cafeteria's opening hours. Owner and counter staff. */
export async function GET() {
  try {
    const { vendorId } = await cafeteria();
    const hours = await prisma.vendor.findUniqueOrThrow({
      where: { id: vendorId },
      select: { openTime: true, closeTime: true },
    });
    return ok(view(hours));
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, vendorId, universityId } = await cafeteria();
    const limit = await rateLimit(`cafeteria:hours:${vendorId}`, 20, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many changes. Try again later.');
    const hours = await parseJson(request, cafeteriaHoursSchema);
    await prisma.vendor.update({ where: { id: vendorId }, data: hours });
    await auditLog({
      actorId: user.id,
      universityId,
      action: 'CAFETERIA_HOURS_CHANGED',
      entity: 'Vendor',
      entityId: vendorId,
      metadata: hours,
    });
    return ok(view(hours));
  } catch (error) {
    return fail(error);
  }
}

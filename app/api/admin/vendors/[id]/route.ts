import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { auditLog } from '@/lib/audit';
import { forbidden, notFound } from '@/lib/errors';
import { vendorStatusSchema } from '@/lib/validators';
import { tenantWhere } from '@/lib/tenant';
import { requireAdmin } from '../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAdmin();
    const body = await parseJson(request, vendorStatusSchema);

    // tenantWhere() inside findFirst: a cross-tenant id simply does not exist.
    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id, ...tenantWhere(user) },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!vendor) throw notFound('Vendor not found in your university.');
    if (vendor.status === 'PENDING' || body.status === 'PENDING') {
      throw forbidden('Pending cafeteria applications can only be reviewed by a platform admin.');
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { status: body.status },
      include: { user: { select: { name: true, phone: true } } },
    });

    const action = body.status === 'SUSPENDED' ? 'VENDOR_SUSPENDED' : 'VENDOR_REACTIVATED';

    await auditLog({
      actorId: user.id,
      universityId: vendor.universityId,
      action,
      entity: 'Vendor',
      entityId: vendor.id,
      metadata: {
        code: vendor.code,
        name: vendor.name,
        previousStatus: vendor.status,
        status: body.status,
      },
    });

    return ok({
      vendor: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        status: updated.status,
        ownerName: updated.user.name,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

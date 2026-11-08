import { fail, ok } from '@/lib/api';
import { requireApiUser, requireManagedVendor } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser(['STAFF']);
    const vendor = requireManagedVendor(user);
    const items = await prisma.menuItem.findMany({
      where: { vendorId: vendor.id },
      select: { id: true, name: true, category: true, emoji: true, available: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

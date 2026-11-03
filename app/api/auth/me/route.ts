import { fail, ok } from '@/lib/api';
import { requireApiUser, roleHome } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser();
    return ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        university: user.university,
        student: user.student,
        vendor: user.vendor,
        home: roleHome(user.role),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

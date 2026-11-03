import { randomUUID } from 'node:crypto';
import { requireApiUser, requireVendor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { badRequest } from '@/lib/errors';
import { fail, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/vendor/menu/upload
 *
 * Vendor-owned food photos are stored in PostgreSQL so uploads persist across
 * serverless deployments.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR']);
    const vendor = requireVendor(user);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw badRequest('Upload a photo as multipart form data.');
    }

    const entry = formData.get('file');
    if (!(entry instanceof File)) {
      throw badRequest('Choose a photo to upload.');
    }
    const ext = ALLOWED_TYPES[entry.type];
    if (!ext) {
      throw badRequest('Use a JPG, PNG or WebP photo.');
    }
    if (entry.size <= 0 || entry.size > MAX_BYTES) {
      throw badRequest('Keep the photo under 5 MB.');
    }

    const filename = `${vendor.id}-${randomUUID()}.${ext}`;
    const data = Buffer.from(await entry.arrayBuffer());
    await prisma.storedFile.create({
      data: {
        key: filename,
        contentType: entry.type,
        data,
        size: data.byteLength,
      },
    });

    return ok({
      url: `/api/uploads/food/${filename}`,
      size: entry.size,
      type: entry.type,
    });
  } catch (error) {
    return fail(error);
  }
}

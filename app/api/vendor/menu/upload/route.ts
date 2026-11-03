import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireApiUser, requireVendor } from '@/lib/auth';
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
 * Vendor-owned food photo upload. The file is stored under
 * public/uploads/food/<vendor-id>-<uuid>.<ext> and served through
 * /api/uploads/food/<filename> because Next.js production does not serve files
 * added to public/ after build. For serverless production, swap this for
 * S3/R2/Cloudinary; the menu contract only needs the returned URL.
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

    const directory = path.join(process.cwd(), 'public', 'uploads', 'food');
    await mkdir(directory, { recursive: true });
    const filename = `${vendor.id}-${randomUUID()}.${ext}`;
    await writeFile(path.join(directory, filename), Buffer.from(await entry.arrayBuffer()));

    return ok({
      url: `/api/uploads/food/${filename}`,
      size: entry.size,
      type: entry.type,
    });
  } catch (error) {
    return fail(error);
  }
}

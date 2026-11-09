import { randomUUID } from 'node:crypto';
import { requireApiUser, requireOperationalVendor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppError, badRequest } from '@/lib/errors';
import { fail, ok } from '@/lib/api';
import { isSafeImageUpload } from '@/lib/uploads/file-validation';

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
 * Cafeteria food photos are scoped to the signed-in vendor or its staff and
 * stored in PostgreSQL so uploads persist across serverless deployments.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(['VENDOR', 'STAFF']);
    const vendor = requireOperationalVendor(user);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES + 64 * 1024) {
      throw new AppError('Keep the photo under 5 MB.', 413, 'FILE_TOO_LARGE');
    }

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
    if (!Object.hasOwn(ALLOWED_TYPES, entry.type)) {
      throw badRequest('Use a JPG, PNG or WebP photo.');
    }
    if (entry.size <= 0 || entry.size > MAX_BYTES) {
      throw badRequest('Keep the photo under 5 MB.');
    }

    const data = Buffer.from(await entry.arrayBuffer());
    if (!isSafeImageUpload(data, entry.type)) {
      throw new AppError('The photo content does not match its file type.', 400, 'INVALID_IMAGE');
    }
    const ext = ALLOWED_TYPES[entry.type];
    const filename = `${vendor.id}-${randomUUID()}.${ext}`;
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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isSafeImageUpload } from '@/lib/uploads/file-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Serves vendor-uploaded food photos persisted in PostgreSQL.
 */
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const filename = params.filename;
  const foodImageKeyPattern =
    /^[A-Za-z0-9]{1,64}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;
  if (!foodImageKeyPattern.test(filename)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[filename.split('.').pop()?.toLowerCase() ?? ''];
  if (!contentType) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const file = await prisma.storedFile.findUnique({
      where: { key: filename },
      select: { contentType: true, data: true, size: true },
    });
    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = Buffer.from(file.data);
    if (
      file.contentType !== contentType ||
      file.size !== data.byteLength ||
      data.byteLength === 0 ||
      data.byteLength > 5 * 1024 * 1024 ||
      !isSafeImageUpload(data, contentType)
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-site',
      },
    });
  } catch (error) {
    console.error('[uploads] Failed to load stored food photo:', error);
    return NextResponse.json({ error: 'Unable to load photo' }, { status: 500 });
  }
}

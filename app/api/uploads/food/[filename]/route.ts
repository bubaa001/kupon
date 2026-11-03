import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
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

    return new NextResponse(Buffer.from(file.data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[uploads] Failed to load stored food photo:', error);
    return NextResponse.json({ error: 'Unable to load photo' }, { status: 500 });
  }
}

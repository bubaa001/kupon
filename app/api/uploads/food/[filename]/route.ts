import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Serves vendor-uploaded food photos written after the Next.js build.
 *
 * Files added to `public/` at runtime are not in Next's production static
 * manifest, so `/uploads/food/<file>` 404s with `next start`. This route reads
 * the file from disk and streams it with an immutable cache header. Replace the
 * directory read with S3/R2 in production.
 */
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const filename = params.filename;
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'uploads', 'food', filename));
    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

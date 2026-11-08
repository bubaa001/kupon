import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import { prisma } from '@/lib/db';
import { notFound } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOCUMENT_TYPES: Record<string, { extension: string }> = {
  'application/pdf': { extension: 'pdf' },
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    const application = await prisma.vendorApplication.findUnique({
      where: { id: params.id },
      select: { tinDocumentKey: true },
    });
    if (!application?.tinDocumentKey) throw notFound('TIN/TRA document not found.');

    const file = await prisma.storedFile.findUnique({
      where: { key: application.tinDocumentKey },
      select: { contentType: true, data: true },
    });
    if (!file) throw notFound('TIN/TRA document not found.');
    const type = DOCUMENT_TYPES[file.contentType];
    if (!type) throw notFound('TIN/TRA document not found.');

    return new NextResponse(Buffer.from(file.data), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="vendor-tin-document.${type.extension}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return fail(error);
  }
}

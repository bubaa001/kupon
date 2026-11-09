import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '@/lib/errors';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErrorBody = {
  ok: false;
  error: { message: string; code: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error.message, code: error.code, details: error.details },
      },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: 'Some details need fixing.',
          code: 'VALIDATION_ERROR',
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  // Never leak stack traces or Prisma internals to the client.
  console.error('[api] Unhandled error:', error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: 'Something went wrong on our side. Please try again.',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 },
  );
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const maxBytes = 256 * 1024;
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AppError('Request body is too large.', 413, 'BODY_TOO_LARGE');
  }

  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError('Request body is too large.', 413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Request body could not be read.', 400, 'INVALID_JSON');
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
  return schema.parse(body);
}

export function searchParams(request: Request) {
  return new URL(request.url).searchParams;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'local';
}

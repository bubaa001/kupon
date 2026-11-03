import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { externalUrl } from '@/lib/request-origin';
import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  getGoogleConfig,
  resolveGoogleRedirectUri,
  type GoogleStatePayload,
} from '@/lib/google-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function loginError(request: Request, code: string) {
  const url = externalUrl(request, '/login');
  url.searchParams.set('error', code);
  url.searchParams.set('role', 'student');
  return NextResponse.redirect(url);
}

/** Starts Google OAuth. The student's selected university is bound into state. */
export async function GET(request: Request) {
  const config = getGoogleConfig();
  if (!config) return loginError(request, 'google_not_configured');

  const requestUrl = new URL(request.url);
  const requestedUniversityId = requestUrl.searchParams.get('universityId');
  if (!requestedUniversityId) {
    return loginError(request, 'google_university');
  }
  const requestedRole = requestUrl.searchParams.get('role') === 'vendor' ? 'vendor' : 'student';

  const canonical = new URL(env.NEXT_PUBLIC_APP_URL);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost ?? request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    requestUrl.protocol.replace(':', '');
  const actualOrigin = host ? `${proto}://${host}` : requestUrl.origin;
  const { redirectUri, matchedMobile } = resolveGoogleRedirectUri(config, actualOrigin);
  const userAgent = request.headers.get('user-agent') ?? '';
  const isMobileRequest = /android|iphone|ipad|ipod|mobile/i.test(userAgent);

  // A phone sometimes starts the flow from a localhost page (an old bookmark,
  // adb reverse or a desktop page mirrored to mobile). Google would redirect the
  // callback to localhost, which is the phone itself. Move the whole OAuth
  // handshake to the registered HTTPS mobile origin before any state cookie is
  // written, so the callback always lands on the reachable tunnel.
  if (isMobileRequest && config.mobileRedirectUri && !matchedMobile) {
    const mobile = new URL(config.mobileRedirectUri);
    if (actualOrigin !== mobile.origin) {
      const bounce = new URL('/api/auth/google/start', mobile.origin);
      bounce.searchParams.set('universityId', requestedUniversityId);
      bounce.searchParams.set('role', requestedRole);
      return NextResponse.redirect(bounce);
    }
  }

  // Desktop canonicalization: 127.0.0.1 and other aliases move to the registered
  // localhost origin so the state cookie and callback live on one host. A phone
  // cannot reach the laptop's localhost, so when the request comes from the
  // configured public tunnel origin we keep that origin and use its registered
  // HTTPS callback instead.
  if (!matchedMobile && actualOrigin !== canonical.origin) {
    const actual = new URL(actualOrigin);
    const isLoopback = actual.hostname === 'localhost' || actual.hostname === '127.0.0.1';
    // A phone on the LAN cannot complete OAuth against the laptop's localhost.
    // If a public HTTPS mobile callback is configured, move the whole OAuth
    // handshake to that reachable origin instead of bouncing to localhost.
    if (!isLoopback && config.mobileRedirectUri) {
      const mobile = new URL(config.mobileRedirectUri);
      const bounce = new URL('/api/auth/google/start', mobile.origin);
      bounce.searchParams.set('universityId', requestedUniversityId);
      bounce.searchParams.set('role', requestedRole);
      return NextResponse.redirect(bounce);
    }
    const bounce = new URL('/api/auth/google/start', canonical);
    bounce.searchParams.set('universityId', requestedUniversityId);
    bounce.searchParams.set('role', requestedRole);
    return NextResponse.redirect(bounce);
  }

  const university = await prisma.university.findUnique({
    where: { id: requestedUniversityId },
    select: { id: true, status: true },
  });
  if (!university || university.status !== 'ACTIVE') {
    return loginError(request, 'google_university');
  }

  const state = randomBytes(24).toString('base64url');
  const payload: GoogleStatePayload = {
    state,
    universityId: university.id,
    role: requestedRole,
    createdAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const response = NextResponse.redirect(buildGoogleAuthUrl(config, state, redirectUri));
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: encoded,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}

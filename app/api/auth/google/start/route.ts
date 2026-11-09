import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { externalUrl, getExternalOrigin } from '@/lib/request-origin';
import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  getGoogleConfig,
  resolveGoogleRedirectUri,
  type GoogleStatePayload,
} from '@/lib/google-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function loginError(request: Request, code: string, role: 'student' | 'vendor' | 'staff' = 'student') {
  const destination =
    role === 'staff' ? '/staff/login' : role === 'vendor' ? '/vendor/login' : '/login';
  const url = externalUrl(request, destination);
  url.searchParams.set('error', code);
  url.searchParams.set('role', role);
  return NextResponse.redirect(url);
}

/** Starts Google OAuth. The student's selected university is bound into state. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedRole = requestUrl.searchParams.get('role');
  const role =
    requestedRole === 'vendor' ? 'vendor' : requestedRole === 'staff' ? 'staff' : 'student';
  const config = getGoogleConfig();
  if (!config) return loginError(request, 'google_not_configured', role);

  const requestedUniversityId = requestUrl.searchParams.get('universityId') ?? '';
  if (role === 'student' && !requestedUniversityId) {
    return loginError(request, 'google_university', role);
  }

  const canonical = new URL(env.NEXT_PUBLIC_APP_URL);
  const actualOrigin = getExternalOrigin(request);
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
      if (requestedUniversityId) bounce.searchParams.set('universityId', requestedUniversityId);
      bounce.searchParams.set('role', role);
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
      if (requestedUniversityId) bounce.searchParams.set('universityId', requestedUniversityId);
      bounce.searchParams.set('role', role);
      return NextResponse.redirect(bounce);
    }
    const bounce = new URL('/api/auth/google/start', canonical);
    if (requestedUniversityId) bounce.searchParams.set('universityId', requestedUniversityId);
    bounce.searchParams.set('role', role);
    return NextResponse.redirect(bounce);
  }

  let universityId = '';
  if (requestedUniversityId) {
    const university = await prisma.university.findUnique({
      where: { id: requestedUniversityId },
      select: { id: true, status: true },
    });
    if (!university || university.status !== 'ACTIVE') {
      return loginError(request, 'google_university', role);
    }
    universityId = university.id;
  }

  const state = randomBytes(24).toString('base64url');
  const payload: GoogleStatePayload = {
    state,
    universityId,
    role,
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

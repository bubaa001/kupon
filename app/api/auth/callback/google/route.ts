import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  GOOGLE_STATE_COOKIE,
  exchangeGoogleCode,
  fetchGoogleProfile,
  getGoogleConfig,
  resolveGoogleRedirectUri,
} from '@/lib/google-auth';
import { signSession, setSessionCookie } from '@/lib/auth';
import { externalUrl } from '@/lib/request-origin';
import {
  GOOGLE_SIGNUP_COOKIE,
  GOOGLE_SIGNUP_MAX_AGE,
  GOOGLE_VENDOR_COOKIE,
  signGoogleSignupTicket,
  signGoogleVendorTicket,
} from '@/lib/google-signup';
import type { GoogleStatePayload } from '@/lib/google-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function loginError(request: NextRequest, code: string, role: 'student' | 'vendor' = 'student') {
  const url = externalUrl(request, '/login');
  url.searchParams.set('error', code);
  url.searchParams.set('role', role);
  return NextResponse.redirect(url);
}

function clearState(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/**
 * Google OAuth callback.
 *
 * - A matching Google identity signs straight into its existing wallet.
 * - A verified Google identity with no wallet is redirected to the signup form,
 *   where the student supplies their phone and student number. The signed
 *   HttpOnly ticket proves the Google identity, so the signup page cannot be
 *   used to create accounts without Google consent.
 *
 * We never attach a Google account to an existing wallet from this callback;
 * that still requires an admin link, an invite, or the student already being
 * signed in. This prevents an attacker from claiming a funded wallet by
 * guessing an email address.
 */
export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config) return clearState(loginError(request, 'google_not_configured'));

  const params = request.nextUrl.searchParams;
  const oauthError = params.get('error');
  const code = params.get('code');
  const returnedState = params.get('state');
  const rawState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (oauthError) {
    return clearState(
      loginError(request, oauthError === 'access_denied' ? 'google_denied' : 'google_exchange'),
    );
  }
  if (!code || !returnedState || !rawState) {
    return clearState(loginError(request, 'google_state'));
  }

  let state: GoogleStatePayload;
  try {
    state = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) as GoogleStatePayload;
  } catch {
    return clearState(loginError(request, 'google_state'));
  }

  if (
    state.state !== returnedState ||
    (state.role !== 'student' && state.role !== 'vendor') ||
    !state.createdAt ||
    Date.now() - state.createdAt > 10 * 60 * 1000
  ) {
    return clearState(loginError(request, 'google_state'));
  }

  try {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost ?? request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
      request.nextUrl.protocol.replace(':', '');
    const callbackOrigin = host ? `${proto}://${host}` : request.nextUrl.origin;
    const { redirectUri } = resolveGoogleRedirectUri(config, callbackOrigin);

    const accessToken = await exchangeGoogleCode(config, code, redirectUri);
    const profile = await fetchGoogleProfile(accessToken);

    if (!profile.emailVerified) {
      return clearState(loginError(request, 'google_unverified'));
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: profile.email }, { googleId: profile.sub }],
      },
      include: {
        university: { select: { id: true, name: true, code: true, status: true } },
        student: { select: { id: true } },
        vendor: { select: { id: true, name: true, code: true, status: true } },
      },
    });

    if (!user) {
      const university = await prisma.university.findUnique({
        where: { id: state.universityId },
        select: { id: true, status: true },
      });
      if (!university || university.status !== 'ACTIVE') {
        return clearState(loginError(request, 'google_university', state.role));
      }

      const ticket = {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        universityId: university.id,
        emailVerified: true as const,
      };
      const isVendor = state.role === 'vendor';
      const signed = isVendor
        ? await signGoogleVendorTicket(ticket)
        : await signGoogleSignupTicket(ticket);
      const signupResponse = NextResponse.redirect(
        externalUrl(request, isVendor ? '/vendor-apply' : '/signup/google'),
      );
      signupResponse.cookies.set({
        name: isVendor ? GOOGLE_VENDOR_COOKIE : GOOGLE_SIGNUP_COOKIE,
        value: signed,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: GOOGLE_SIGNUP_MAX_AGE,
      });
      return clearState(signupResponse);
    }

    if (!user.university || user.university.status !== 'ACTIVE') {
      return clearState(loginError(request, 'google_suspended'));
    }
    // Never silently replace a Google identity that is already linked.
    if (user.googleId && user.googleId !== profile.sub) {
      return clearState(loginError(request, 'google_conflict'));
    }
    // If the account was matched by Google ID but the email changed, keep the
    // freshest verified email.
    if (user.email && user.email !== profile.email && !user.googleId) {
      const emailOwner = await prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true },
      });
      if (emailOwner && emailOwner.id !== user.id) {
        return clearState(loginError(request, 'google_conflict'));
      }
    }

    if (state.role === 'vendor') {
      if (user.role !== 'VENDOR') {
        return clearState(loginError(request, 'google_role_conflict', 'vendor'));
      }
      if (!user.vendor) {
        return clearState(loginError(request, 'google_vendor_missing', 'vendor'));
      }
      if (user.vendor.status === 'SUSPENDED') {
        return clearState(loginError(request, 'google_vendor_suspended', 'vendor'));
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? profile.sub,
          email: profile.email,
          lastLoginAt: new Date(),
        },
      });

      const token = await signSession({
        uid: user.id,
        role: 'VENDOR',
        universityId: user.universityId,
        name: user.name,
        phone: user.phone,
      });
      const response = NextResponse.redirect(
        externalUrl(request, user.vendor.status === 'PENDING' ? '/vendor-pending' : '/vendor'),
      );
      setSessionCookie(response, token);
      return clearState(response);
    }

    if (user.role !== 'STUDENT') {
      return clearState(loginError(request, 'google_role_conflict'));
    }
    if (!user.student) {
      return clearState(loginError(request, 'google_student_only'));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? profile.sub,
        email: profile.email,
        lastLoginAt: new Date(),
      },
    });

    const token = await signSession({
      uid: user.id,
      role: 'STUDENT',
      universityId: user.universityId,
      name: user.name,
      phone: user.phone,
    });

    const response = NextResponse.redirect(externalUrl(request, '/student'));
    setSessionCookie(response, token);
    return clearState(response);
  } catch (error) {
    console.error('[google-auth] callback failed', error);
    return clearState(loginError(request, 'google_exchange'));
  }
}

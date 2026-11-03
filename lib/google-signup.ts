import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * Short-lived bridge between Google OAuth and the signup form.
 *
 * Google proves the email/name, but we do not create a wallet inside the OAuth
 * callback. The signed ticket is an HttpOnly cookie that lets the signup page
 * collect the campus identity fields (phone, student number) before a wallet is
 * written. It cannot be edited by the browser because it is signed server-side.
 */
export const GOOGLE_SIGNUP_COOKIE = 'kupon_google_signup';
export const GOOGLE_VENDOR_COOKIE = 'kupon_google_vendor';
export const GOOGLE_SIGNUP_MAX_AGE = 15 * 60;

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type GoogleSignupTicket = {
  sub: string;
  email: string;
  name: string;
  universityId: string;
  emailVerified: true;
};

export async function signGoogleSignupTicket(ticket: GoogleSignupTicket): Promise<string> {
  return new SignJWT({
    email: ticket.email,
    name: ticket.name,
    universityId: ticket.universityId,
    emailVerified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ticket.sub)
    .setIssuer('kupon-google-signup')
    .setAudience('kupon-signup')
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_SIGNUP_MAX_AGE}s`)
    .sign(secret);
}

export type GoogleVendorTicket = GoogleSignupTicket;

export async function signGoogleVendorTicket(ticket: GoogleVendorTicket): Promise<string> {
  return new SignJWT({
    email: ticket.email,
    name: ticket.name,
    universityId: ticket.universityId,
    emailVerified: true,
    kind: 'vendor',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ticket.sub)
    .setIssuer('kupon-google-vendor')
    .setAudience('kupon-vendor-apply')
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_SIGNUP_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyGoogleVendorTicket(
  token: string | undefined,
): Promise<GoogleVendorTicket | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'kupon-google-vendor',
      audience: 'kupon-vendor-apply',
      algorithms: ['HS256'],
    });
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.universityId !== 'string'
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      universityId: payload.universityId,
      emailVerified: true,
    };
  } catch {
    return null;
  }
}

export async function verifyGoogleSignupTicket(
  token: string | undefined,
): Promise<GoogleSignupTicket | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'kupon-google-signup',
      audience: 'kupon-signup',
      algorithms: ['HS256'],
    });
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.universityId !== 'string'
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      universityId: payload.universityId,
      emailVerified: true,
    };
  } catch {
    return null;
  }
}

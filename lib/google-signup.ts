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
export const GOOGLE_VENDOR_ACTIVATION_COOKIE = 'kupon_google_vendor_activation';
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

export type GoogleVendorActivationTicket = {
  sub: string;
  email: string;
  name: string;
  applicationId: string;
};

export async function signGoogleVendorActivationTicket(
  ticket: GoogleVendorActivationTicket,
): Promise<string> {
  return new SignJWT({
    email: ticket.email,
    name: ticket.name,
    applicationId: ticket.applicationId,
    emailVerified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ticket.sub)
    .setIssuer('kupon-google-vendor-activation')
    .setAudience('kupon-vendor-activation')
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_SIGNUP_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyGoogleVendorActivationTicket(
  token: string | undefined,
): Promise<GoogleVendorActivationTicket | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'kupon-google-vendor-activation',
      audience: 'kupon-vendor-activation',
      algorithms: ['HS256'],
    });
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.applicationId !== 'string'
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      applicationId: payload.applicationId,
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

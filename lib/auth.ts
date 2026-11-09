import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { AppError, forbidden, unauthorized } from '@/lib/errors';
import type { Role } from '@/lib/constants';

export const SESSION_COOKIE = 'kupon_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const secret = new TextEncoder().encode(env.JWT_SECRET);

export type SessionPayload = {
  uid: string;
  sessionVersion: number;
  role: Role;
  universityId: string | null;
  name: string;
  phone: string;
};

export type AuthUser = SessionPayload & {
  id: string;
  university: {
    id: string;
    name: string;
    code: string;
    paymentRouteCode: string;
  } | null;
  student: {
    id: string;
    studentId: string;
    course: string;
    year: number;
  } | null;
  vendor: {
    id: string;
    name: string;
    code: string;
    status: string;
    pendingBalance: number;
  } | null;
  managedVendor: {
    id: string;
    name: string;
    code: string;
    status: string;
    universityId: string;
  } | null;
};

export async function signSession(payload: Omit<SessionPayload, 'sessionVersion'>): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { sessionVersion: true },
  });
  if (!user) throw unauthorized();

  return new SignJWT({
    role: payload.role,
    sessionVersion: user.sessionVersion,
    universityId: payload.universityId,
    name: payload.name,
    phone: payload.phone,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.uid)
    .setIssuer('kupon')
    .setAudience('kupon-app')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'kupon',
      audience: 'kupon-app',
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.role !== 'string') return null;
    const sessionVersion = Number(payload.sessionVersion ?? 0);
    if (!Number.isInteger(sessionVersion) || sessionVersion < 0) return null;
    return {
      uid: payload.sub,
      sessionVersion,
      role: payload.role as Role,
      universityId: (payload.universityId as string | null) ?? null,
      name: String(payload.name ?? ''),
      phone: String(payload.phone ?? ''),
    };
  } catch {
    return null;
  }
}

/** Reads the signed cookie in a server component / layout. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Reads the session and rehydrates the user from the database. Never trust the
 * JWT alone for authorisation: a suspended vendor or deleted student must lose
 * access immediately.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: {
      university: {
        select: { id: true, name: true, code: true, paymentRouteCode: true, status: true },
      },
      student: {
        select: {
          id: true,
          studentId: true,
          course: true,
          year: true,
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          pendingBalance: true,
        },
      },
      managedVendor: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          universityId: true,
        },
      },
      vendorApplication: { select: { phone: true } },
    },
  });

  if (!user) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;
  if (
    (user.role === 'STAFF' || user.role === 'FINANCE') &&
    user.managedVendorId &&
    !user.managedVendor
  ) {
    return null;
  }
  if (user.role === 'STAFF' && !user.managedVendorId) return null;
  if (
    user.vendor?.status === 'SUSPENDED' ||
    (user.managedVendor && user.managedVendor.status !== 'ACTIVE')
  ) {
    return null;
  }
  if (user.managedVendor && user.universityId !== user.managedVendor.universityId) return null;
  // A suspended university cuts off all tenant roles immediately, even if their
  // JWT has not expired yet.
  if (
    user.role !== 'SUPER_ADMIN' &&
    !(user.role === 'FINANCE' && !user.managedVendorId) &&
    user.university?.status !== 'ACTIVE'
  ) {
    return null;
  }

  return {
    id: user.id,
    uid: user.id,
    sessionVersion: user.sessionVersion,
    role: user.role as Role,
    universityId: user.universityId,
    name: user.name,
    phone:
      user.role === 'VENDOR'
        ? user.phone ?? user.vendorApplication?.phone ?? ''
        : user.phone ?? '',
    university: user.university
      ? {
          id: user.university.id,
          name: user.university.name,
          code: user.university.code,
          paymentRouteCode: user.university.paymentRouteCode,
        }
      : null,
    student: user.student,
    vendor: user.vendor,
    managedVendor: user.managedVendor,
  };
}

/** API guard. Throws a typed AppError consumed by `fail()`. */
export async function requireApiUser(roles?: Role[]): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) {
    throw forbidden(`This action requires a ${roles.join(' or ').toLowerCase()} account.`);
  }
  return user;
}

/** Page/layout guard. Redirects instead of throwing. */
export async function requirePageUser(
  roles?: Role[],
  loginPath = '/login',
): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(loginPath);
  if (roles && !roles.includes(user.role)) {
    redirect(roleHome(user.role));
  }
  return user;
}

/** Multi-tenant boundary: normal roles may only touch their own university. */
export function assertTenant(user: AuthUser, universityId: string) {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.universityId || user.universityId !== universityId) {
    throw forbidden('This record belongs to another university.');
  }
}

export function requireStudent(user: AuthUser) {
  if (user.role !== 'STUDENT' || !user.student) {
    throw forbidden('A student account is required for this action.');
  }
  return user.student;
}

export function requireVendor(user: AuthUser) {
  if (user.role !== 'VENDOR' || !user.vendor) {
    throw forbidden('A vendor account is required for this action.');
  }
  if (user.vendor.status !== 'ACTIVE') {
    throw forbidden('This vendor account is suspended. Contact your cafeteria manager.');
  }
  return user.vendor;
}

export function requireManagedVendor(user: AuthUser) {
  if (!['STAFF', 'FINANCE'].includes(user.role) || !user.managedVendor) {
    throw forbidden('A cafeteria team account is required for this action.');
  }
  if (user.managedVendor.status !== 'ACTIVE') {
    throw forbidden('This cafeteria account is suspended. Contact the cafeteria owner.');
  }
  return user.managedVendor;
}

export function requireOperationalVendor(user: AuthUser) {
  if (user.role === 'VENDOR') return requireVendor(user);
  if (user.role === 'STAFF' && user.managedVendor) {
    if (user.managedVendor.status !== 'ACTIVE') {
      throw forbidden('This cafeteria account is suspended. Contact the cafeteria owner.');
    }
    return user.managedVendor;
  }
  throw forbidden('A vendor or cafeteria staff account is required for this action.');
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function roleHome(role: Role): string {
  switch (role) {
    case 'STUDENT':
      return '/student';
    case 'VENDOR':
      return '/vendor';
    case 'ADMIN':
      return '/admin';
    case 'FINANCE':
      return '/finance';
    case 'STAFF':
      return '/staff';
    default:
      return '/super-admin';
  }
}

export type { JWTPayload };

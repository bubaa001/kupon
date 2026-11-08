import { env } from '@/lib/env';

/**
 * Minimal Google OpenID Connect helper.
 *
 * This intentionally uses the OAuth 2.0 authorization-code flow directly over
 * fetch instead of adding a provider SDK: the app only needs `openid email
 * profile`, and keeping the token exchange server-side means the client secret
 * never reaches the browser.
 */

export const GOOGLE_STATE_COOKIE = 'kupon_google_state';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  mobileRedirectUri: string | null;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

export type GoogleStatePayload = {
  state: string;
  universityId: string;
  role: 'student' | 'vendor' | 'staff';
  createdAt: number;
};

export function getGoogleConfig(): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI ?? `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    mobileRedirectUri: env.GOOGLE_MOBILE_REDIRECT_URI ?? null,
  };
}

/**
 * Picks the callback that matches the browser's actual origin.
 *
 * Desktop/dev uses the canonical localhost redirect. A phone cannot reach the
 * laptop's localhost, so a phone session opened through a public HTTPS tunnel
 * uses the registered mobile callback instead. The callback route must select
 * the same URI for the token exchange, or Google rejects the code.
 */
export function resolveGoogleRedirectUri(
  config: GoogleConfig,
  requestOrigin: string,
): { redirectUri: string; matchedMobile: boolean } {
  if (config.mobileRedirectUri) {
    try {
      if (new URL(config.mobileRedirectUri).origin === requestOrigin) {
        return { redirectUri: config.mobileRedirectUri, matchedMobile: true };
      }
    } catch {
      /* invalid optional env value; fall back to the canonical URI */
    }
  }
  return { redirectUri: config.redirectUri, matchedMobile: false };
}

export function buildGoogleAuthUrl(
  config: GoogleConfig,
  state: string,
  redirectUri = config.redirectUri,
): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('include_granted_scopes', 'true');
  return url.toString();
}

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(
  config: GoogleConfig,
  code: string,
  redirectUri = config.redirectUri,
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ?? payload.error ?? 'Google did not return an access token.',
    );
  }
  return payload.access_token;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Could not read your Google profile.');
  }
  const profile = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email) {
    throw new Error('Google did not return a verified email address.');
  }
  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified:
      profile.email_verified === true || String(profile.email_verified) === 'true',
    name: profile.name ?? profile.email.split('@')[0],
    picture: profile.picture ?? null,
  };
}

import { env } from '@/lib/env';

/**
 * Resolves the URL a browser actually used.
 *
 * Behind a tunnel/proxy, Next's internal `request.url` can still say
 * `localhost:3000` even when the browser is on the public HTTPS origin. Redirects
 * built from `request.url` would then send a phone to its own localhost. Always
 * build user-facing redirects from the forwarded Host/Proto headers.
 */
export function getExternalOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost ?? request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    url.protocol.replace(':', '');
  const canonical = new URL(env.NEXT_PUBLIC_APP_URL).origin;
  if (!host) return canonical;

  try {
    const candidate = new URL(`${proto}://${host}`).origin;
    const allowed = new Set([canonical]);
    if (env.GOOGLE_MOBILE_REDIRECT_URI) {
      allowed.add(new URL(env.GOOGLE_MOBILE_REDIRECT_URI).origin);
    }
    if (
      process.env.NODE_ENV !== 'production' &&
      /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(new URL(candidate).host)
    ) {
      allowed.add(candidate);
    }
    return allowed.has(candidate) ? candidate : canonical;
  } catch {
    return canonical;
  }
}

export function externalUrl(request: Request, path: string): URL {
  return new URL(path, getExternalOrigin(request));
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Routes that do not require authentication. */
const PUBLIC_ROUTES = ['/login', '/register', '/recovery'];

/**
 * Lightweight JWT expiry check — decodes the payload without verifying the
 * signature (signature is verified by the backend on every API call).
 * Returning `true` means the token is present and not yet expired.
 */
function isTokenFresh(token: string): boolean {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    const json = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return true; // no expiry claim → allow
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  // Always allow /logout so users with expired tokens can still sign out
  if (pathname === '/logout') return NextResponse.next();

  const token = request.cookies.get('token')?.value;
  const authenticated = !!token && isTokenFresh(token);

  if (!authenticated && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from auth pages
  if (authenticated && isPublic) {
    return NextResponse.redirect(new URL('/upload', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};

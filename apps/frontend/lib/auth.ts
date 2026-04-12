/**
 * @file apps/frontend/lib/auth.ts
 * @description Client-side authentication utilities.
 */

interface JwtPayload {
  sub?: string;
  exp?: number;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Decodes the user_id (sub claim) from a JWT token.
 *
 * @param token - JWT bearer token string
 * @returns The user_id from the token payload, or null if the token is invalid
 */
export function parseJwtUserId(token: string): string | null {
  const payload = parseJwtPayload(token);
  return payload?.sub ?? null;
}

/**
 * Validates token shape and expiry for client-side route protection.
 */
export function isTokenValid(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload?.sub) return false;
  if (typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 > Date.now();
}

/**
 * Clears auth session and redirects to login with an optional flash message.
 */
export function clearSessionAndRedirectToLogin(
  navigate: (href: string) => void,
  options?: { sessionExpired?: boolean },
): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    if (options?.sessionExpired) {
      sessionStorage.setItem('auth_message', 'Session expired. Please log in again.');
    }
  }
  navigate('/login');
}

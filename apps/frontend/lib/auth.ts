/**
 * @file apps/frontend/lib/auth.ts
 * @description Client-side authentication utilities.
 */

/**
 * Decodes the user_id (sub claim) from a JWT token.
 *
 * @param token - JWT bearer token string
 * @returns The user_id from the token payload, or null if the token is invalid
 */
export function parseJwtUserId(token: string): string | null {
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
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * @file apps/frontend/lib/api.ts
 * @description Shared API fetch helpers for frontend pages.
 */

import { clearSessionAndRedirectToLogin } from './auth';

function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem('auth_redirect_in_progress') === '1') return;
  sessionStorage.setItem('auth_redirect_in_progress', '1');
  clearSessionAndRedirectToLogin((href) => window.location.assign(href), { sessionExpired: true });
}

/**
 * Centralized wrapper around fetch for API requests.
 * Automatically clears expired auth and redirects to /login on HTTP 401.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  return response;
}

/**
 * @file apps/frontend/lib/api.ts
 * @description Shared API fetch helpers for frontend pages.
 */

import { clearSessionAndRedirectToLogin } from './auth';

type ApiDetail = string | { message?: string } | Array<{ msg?: string }> | null | undefined;

interface ApiErrorBody {
  error?: unknown;
  detail?: ApiDetail;
  message?: unknown;
  reply?: unknown;
}

function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem('auth_redirect_in_progress') === '1') return;
  sessionStorage.setItem('auth_redirect_in_progress', '1');
  clearSessionAndRedirectToLogin((href) => window.location.assign(href), { sessionExpired: true });
}

function normalizeApiDetail(detail: ApiDetail): string | null {
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const joined = detail.map((item) => item.msg).filter(Boolean).join(', ');
    return joined || null;
  }

  if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
    return detail.message.trim();
  }

  return null;
}

async function readTextSafely(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
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

export async function readApiJson<T>(response: Response): Promise<T> {
  const text = await readTextSafely(response);
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned an invalid JSON response.');
  }
}

export async function readApiErrorMessage(response: Response, fallback?: string): Promise<string> {
  const text = (await readTextSafely(response.clone())).trim();
  if (!text) {
    return fallback ?? `Request failed (HTTP ${response.status})`;
  }

  try {
    const body = JSON.parse(text) as ApiErrorBody;

    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }

    const detail = normalizeApiDetail(body.detail);
    if (detail) {
      return detail;
    }

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }

    if (typeof body.reply === 'string' && body.reply.trim()) {
      return body.reply.trim();
    }
  } catch {
    return text;
  }

  return fallback ?? `Request failed (HTTP ${response.status})`;
}

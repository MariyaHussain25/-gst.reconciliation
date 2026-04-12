/**
 * @file apps/frontend/app/login/page.tsx
 * @description Login page — email/password form that authenticates against
 * the FastAPI /api/auth/login endpoint and stores the JWT bearer token.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid } from '../../lib/auth';
import { apiFetch } from '../../lib/api';

function getEmailValidationError(value: string): string | null {
  if (!value.trim()) return 'Please enter your email address.';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(value)) return 'Please enter a valid email address.';
  return null;
}

function getPasswordValidationError(value: string): string | null {
  if (!value) return 'Please enter your password.';
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(value)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include at least one special character.';
  return null;
}

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flashMessage = sessionStorage.getItem('auth_message');
    if (flashMessage) {
      setError(flashMessage);
      sessionStorage.removeItem('auth_message');
    }
    sessionStorage.removeItem('auth_redirect_in_progress');

    const token = localStorage.getItem('token');
    if (!token) return;

    if (isTokenValid(token)) {
      router.push('/');
    } else {
      localStorage.removeItem('token');
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError('');

    const emailError = getEmailValidationError(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      // FastAPI OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('username', email); // OAuth2 spec uses 'username'
      formData.append('password', password);

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (res.ok) {
        const data: { access_token: string; token_type: string } = await res.json();
        localStorage.setItem('token', data.access_token);
        router.push('/');
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          detail?: string | { message?: string } | Array<{ msg?: string }>;
        };
        const detail =
          typeof body.detail === 'string'
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail.map((item) => item.msg).filter(Boolean).join(', ')
              : body.detail?.message;

        const normalizedDetail = detail?.toLowerCase() ?? '';
        if (res.status === 401 || normalizedDetail.includes('incorrect') || normalizedDetail.includes('invalid')) {
          setError('Invalid credentials');
        } else if (res.status === 403 || normalizedDetail.includes('inactive')) {
          setError('Account inactive');
        } else {
          setError(detail ?? 'Login failed. Please try again.');
        }
      }
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Sign In</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setEmail(value);
                e.currentTarget.setCustomValidity(getEmailValidationError(value) ?? '');
              }}
              onInvalid={(e) => {
                e.currentTarget.setCustomValidity(getEmailValidationError(e.currentTarget.value) ?? '');
              }}
              onInput={(e) => e.currentTarget.setCustomValidity('')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              pattern="^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInvalid={(e) => {
                const validationError = getPasswordValidationError(e.currentTarget.value);
                e.currentTarget.setCustomValidity(validationError ?? '');
              }}
              onInput={(e) => {
                e.currentTarget.setCustomValidity(getPasswordValidationError(e.currentTarget.value) ?? '');
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href="/register" className="font-medium text-primary hover:underline">
            Register
          </a>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <a href="/recovery" className="font-medium text-primary hover:underline">
            Forgot Password?
          </a>
        </p>
      </div>
    </div>
  );
}

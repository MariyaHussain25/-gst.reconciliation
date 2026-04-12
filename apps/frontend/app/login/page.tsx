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
      router.push('/upload');
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
        const jwt = data.access_token;
        localStorage.setItem('token', jwt);
        document.cookie = `token=${jwt}; path=/; max-age=86400`;
        router.push('/upload');
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
    <div
      style={{
        minHeight: '100vh',
        background: '#0a1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '36px 40px',
          width: '100%',
          maxWidth: 400,
          border: '0.5px solid #e2e8f0',
        }}
      >
        {/* Card header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#0a1628', marginBottom: 4 }}>
            GST Reconciliation
          </p>
          <p
            style={{
              fontSize: 11,
              color: '#3b82f6',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ITC Automation System
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5 }}
            >
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
              style={{
                width: '100%',
                border: '0.5px solid #e2e8f0',
                borderRadius: 6,
                padding: '9px 12px',
                fontSize: 13,
                color: '#0a1628',
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1e40af'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5 }}
            >
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
              style={{
                width: '100%',
                border: '0.5px solid #e2e8f0',
                borderRadius: 6,
                padding: '9px 12px',
                fontSize: 13,
                color: '#0a1628',
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1e40af'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 6,
                border: '0.5px solid #fecaca',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 4,
              padding: '10px',
              fontSize: 13,
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          Don&apos;t have an account?{' '}
          <a href="/register" style={{ color: '#1e40af', fontWeight: 500 }}>
            Register
          </a>
        </p>
        <p style={{ marginTop: 8, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          <a href="/recovery" style={{ color: '#1e40af', fontWeight: 500 }}>
            Forgot Password?
          </a>
        </p>
      </div>
    </div>
  );
}

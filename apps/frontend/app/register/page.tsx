/**
 * @file apps/frontend/app/register/page.tsx
 * @description Registration page — name/email/password form that creates a new
 * account via the FastAPI /api/auth/register endpoint and redirects to /login.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push('/login');
      } else {
        const body = await res.json().catch(() => ({}));
        setError((body as { detail?: string }).detail ?? 'Registration failed. Please try again.');
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

        <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="name"
              style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5 }}
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              placeholder="Your full name"
            />
          </div>

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
              onChange={(e) => setEmail(e.target.value)}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {success && (
            <p
              role="status"
              style={{
                background: '#f0fdf4',
                color: '#16a34a',
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 6,
                border: '0.5px solid #bbf7d0',
              }}
            >
              {success}
            </p>
          )}

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
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#1e40af', fontWeight: 500 }}>
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}

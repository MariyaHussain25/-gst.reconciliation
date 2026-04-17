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
        background: '#111111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(229,62,62,0.35)',
            }}
          >
            G
          </div>
          <span style={{ color: '#f0f0f0', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            GST Reconciliation
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '36px 40px',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: '#666666' }}>
              Start reconciling GST returns in minutes
            </p>
          </div>

          <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Full Name */}
            <div>
              <label htmlFor="name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#c0c0c0', marginBottom: 7 }}>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e53e3e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(229,62,62,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#111111',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#f0f0f0',
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                placeholder="Your full name"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#c0c0c0', marginBottom: 7 }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e53e3e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(229,62,62,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#111111',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#f0f0f0',
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                placeholder="you@company.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#c0c0c0', marginBottom: 7 }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e53e3e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(229,62,62,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#111111',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#f0f0f0',
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                placeholder="••••••••"
              />
            </div>

            {/* Success */}
            {success && (
              <div
                role="status"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#4ade80',
                }}
              >
                {success}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(229,62,62,0.1)',
                  border: '1px solid rgba(229,62,62,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="7" stroke="#e53e3e" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#e53e3e" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: 13, color: '#e53e3e', lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#7a1d1d' : '#e53e3e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
                letterSpacing: '0.01em',
                marginTop: 2,
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#c53030';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#e53e3e';
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: '#666666' }}>
            Already have an account?{' '}
            <a
              href="/login"
              style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#3b82f6'; }}
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

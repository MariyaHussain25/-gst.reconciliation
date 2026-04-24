/**
 * @file apps/frontend/app/register/page.tsx
 * @description Registration page — name/email/password form that creates a new
 * account via the FastAPI /api/auth/register endpoint and redirects to /login.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiErrorMessage } from '../../lib/api';

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
        setError(await readApiErrorMessage(res, 'Registration failed. Please try again.'));
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
        background: '#f1f5f9',
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
              background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(8,145,178,0.35)',
            }}
          >
            G
          </div>
          <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            GST Reconciliation
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 14,
            padding: '36px 40px',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: '#64748b' }}>
              Start reconciling GST returns in minutes
            </p>
          </div>

          <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Full Name */}
            <div>
              <label htmlFor="name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 7 }}>
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
                  e.currentTarget.style.borderColor = '#0891b2';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#0f172a',
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
              <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 7 }}>
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
                  e.currentTarget.style.borderColor = '#0891b2';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#0f172a',
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
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 7 }}>
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
                  e.currentTarget.style.borderColor = '#0891b2';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 14,
                  color: '#0f172a',
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
                  <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 10.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#075985' : '#0891b2',
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
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#0e7490';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#0891b2';
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
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

/**
 * @file apps/frontend/app/login/page.tsx
 * @description Login page — email/password form that authenticates against
 * the FastAPI /api/auth/login endpoint and stores the JWT bearer token.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenValid } from '../../lib/auth';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

function getEmailValidationError(value: string): string | null {
  if (!value.trim()) return 'Please enter your email address.';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(value)) return 'Please enter a valid email address.';
  return null;
}

function getPasswordValidationError(value: string): string | null {
  if (!value) return 'Please enter your password.';
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
        const data = await readApiJson<{ access_token: string; token_type: string }>(res);
        const jwt = data.access_token;
        localStorage.setItem('token', jwt);
        document.cookie = `token=${jwt}; path=/; max-age=86400`;
        router.push('/upload');
      } else {
        const detail = await readApiErrorMessage(res, 'Login failed. Please try again.');

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
      className="login-split"
      style={{
        background: '#f1f5f9',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Left branding panel ── */}
      <div
        className="login-left"
        style={{
          background: 'linear-gradient(160deg, #0c4a6e 0%, #0891b2 60%, #0e7490 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {/* Decorative red glow — top-left */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            left: '-150px',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        {/* Decorative blue glow — bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo / top wordmark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #ffffff30 0%, #ffffff10 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              G
            </div>
            <span
              style={{
                color: '#f0f0f0',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              GST Reconciliation
            </span>
          </div>
        </div>

        {/* Main content — pushed to vertical middle */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingBottom: '60px' }}>
          {/* Eyebrow label */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 20,
              padding: '4px 12px',
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: '#e0f2fe',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ITC Automation Platform
            </span>
          </div>

          <h1
            style={{
              fontSize: 46,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: 18,
            }}
          >
            Reconcile Smarter,
            <br />
            <span style={{ color: '#7dd3fc' }}>Not Harder.</span>
          </h1>

          <p
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.7)',
              maxWidth: '440px',
              lineHeight: 1.7,
              marginBottom: 44,
            }}
          >
            AI-powered GSTR-2A and GSTR-2B matching with full audit trails —
            built for Indian businesses that move fast.
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Automated invoice matching across 2A & 2B', color: '#7dd3fc' },
              { label: 'AI-generated ITC eligibility explanations', color: '#a5f3fc' },
              { label: 'One-click compliance reports & PDF exports', color: '#7dd3fc' },
            ].map((feat) => (
              <div key={feat.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: `${feat.color}18`,
                    border: `1px solid ${feat.color}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5L4.5 8L9 3" stroke={feat.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{feat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stat strip */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            gap: 40,
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {[
            { value: '98%', label: 'Match accuracy' },
            { value: '10×', label: 'Faster than manual' },
            { value: 'GST-ready', label: 'All return types' },
          ].map((stat) => (
            <div key={stat.label}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Form panel ── */}
      <div
        className="login-right"
        style={{
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {/* Form header */}
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                marginBottom: 6,
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 7 }}
              >
                Email address
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <label
                  htmlFor="password"
                  style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}
                >
                  Password
                </label>
                <a
                  href="/recovery"
                  style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#3b82f6'; }}
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
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
                transition: 'background 0.15s, transform 0.1s',
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Register link */}
          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            Don&apos;t have an account?{' '}
            <a
              href="/register"
              style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#3b82f6'; }}
            >
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

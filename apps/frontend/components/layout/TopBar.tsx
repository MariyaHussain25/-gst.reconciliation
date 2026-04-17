'use client';

/**
 * @file components/layout/TopBar.tsx
 * @description Top bar shown on all authenticated pages.
 * Shows page title (derived from pathname), company name, GSTIN chip, and dark mode toggle.
 * Phase 12: Navy design system.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const COMPANY = 'ABC Industries Pvt Ltd';
const GSTIN = '29AABCI1234G1Z5';

const PAGE_TITLES: Record<string, string> = {
  '/':             'Dashboard',
  '/upload':       'Upload Documents',
  '/results':      'Reconciliation Results',
  '/reports':      'Reports',
  '/rules':        'Rules Engine',
  '/itc-summary':  'ITC Summary',
  '/file-returns': 'File Returns',
  '/gstr2a':       'GSTR-2A',
  '/chat':         'Chat Assistant',
  '/logout':       'Sign Out',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match prefix (e.g. /file-returns/returns)
  const match = Object.keys(PAGE_TITLES).find(
    (key) => key !== '/' && pathname.startsWith(key + '/'),
  );
  return match ? PAGE_TITLES[match] : 'GST Reconciliation';
}

export function TopBar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}): React.ReactElement {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.classList.contains('dark') || el.getAttribute('data-theme') === 'dark');
  }, []);

  function toggleTheme(): void {
    const el = document.documentElement;
    const dark = el.classList.contains('dark') || el.getAttribute('data-theme') === 'dark';
    if (dark) {
      el.classList.remove('dark');
      el.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      el.classList.add('dark');
      el.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  }

  return (
    <header
      style={{
        height: 54,
        background: '#111111',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Page title + hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Hamburger — only visible on mobile via CSS */}
        <button
          type="button"
          onClick={onMenuClick}
          className="mobile-menu-btn"
          aria-label="Open navigation"
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '6px 8px',
            cursor: 'pointer',
            color: '#c0c0c0',
            lineHeight: 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#f0f0f0',
            letterSpacing: '-0.01em',
          }}
        >
          {getPageTitle(pathname)}
        </span>
      </div>

      {/* Right: company, GSTIN chip, theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#888888' }}>
          {COMPANY}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            background: '#1a1a1a',
            padding: '4px 10px',
            borderRadius: 6,
            color: '#3b82f6',
            border: '1px solid rgba(59,130,246,0.2)',
            letterSpacing: '0.02em',
          }}
        >
          {GSTIN}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 12,
            color: '#888888',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#f0f0f0';
            (e.currentTarget as HTMLButtonElement).style.background = '#222222';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#888888';
            (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
          }}
        >
          {isDark ? '☀ Light' : '☾ Dark'}
        </button>
      </div>
    </header>
  );
}

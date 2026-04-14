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

export function TopBar(): React.ReactElement {
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
        height: 52,
        background: 'var(--bg-card)',
        borderBottom: '0.5px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Page title */}
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        {getPageTitle(pathname)}
      </span>

      {/* Right: company, GSTIN chip, theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
          {COMPANY}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            background: 'var(--bg-page)',
            padding: '3px 8px',
            borderRadius: 4,
            color: 'var(--text-muted)',
            border: '0.5px solid var(--border)',
          }}
        >
          {GSTIN}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'var(--bg-page)',
            border: '0.5px solid var(--border)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </header>
  );
}

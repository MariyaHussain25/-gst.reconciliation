/**
 * @file apps/frontend/components/layout/Header.tsx
 * @description Top navigation header for the GST Reconciliation System.
 * Contains the app branding, links to all main pages, and a Light/Dark mode toggle.
 *
 * Phase 1: Static navigation header.
 * Phase 8: Added Dashboard, File Returns, GSTR-2A, and ITC Summary links.
 * Phase 10: Made client component; added theme toggle (Midnight Indigo / Vanilla Cream palette).
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Navigation links shown in the header */
const navigationLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/file-returns', label: 'File Returns' },
  { href: '/itc-summary', label: 'ITC Summary' },
  { href: '/upload', label: 'Upload' },
  { href: '/results', label: 'Results' },
  { href: '/reports', label: 'Reports' },
  { href: '/rules', label: 'Rules' },
  { href: '/chat', label: 'Chat' },
] as const;

/**
 * Application-wide top navigation header.
 * Displays the app name, navigation links, and a theme toggle button.
 */
export function Header(): React.ReactElement {
  const [isDark, setIsDark] = useState(false);

  /* Sync state with whatever the anti-FOUC script set on <html> */
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme(): void {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  }

  return (
    <header className="border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">GST</span>
          <span className="text-xl font-semibold text-foreground">Reconciliation</span>
        </Link>

        {/* Navigation links + theme toggle */}
        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-6">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Theme toggle */}
            <li>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                {isDark ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                    Light
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Dark
                  </>
                )}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

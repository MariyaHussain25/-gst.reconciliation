/**
 * @file apps/frontend/components/layout/Header.tsx
 * @description Top navigation header for the GST Reconciliation System.
 * Contains the app branding and links to all main pages.
 *
 * Phase 1: Static navigation header.
 * Phase 8: Added Dashboard, File Returns, GSTR-2A, and ITC Summary links.
 */

import Link from 'next/link';

/** Navigation links shown in the header */
const navigationLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/file-returns', label: 'File Returns' },
  { href: '/gstr2a', label: 'GSTR-2A' },
  { href: '/itc-summary', label: 'ITC Summary' },
  { href: '/upload', label: 'Upload' },
  { href: '/results', label: 'Results' },
  { href: '/reports', label: 'Reports' },
] as const;

/**
 * Application-wide top navigation header.
 * Displays the app name and navigation links.
 */
export function Header(): React.ReactElement {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">GST</span>
          <span className="text-xl font-semibold text-gray-800">Reconciliation</span>
        </Link>

        {/* Navigation links */}
        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-6">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-gray-600 transition hover:text-blue-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

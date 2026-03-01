/**
 * @file apps/frontend/components/layout/Sidebar.tsx
 * @description Sidebar navigation for dashboard-style layouts.
 * Used in the results and reports pages for secondary navigation.
 *
 * Phase 1: Static sidebar scaffold.
 * Phase 5+: Add active state highlighting and collapsible sections.
 */

import Link from 'next/link';

/** Sidebar navigation item definition */
interface SidebarItem {
  href: string;
  label: string;
  description: string;
}

/** Main sidebar navigation items */
const sidebarItems: SidebarItem[] = [
  {
    href: '/upload',
    label: 'Upload Documents',
    description: 'Add purchase books & GSTR files',
  },
  {
    href: '/results',
    label: 'Reconciliation Results',
    description: 'View matched & unmatched invoices',
  },
  {
    href: '/reports',
    label: 'PDF Reports',
    description: 'Generate & download reports',
  },
];

/**
 * Sidebar navigation component.
 * Designed to be used alongside the main content area in dashboard layouts.
 */
export function Sidebar(): React.ReactElement {
  return (
    <aside className="w-64 flex-shrink-0">
      <nav aria-label="Sidebar navigation">
        <ul className="space-y-1">
          {sidebarItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex flex-col rounded-lg px-4 py-3 transition hover:bg-blue-50"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  {item.label}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-blue-500">
                  {item.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

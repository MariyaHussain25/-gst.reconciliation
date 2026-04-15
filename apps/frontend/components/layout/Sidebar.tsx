'use client';

/**
 * @file components/layout/Sidebar.tsx
 * @description Global sidebar navigation. Background is always #0a1628 (navy) — never changes.
 * Uses usePathname() for active state. Lucide React icons.
 * Phase 12: Full rebuild — navy design system.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  FileText,
  BarChart2,
  BookOpen,
  Calculator,
  FilePlus,
  LogOut,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',             label: 'Dashboard',   Icon: LayoutDashboard, exact: true },
  { href: '/upload',       label: 'Upload',       Icon: Upload },
  { href: '/results',      label: 'Results',      Icon: FileText },
  { href: '/reports',      label: 'Reports',      Icon: BarChart2 },
  { href: '/rules',        label: 'Rules',        Icon: BookOpen },
  { href: '/itc-summary',  label: 'ITC Summary',  Icon: Calculator },
  { href: '/file-returns', label: 'File Returns', Icon: FilePlus },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout(): void {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  return (
    <aside
      style={{
        width: 200,
        minWidth: 200,
        background: '#0a1628',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo section */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
          GST Reconciliation
        </p>
        <p
          style={{
            color: '#3b82f6',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 3,
          }}
        >
          ITC Automation System
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, paddingTop: 8 }} aria-label="Sidebar navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? '#fff' : '#94a3b8',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8';
                }
              }}
            >
              <item.Icon size={15} color={active ? '#fff' : '#94a3b8'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '14px 16px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: '#e05454',
            border: '0.5px solid #e05454',
            borderRadius: 6,
            background: 'transparent',
            padding: '7px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,84,84,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
}


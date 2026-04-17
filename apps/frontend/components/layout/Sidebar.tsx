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

export function Sidebar({ onClose }: { onClose?: () => void }): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout(): void {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    onClose?.();
    router.push('/login');
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  return (
    <aside
      className="app-sidebar"
      style={{
        width: 220,
        minWidth: 220,
        background: '#0a0a0a',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        style={{
          padding: '22px 18px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(229,62,62,0.35)',
            }}
          >
            G
          </div>
          <div>
            <p style={{ color: '#f0f0f0', fontSize: 13, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              GST Recon
            </p>
            <p
              style={{
                color: '#3b82f6',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 2,
                letterSpacing: '0.02em',
              }}
            >
              ITC Automation
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav section label ── */}
      <div style={{ padding: '16px 18px 8px' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#444444',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Navigation
        </span>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, paddingBottom: 8 }} aria-label="Sidebar navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? '#f0f0f0' : '#666666',
                background: active ? 'rgba(229,62,62,0.1)' : 'transparent',
                borderLeft: active ? '2px solid #e53e3e' : '2px solid transparent',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                letterSpacing: '-0.005em',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#c0c0c0';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#666666';
                }
              }}
            >
              <item.Icon size={15} color={active ? '#e53e3e' : '#555555'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: '#888888',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7,
            background: 'transparent',
            padding: '8px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229,62,62,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = '#e53e3e';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(229,62,62,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#888888';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}


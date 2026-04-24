'use client';

/**
 * @file components/layout/Sidebar.tsx
 * @description Collapsible sidebar navigation.
 * Desktop: collapsed to 64px (icons only) by default, expands to 220px on hover.
 * Mobile: full-width slide-in drawer via .app-sidebar.open class.
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
  MessageSquare,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
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
  { href: '/chat',         label: 'Chat',         Icon: MessageSquare },
];

export function Sidebar({ onClose }: { onClose?: () => void }): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout(): void {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    onClose?.();
    void router.push('/login');
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        style={{
          height: 58,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--sidebar-border)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Icon always centered in the 64px column */}
        <div
          style={{
            width: 64,
            minWidth: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(8,145,178,0.45)',
            }}
          >
            G
          </div>
        </div>

        {/* Text — hidden when collapsed */}
        <div className="sidebar-logo-text" style={{ overflow: 'hidden' }}>
          <p style={{ color: '#f0f8ff', fontSize: 13, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            GST Recon
          </p>
          <p
            style={{
              color: '#7dd3fc',
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: 2,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            ITC Automation
          </p>
        </div>
      </div>

      {/* ── Nav section label ── */}
      <div style={{ paddingTop: 14, paddingBottom: 4, paddingLeft: 16, overflow: 'hidden', flexShrink: 0 }}>
        <span
          className="sidebar-section-label"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Navigation
        </span>
      </div>

      {/* ── Nav items ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }} aria-label="Sidebar navigation">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              className={`sidebar-nav-item${active ? ' active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                position: 'relative',
                borderLeft: active ? '2px solid #38bdf8' : '2px solid transparent',
                background: active ? 'rgba(56,189,248,0.14)' : 'transparent',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Icon — always visible, centered */}
              <span
                style={{
                  width: 62,
                  minWidth: 62,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'color 0.15s',
                }}
              >
                <item.Icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? '#38bdf8' : 'rgba(255,255,255,0.4)'}
                />
              </span>

              {/* Label — fades in when expanded */}
              <span
                className="sidebar-label"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? '#f0f8ff' : 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.005em',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── User / Logout ── */}
      <div
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className="sidebar-nav-item"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            borderLeft: '2px solid transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <span
            style={{
              width: 62,
              minWidth: 62,
              height: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={15} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
          </span>
          <span
            className="sidebar-label"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}
          >
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}


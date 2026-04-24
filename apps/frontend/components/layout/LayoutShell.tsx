'use client';

/**
 * @file components/layout/LayoutShell.tsx
 * @description Conditional layout shell.
 * Auth pages (/login, /register, /recovery): renders children only.
 * All other pages: renders sidebar + top bar + main content + chat widget.
 * Mobile: sidebar hidden by default, toggled via hamburger.
 * Desktop: sidebar collapses to 64px icons, expands to 220px on hover (CSS-only).
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ChatWidget } from '../chat/ChatWidget';
import { ToastProvider } from '../ui/Toast';

const AUTH_ROUTES = ['/login', '/register', '/recovery'];

export function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  if (isAuthPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        {/* Mobile overlay — tap to close sidebar */}
        <div
          className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar wrapper — CSS controls width on desktop; class .open on mobile */}
        <div className={`app-sidebar${sidebarOpen ? ' open' : ''}`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="app-content">
          <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '28px',
              background: 'var(--bg-page)',
            }}
          >
            {children}
          </main>
        </div>
        <ChatWidget />
      </div>
    </ToastProvider>
  );
}

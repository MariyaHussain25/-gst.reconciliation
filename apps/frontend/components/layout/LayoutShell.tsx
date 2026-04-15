'use client';

/**
 * @file components/layout/LayoutShell.tsx
 * @description Conditional layout shell.
 * Auth pages (/login, /register): renders children only — no Sidebar, TopBar, ChatWidget.
 * All other pages: renders the full authenticated layout (Sidebar + TopBar + content + ChatWidget).
 * Mobile: sidebar hidden by default, toggled via hamburger button in TopBar.
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ChatWidget } from '../chat/ChatWidget';

const AUTH_ROUTES = ['/login', '/register'];

export function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay — tap to close sidebar */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
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
            background: '#111111',
          }}
        >
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

'use client';

/**
 * @file components/layout/LayoutShell.tsx
 * @description Conditional layout shell.
 * Auth pages (/login, /register): renders children only — no Sidebar, TopBar, ChatWidget.
 * All other pages: renders the full authenticated layout (Sidebar + TopBar + content + ChatWidget).
 */

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
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: 'var(--bg-page)',
          }}
        >
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

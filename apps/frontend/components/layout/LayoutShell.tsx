'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ChatWidget } from '../chat/ChatWidget';
import { clearSessionAndRedirectToLogin, isTokenValid } from '../../lib/auth';

const AUTH_ROUTES = ['/login', '/register'];

export function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_ROUTES.includes(pathname);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (isAuthPage) {
      setAuthChecked(true);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !isTokenValid(token)) {
      clearSessionAndRedirectToLogin(router.replace, { sessionExpired: Boolean(token) });
      return;
    }

    setAuthChecked(true);
  }, [isAuthPage, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563eb]/30 border-t-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
      <Sidebar isOpen={sidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}

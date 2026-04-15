'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { parseJwtUserId } from '../../lib/auth';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/upload': 'Upload Report',
  '/results': 'GSTR-2B Reconciliation',
  '/gstr2a': 'GSTR-2A Reconciliation',
  '/reports': 'Reports',
  '/rules': 'Rules Engine',
  '/itc-summary': 'ITC Summary',
  '/file-returns': 'File Returns',
  '/chat': 'Help & Support',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find((key) => key !== '/' && pathname.startsWith(`${key}/`));
  return match ? PAGE_TITLES[match] : 'Dashboard';
}

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps): React.ReactElement {
  const pathname = usePathname();
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    const userId = parseJwtUserId(token);
    if (userId) {
      setUserName(`Account ${userId.slice(0, 8)}`);
    }
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{getPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
        >
          <Bell size={16} />
        </button>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{userName}</p>
          <span className="rounded-full bg-[#2563eb]/10 px-2 py-0.5 text-xs font-semibold text-[#1e40af]">Admin</span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a3a6b] text-sm font-semibold text-white">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

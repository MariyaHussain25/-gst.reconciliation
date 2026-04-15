'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Upload,
} from 'lucide-react';
import { clearSessionAndRedirectToLogin } from '../../lib/auth';

interface SidebarProps {
  isOpen: boolean;
}

interface NavItem {
  href: string;
  label: string;
}

const RECON_ITEMS: NavItem[] = [
  { href: '/gstr2a', label: 'GSTR-2A Reconciliation' },
  { href: '/results', label: 'GSTR-2B Reconciliation' },
];

export function Sidebar({ isOpen }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [reconOpen, setReconOpen] = useState(true);

  function linkClasses(active: boolean): string {
    return [
      'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
      active ? 'bg-[#2563eb] text-white' : 'text-blue-100 hover:bg-white/10',
    ].join(' ');
  }

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout(): void {
    clearSessionAndRedirectToLogin(router.push);
  }

  if (!isOpen) {
    return <aside className="w-0 shrink-0 overflow-hidden" />;
  }

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-white/10 bg-[#1a3a6b] text-white">
      <div className="border-b border-white/10 px-4 py-5">
        <p className="text-base font-semibold">GST Reconciliation</p>
        <p className="text-xs text-blue-200">Automation System</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">Main</p>
        <Link href="/dashboard" className={linkClasses(isActive('/'))}>
          {isActive('/') && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-white" />}
          <LayoutDashboard size={16} />
          Dashboard
        </Link>

        <button
          type="button"
          onClick={() => setReconOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-blue-100 hover:bg-white/10"
        >
          <span>Reconciliation</span>
          {reconOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {reconOpen && (
          <div className="space-y-1 pl-2">
            {RECON_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} className={linkClasses(active)}>
                  {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-white" />}
                  <FileText size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <p className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-blue-200">Upload</p>
        <Link href="/upload" className={linkClasses(isActive('/upload'))}>
          {isActive('/upload') && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-white" />}
          <Upload size={16} />
          Report
        </Link>
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <Link href="/chat" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-blue-100 hover:bg-white/10">
          <CircleHelp size={16} />
          Help &amp; Support
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-md border border-white/30 px-3 py-2 text-sm text-white hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

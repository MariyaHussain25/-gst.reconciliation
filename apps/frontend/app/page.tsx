/**
 * @file apps/frontend/app/page.tsx
 * @description Main GST Reconciliation Dashboard.
 * Displays company info, returns filing calendar, and quick-access sidebar links.
 * Matches the official GST portal UI style — dark navy header, clean white content.
 *
 * Phase 1: Static landing page.
 * Phase 8: GST portal-style dashboard with returns calendar and sidebar links.
 */

import Link from 'next/link';
import { FilingStatusBadge, type FilingStatus } from '../components/ui/StatusBadge';

const COMPANY = 'ABC Industries Private Limited';
const GSTIN = '29AABCI1234G1Z5';
const FINANCIAL_YEAR = '2024-25';

const PERIODS = ['Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25'] as const;

interface ReturnRow {
  type: string;
  description: string;
  statuses: FilingStatus[];
}

const RETURN_ROWS: ReturnRow[] = [
  {
    type: 'GSTR-1',
    description: 'Details of outward supplies',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2A',
    description: 'Auto drafted – view only',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2B',
    description: 'Auto-drafted ITC statement',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'Not Filed'],
  },
  {
    type: 'GSTR-3B',
    description: 'Monthly summary return',
    statuses: ['Filed', 'Filed', 'Filed', 'To be Filed', 'Not Filed'],
  },
];

const SIDEBAR_LINKS = [
  { label: 'View Profile', href: '#' },
  { label: 'Check Cash Ledger', href: '#' },
  { label: 'Liability Ledger', href: '#' },
  { label: 'Credit Ledger', href: '#' },
] as const;

/**
 * Main dashboard page displayed at the root URL (/).
 * Shows a GST portal-style returns calendar and quick navigation links.
 */
export default function DashboardPage(): React.ReactElement {
  return (
    <div>
      {/* Company / GSTIN header strip */}
      <div className="mb-6 rounded-lg bg-[#182844] px-6 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{COMPANY}</h1>
            <p className="mt-0.5 font-mono text-sm text-[#a4aab4]">GSTIN: {GSTIN}</p>
          </div>
          <div className="text-sm text-[#a4aab4]">
            Financial Year:{' '}
            <span className="font-semibold text-white">{FINANCIAL_YEAR}</span>
          </div>
        </div>
      </div>

      {/* Main content + right sidebar */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Returns Calendar table */}
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border border-[#dddbd7] bg-white shadow-sm">
            <div className="flex items-center rounded-t-lg bg-[#182844] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">
                Returns Calendar — FY {FINANCIAL_YEAR}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dddbd7] bg-[#edece9]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6e7175]">
                      Return Type
                    </th>
                    {PERIODS.map((p) => (
                      <th
                        key={p}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#6e7175]"
                      >
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dddbd7]">
                  {RETURN_ROWS.map((row) => (
                    <tr key={row.type} className="hover:bg-[#f5f4f2]">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#182844]">{row.type}</span>
                        <span className="ml-2 text-xs text-[#6e7175]">{row.description}</span>
                      </td>
                      {row.statuses.map((status, idx) => (
                        <td key={idx} className="px-4 py-3 text-center">
                          <FilingStatusBadge status={status} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/file-returns"
              className="rounded bg-[#4470b0] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#2f5a9b] focus:outline-none focus:ring-2 focus:ring-[#4470b0] focus:ring-offset-2"
            >
              File Returns
            </Link>
            <Link
              href="/gstr2a"
              className="rounded border border-[#182844] bg-white px-5 py-2 text-sm font-semibold text-[#182844] transition hover:bg-[#edece9]"
            >
              View GSTR-2A
            </Link>
            <Link
              href="/itc-summary"
              className="rounded border border-[#278556] bg-white px-5 py-2 text-sm font-semibold text-[#278556] transition hover:bg-[#edece9]"
            >
              ITC Summary
            </Link>
          </div>
        </div>

        {/* Right quick-links sidebar */}
        <aside className="w-full lg:w-56 lg:flex-shrink-0">
          <div className="rounded-lg border border-[#dddbd7] bg-white shadow-sm">
            <div className="rounded-t-lg bg-[#182844] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Quick Links</h2>
            </div>
            <ul className="divide-y divide-[#dddbd7]">
              {SIDEBAR_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between px-4 py-3 text-sm text-[#4470b0] transition hover:bg-[#edece9]"
                  >
                    <span>{link.label}</span>
                    <span className="text-[#a4aab4]">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

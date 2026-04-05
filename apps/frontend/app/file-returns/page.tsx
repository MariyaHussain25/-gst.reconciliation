'use client';

/**
 * @file apps/frontend/app/file-returns/page.tsx
 * @description File Returns — Period Selector page.
 * Users choose Financial Year, Quarter, and Month then click SEARCH
 * to navigate to the list of returns for that period.
 *
 * Phase 8: GST portal-style period selector.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FINANCIAL_YEARS = ['2024-25', '2023-24', '2022-23'] as const;

const QUARTERS = [
  { value: 'Q1', label: 'Q1 (Apr – Jun)' },
  { value: 'Q2', label: 'Q2 (Jul – Sep)' },
  { value: 'Q3', label: 'Q3 (Oct – Dec)' },
  { value: 'Q4', label: 'Q4 (Jan – Mar)' },
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Common class for the three styled <select> elements. */
const SELECT_CLASS =
  'w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground ' +
  'focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring';

/**
 * Period Selector page for filing GST returns.
 * Provides three dropdowns (Financial Year, Quarter, Month) and a SEARCH button.
 */
export default function FileReturnsPage(): React.ReactElement {
  const router = useRouter();
  const [fy, setFy] = useState<string>('2024-25');
  const [quarter, setQuarter] = useState<string>('Q2');
  const [month, setMonth] = useState<string>('July');

  const handleSearch = () => {
    router.push('/file-returns/returns');
  };

  return (
    <div>
      {/* Page header strip */}
      <div className="mb-6 rounded-lg bg-primary px-6 py-4">
        <nav className="mb-1 flex items-center gap-1 text-xs text-primary-foreground/70">
          <Link href="/" className="transition hover:text-primary-foreground">
            Home
          </Link>
          <span>›</span>
          <span className="text-primary-foreground">File Returns</span>
        </nav>
        <h1 className="text-lg font-bold text-primary-foreground">File Returns</h1>
      </div>

      {/* Period selector card */}
      <div className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-primary">Select Period</h2>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            {/* Financial Year */}
            <div>
              <label
                htmlFor="fy"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Financial Year
              </label>
              <select
                id="fy"
                value={fy}
                onChange={(e) => setFy(e.target.value)}
                className={SELECT_CLASS}
              >
                {FINANCIAL_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter */}
            <div>
              <label
                htmlFor="quarter"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Quarter
              </label>
              <select
                id="quarter"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className={SELECT_CLASS}
              >
                {QUARTERS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <label
                htmlFor="month"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Period (Month)
              </label>
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={SELECT_CLASS}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SEARCH button */}
          <div className="mt-6">
            <button
              onClick={handleSearch}
              className="rounded bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              SEARCH
            </button>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
        <span className="mt-0.5 flex-shrink-0">ℹ️</span>
        <p>
          <strong>Note:</strong> GSTR-1 and GSTR-3B shall be filed for each month of the
          quarter.
        </p>
      </div>
    </div>
  );
}

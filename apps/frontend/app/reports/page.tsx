/**
 * @file apps/frontend/app/reports/page.tsx
 * @description PDF reports page.
 * Allows users to look up and download GST reconciliation PDF reports.
 *
 * Phase 8: Full implementation — form, lookup, download.
 */

'use client';

import { useState } from 'react';
import { formatCurrency, formatPeriod } from '../../lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

// ── Financial year helpers ───────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
/** Generate a list of recent FY strings, e.g. ["2024-25", "2023-24", ...] */
function generateFYOptions(count = 5): string[] {
  const options: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = CURRENT_YEAR - i;
    options.push(`${start}-${String(start + 1).slice(-2)}`);
  }
  return options;
}

const FY_OPTIONS = generateFYOptions();
const QUARTER_OPTIONS = ['Full Year', 'Q1', 'Q2', 'Q3', 'Q4'];

/** Generate month options for the date-range pickers (last 36 months). */
function generateMonthOptions(): { label: string; value: string }[] {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ label: formatPeriod(value), value });
  }
  return opts;
}

const MONTH_OPTIONS = generateMonthOptions();

// ── Types ────────────────────────────────────────────────────────────────────

interface ReconciliationSummary {
  total_invoices: number;
  matched_count: number;
  fuzzy_match_count: number;
  needs_review_count: number;
  missing_in_2a_count: number;
  missing_in_2b_count: number;
  value_mismatch_count: number;
  gstin_mismatch_count: number;
  total_eligible_itc: number;
  total_blocked_itc: number;
  total_ineligible_itc: number;
}

interface ReconciliationLookupItem {
  reconciliation_id: string;
  period: string;
  financial_year: string;
  status: string;
  created_at: string;
  summary: ReconciliationSummary;
}

type DurationMode = 'fy' | 'daterange';

// ── Status badge (inline, no extra dependency) ───────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-[#278556] text-white',
  PROCESSING: 'bg-[#4470b0] text-white',
  PENDING: 'bg-[#f09517] text-white',
  FAILED: 'bg-[#db2525] text-white',
};

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const cls = STATUS_STYLES[status] ?? 'bg-[#917260] text-white';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

/**
 * Reports page — generate and download PDF reconciliation reports.
 */
export default function ReportsPage(): React.ReactElement {
  // Form state
  const [userId, setUserId] = useState('');
  const [mode, setMode] = useState<DurationMode>('fy');
  const [financialYear, setFinancialYear] = useState(FY_OPTIONS[0] ?? '2024-25');
  const [quarter, setQuarter] = useState('Full Year');
  const [fromMonth, setFromMonth] = useState(MONTH_OPTIONS[2]?.value ?? '');
  const [toMonth, setToMonth] = useState(MONTH_OPTIONS[0]?.value ?? '');

  // Lookup state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReconciliationLookupItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<string[] | null>(null);

  // Per-row download loading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Lookup handler ────────────────────────────────────────────────────────

  async function handleLookup(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setResults(null);
    setAvailablePeriods(null);

    if (!userId.trim()) {
      setError('Please enter a User ID.');
      return;
    }

    setLoading(true);
    try {
      const url = new URL(`${API_BASE}/generate-pdf/by-user/${encodeURIComponent(userId.trim())}/lookup`);
      const res = await fetch(url.toString());
      const data: unknown = await res.json();

      if (!res.ok) {
        const errData = data as { error?: string; detail?: string; available_periods?: string[] };
        setError(errData.detail ?? errData.error ?? 'Lookup failed.');
        if (errData.available_periods) setAvailablePeriods(errData.available_periods);
        return;
      }

      const lookup = data as { success: boolean; reconciliations: ReconciliationLookupItem[] };
      if (!lookup.reconciliations.length) {
        setError('No reconciliations found for this user.');
        return;
      }
      setResults(lookup.reconciliations);
    } catch {
      setError('Network error — could not reach the server. Is the backend running on port 3001?');
    } finally {
      setLoading(false);
    }
  }

  // ── Download handler ──────────────────────────────────────────────────────

  async function handleDownload(item: ReconciliationLookupItem): Promise<void> {
    setDownloadingId(item.reconciliation_id);
    try {
      const url = `${API_BASE}/generate-pdf/${encodeURIComponent(item.reconciliation_id)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string; error?: string };
        setError(data.detail ?? data.error ?? 'Download failed.');
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `gst_reconciliation_${item.reconciliation_id}_${item.period}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Download failed — network error.');
    } finally {
      setDownloadingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header strip */}
      <div className="mb-6 rounded-lg bg-[#182844] px-6 py-4">
        <h1 className="text-lg font-bold text-white">PDF Reports</h1>
        <p className="mt-0.5 text-sm text-[#a4aab4]">
          Generate and download reconciliation reports
        </p>
      </div>

      {/* Search form */}
      <div className="rounded-lg border border-[#dddbd7] bg-white shadow-sm">
        <div className="flex items-center rounded-t-lg bg-[#182844] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Find Reports</h2>
        </div>
        <form onSubmit={handleLookup} className="p-6">
          {/* User ID */}
          <div className="mb-5">
            <label className="mb-1 block text-sm font-medium text-[#182844]" htmlFor="userId">
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter User ID (e.g. GSTIN or username)"
              className="w-full rounded border border-[#dddbd7] px-3 py-2 text-sm text-[#222] placeholder-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-[#4470b0]"
            />
          </div>

          {/* Duration mode toggle */}
          <div className="mb-4">
            <span className="mb-2 block text-sm font-medium text-[#182844]">Duration</span>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('fy')}
                className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                  mode === 'fy'
                    ? 'bg-[#182844] text-white'
                    : 'border border-[#dddbd7] bg-white text-[#444] hover:bg-[#f5f4f2]'
                }`}
              >
                Financial Year
              </button>
              <button
                type="button"
                onClick={() => setMode('daterange')}
                className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                  mode === 'daterange'
                    ? 'bg-[#182844] text-white'
                    : 'border border-[#dddbd7] bg-white text-[#444] hover:bg-[#f5f4f2]'
                }`}
              >
                Date Range
              </button>
            </div>

            {mode === 'fy' ? (
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#444]" htmlFor="fy">
                    Financial Year
                  </label>
                  <select
                    id="fy"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    className="rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4470b0]"
                  >
                    {FY_OPTIONS.map((fy) => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#444]" htmlFor="quarter">
                    Quarter
                  </label>
                  <select
                    id="quarter"
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4470b0]"
                  >
                    {QUARTER_OPTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#444]" htmlFor="fromMonth">
                    From
                  </label>
                  <select
                    id="fromMonth"
                    value={fromMonth}
                    onChange={(e) => setFromMonth(e.target.value)}
                    className="rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4470b0]"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#444]" htmlFor="toMonth">
                    To
                  </label>
                  <select
                    id="toMonth"
                    value={toMonth}
                    onChange={(e) => setToMonth(e.target.value)}
                    className="rounded border border-[#dddbd7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4470b0]"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-[#4470b0] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#2f5a9b] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#4470b0] focus:ring-offset-2"
          >
            {loading ? 'Searching…' : 'Find Reports'}
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded border border-[#f0c4c4] bg-[#fdf2f2] p-4">
          <p className="text-sm font-medium text-[#db2525]">{error}</p>
          {availablePeriods && availablePeriods.length > 0 && (
            <p className="mt-1 text-xs text-[#6e7175]">
              Available periods:{' '}
              <span className="font-medium text-[#182844]">
                {availablePeriods.map(formatPeriod).join(', ')}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Results table */}
      {results && results.length > 0 && (
        <div className="mt-6 rounded-lg border border-[#dddbd7] bg-white shadow-sm">
          <div className="flex items-center rounded-t-lg bg-[#182844] px-4 py-3">
            <h2 className="text-sm font-semibold text-white">
              Reconciliations ({results.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#dddbd7] bg-[#edece9]">
                  {[
                    'Period',
                    'Financial Year',
                    'Status',
                    'Created At',
                    'Total Invoices',
                    'Eligible ITC',
                    'Blocked ITC',
                    'Action',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6e7175]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dddbd7]">
                {results.map((item) => (
                  <tr key={item.reconciliation_id} className="hover:bg-[#f5f4f2]">
                    <td className="px-4 py-3 font-medium text-[#182844]">
                      {formatPeriod(item.period)}
                    </td>
                    <td className="px-4 py-3 text-[#444]">{item.financial_year}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-[#6e7175]">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-[#444]">
                      {item.summary.total_invoices}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#278556]">
                      {formatCurrency(item.summary.total_eligible_itc)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#db2525]">
                      {formatCurrency(item.summary.total_blocked_itc)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={downloadingId === item.reconciliation_id}
                        onClick={() => handleDownload(item)}
                        className="rounded bg-[#182844] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0f1d33] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#182844] focus:ring-offset-1"
                      >
                        {downloadingId === item.reconciliation_id ? 'Downloading…' : 'Download PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


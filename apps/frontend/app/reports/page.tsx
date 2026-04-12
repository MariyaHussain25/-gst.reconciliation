/**
 * @file apps/frontend/app/reports/page.tsx
 * @description PDF reports page — Phase 8.
 * Allows users to look up and download GST reconciliation PDF reports.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatPeriod } from '../../lib/utils';

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

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

interface ReconciliationLookupResponse {
  success: boolean;
  user_id: string;
  reconciliations: ReconciliationLookupItem[];
}

// ---------------------------------------------------------------------------
// Duration mode tab type
// ---------------------------------------------------------------------------

type DurationMode = 'fy' | 'daterange' | 'all';

// ---------------------------------------------------------------------------
// Helper — generate last 24 YYYY-MM options
// ---------------------------------------------------------------------------

function last24Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${y}-${m}`);
  }
  return result;
}

const MONTH_OPTIONS = last24Months();

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colourMap: Record<string, string> = {
    COMPLETED: 'bg-status-success-bg text-status-success-text',
    PROCESSING: 'bg-status-warning-bg text-status-warning-text',
    PENDING: 'bg-muted text-muted-foreground',
    FAILED: 'bg-status-danger-bg text-status-danger-text',
  };
  const cls = colourMap[status] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ReportsPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.push('/login');
    }
  }, [router]);
  const [mode, setMode] = useState<DurationMode>('fy');
  const [userId, setUserId] = useState('');
  const [fy, setFy] = useState('2024-25');
  const [quarter, setQuarter] = useState('Full Year');
  const [fromMonth, setFromMonth] = useState(MONTH_OPTIONS[11] ?? '');
  const [toMonth, setToMonth] = useState(MONTH_OPTIONS[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ReconciliationLookupItem[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ---- Lookup handler ----
  async function handleFind(): Promise<void> {
    if (!userId.trim()) {
      setError('Please enter a User ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setDownloadError(null);

    const params = new URLSearchParams();
    if (mode === 'fy') {
      params.set('financial_year', fy);
      if (quarter !== 'Full Year') params.set('quarter', quarter);
    } else if (mode === 'daterange') {
      params.set('date_range', `${fromMonth}_to_${toMonth}`);
    }

    try {
      const res = await fetch(
        `/api/generate-pdf/by-user/${encodeURIComponent(userId.trim())}/lookup?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
        },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as ReconciliationLookupResponse;
      setResults(data.reconciliations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  // ---- Download handler ----
  async function handleDownload(item: ReconciliationLookupItem): Promise<void> {
    setDownloadingId(item.reconciliation_id);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/generate-pdf/${encodeURIComponent(item.reconciliation_id)}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
        },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst_reconciliation_${item.reconciliation_id}_${item.period}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  // ---- Tab button helper ----
  function TabButton({
    id,
    label,
  }: {
    id: DurationMode;
    label: string;
  }): React.ReactElement {
    const active = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-surface text-foreground hover:bg-muted'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div>
      {/* Page header strip */}
      <div className="bg-primary px-8 py-6">
        <h1 className="text-2xl font-bold text-primary-foreground">PDF Reports</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">
          Generate and download GST Reconciliation Reports
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Card */}
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">

          {/* Duration Mode Tabs */}
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-foreground">Filter by</p>
            <div className="flex gap-2">
              <TabButton id="fy" label="Financial Year + Quarter" />
              <TabButton id="daterange" label="Date Range" />
              <TabButton id="all" label="All Records" />
            </div>
          </div>

          {/* FY + Quarter filters */}
          {mode === 'fy' && (
            <div className="mb-6 flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Financial Year
                </label>
                <select
                  value={fy}
                  onChange={(e) => setFy(e.target.value)}
                  className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {['2023-24', '2024-25', '2025-26'].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Quarter</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {['Full Year', 'Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'].map(
                    (q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Date Range filters */}
          {mode === 'daterange' && (
            <div className="mb-6 flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
                <select
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                  className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatPeriod(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
                <select
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatPeriod(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* User ID input */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-foreground">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your User ID"
              className="w-full max-w-sm rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleFind();
              }}
            />
          </div>

          {/* Find button */}
          <button
            type="button"
            onClick={() => void handleFind()}
            disabled={loading}
            className="flex items-center gap-2 rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? 'Searching…' : 'Find Reports'}
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mt-4 rounded-lg border border-status-danger-bg bg-status-danger-bg/20 px-4 py-3 text-sm text-status-danger-text">
            {error}
          </div>
        )}

        {/* Download error */}
        {downloadError && (
          <div className="mt-4 rounded-lg border border-status-danger-bg bg-status-danger-bg/20 px-4 py-3 text-sm text-status-danger-text">
            Download error: {downloadError}
          </div>
        )}

        {/* Empty state */}
        {results !== null && results.length === 0 && (
          <div className="mt-6 rounded-lg border border-border bg-surface p-10 text-center shadow-sm">
            <p className="text-muted-foreground">No reconciliation reports found for the selected period.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try selecting &quot;All Records&quot; to see all available reports.
            </p>
          </div>
        )}

        {/* Results table */}
        {results !== null && results.length > 0 && (
          <div className="mt-6 overflow-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  {[
                    'Period',
                    'Financial Year',
                    'Status',
                    'Created At',
                    'Total Invoices',
                    'Eligible ITC',
                    'Blocked ITC',
                    'Download',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => (
                  <tr
                    key={item.reconciliation_id}
                    className={idx % 2 === 0 ? 'bg-surface' : 'bg-muted'}
                  >
                    <td className="px-4 py-3 text-foreground">{formatPeriod(item.period)}</td>
                    <td className="px-4 py-3 text-foreground">{item.financial_year}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {item.summary.total_invoices}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(item.summary.total_eligible_itc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(item.summary.total_blocked_itc)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={
                          item.status !== 'COMPLETED' ||
                          downloadingId === item.reconciliation_id
                        }
                        onClick={() => void handleDownload(item)}
                        className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {downloadingId === item.reconciliation_id ? (
                          <svg
                            className="h-3 w-3 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                        ) : (
                          '📥'
                        )}
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

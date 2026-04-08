'use client';

/**
 * @file apps/frontend/app/itc-summary/page.tsx
 * @description ITC Summary page — fetches actual reconciliation data from the
 * backend and displays ITC available/unavailable breakdown.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabKey = 'available' | 'not-available';

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

// ─── Helper: decode user_id from JWT ─────────────────────────────────────────

function parseJwtUserId(token: string): string | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Renders a stat card with a label and value. */
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`rounded-lg border p-5 ${
        accent
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-foreground'
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          accent ? 'opacity-80' : 'text-muted-foreground'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * ITC Summary page.
 * Fetches the latest reconciliation for the logged-in user and displays
 * ITC available / not-available breakdown.
 */
export default function ITCSummaryPage(): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationLookupItem | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userId = parseJwtUserId(token);
    if (!userId) {
      router.push('/login');
      return;
    }

    void fetchITCData(token, userId);
  }, [router]);

  async function fetchITCData(token: string, userId: string): Promise<void> {
    try {
      const res = await fetch(
        `/api/generate-pdf/by-user/${encodeURIComponent(userId)}/lookup`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const body = (await res.json()) as { detail?: string; error?: string };
        throw new Error(body.detail ?? body.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ReconciliationLookupResponse;

      if (data.reconciliations.length > 0) {
        // Pick the most recently created reconciliation
        const sorted = [...data.reconciliations].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setReconciliation(sorted[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ITC data.');
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (key: TabKey) =>
    `px-6 py-3 text-sm font-semibold transition border-b-2 ${
      activeTab === key
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  const summary = reconciliation?.summary ?? null;
  const period = reconciliation?.period ?? '—';
  const financialYear = reconciliation?.financial_year ?? '—';

  return (
    <div>
      {/* Page header strip */}
      <div className="mb-6 rounded-lg bg-primary px-6 py-4">
        <nav className="mb-1 flex items-center gap-1 text-xs text-primary-foreground/70">
          <Link href="/" className="transition hover:text-primary-foreground">
            Home
          </Link>
          <span>›</span>
          <span className="text-primary-foreground">ITC Summary</span>
        </nav>
        <h1 className="text-lg font-bold text-primary-foreground">Input Tax Credit (ITC) Summary</h1>
        <p className="mt-0.5 text-sm text-primary-foreground/70">
          Period: {period} · FY {financialYear}
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-8 text-muted-foreground">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading ITC data…
        </div>
      )}

      {/* Error */}
      {error !== null && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && reconciliation === null && error === null && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted-foreground">
          No reconciliation data found. Please{' '}
          <Link href="/upload" className="font-medium text-primary hover:underline">
            upload your GST files
          </Link>{' '}
          to run reconciliation first.
        </div>
      )}

      {!loading && summary !== null && (
        <>
          {/* Tabs */}
          <div className="mb-4 flex border-b border-border">
            <button onClick={() => setActiveTab('available')} className={tabClass('available')}>
              ITC Available
            </button>
            <button
              onClick={() => setActiveTab('not-available')}
              className={tabClass('not-available')}
            >
              ITC Not Available
            </button>
          </div>

          {/* Tab panels */}
          {activeTab === 'available' ? (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Part A — ITC Available: Credit claimable in GSTR-3B
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Total Eligible ITC (₹)"
                  value={formatCurrency(summary.total_eligible_itc)}
                  accent
                />
                <StatCard
                  label="Total Invoices"
                  value={summary.total_invoices}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Matched" value={summary.matched_count} />
                <StatCard label="Fuzzy Match" value={summary.fuzzy_match_count} />
                <StatCard label="Needs Review" value={summary.needs_review_count} />
                <StatCard label="Value Mismatch" value={summary.value_mismatch_count} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ITC Not Available — Blocked &amp; Ineligible
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard label="Blocked ITC (₹)" value={formatCurrency(summary.total_blocked_itc)} />
                <StatCard label="Ineligible ITC (₹)" value={formatCurrency(summary.total_ineligible_itc)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="Missing in 2A" value={summary.missing_in_2a_count} />
                <StatCard label="Missing in 2B" value={summary.missing_in_2b_count} />
                <StatCard label="GSTIN Mismatch" value={summary.gstin_mismatch_count} />
              </div>
            </div>
          )}

          {/* Link to detailed report */}
          <div className="mt-6 rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
            Want a detailed reconciliation report?{' '}
            <Link
              href="/reports"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              Go to Reports →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

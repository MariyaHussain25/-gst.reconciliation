/**
 * @file apps/frontend/app/results/page.tsx
 * @description Reconciliation results page.
 * Uses the authenticated user_id from the JWT token,
 * fetches the latest reconciliation summary from the backend, and displays
 * matched/unmatched counts and ITC totals.
 *
 * Phase 5: Functional results view connected to the FastAPI backend.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseJwtUserId } from '../../lib/auth';
import { formatCurrency } from '../../lib/utils';
import { apiFetch } from '../../lib/api';

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

interface ProcessResponse {
  success: boolean;
  message: string;
  summary: ReconciliationSummary;
}

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

export default function ResultsPage(): React.ReactElement {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const resolvedUserId = parseJwtUserId(token)?.trim() ?? '';
    if (!resolvedUserId) {
      setError('Unable to identify your account. Please log in again.');
      return;
    }

    setUserId(resolvedUserId);
    void fetchResults(resolvedUserId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchResults(uid: string, token?: string): Promise<void> {
    if (!uid.trim()) {
      setError('Unable to identify your account. Please log in again.');
      return;
    }
    const authToken = token ?? localStorage.getItem('token') ?? '';
    if (!authToken) {
      setError('Authentication required. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await apiFetch(`/api/process/${encodeURIComponent(uid.trim())}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; detail?: string };
        throw new Error(body.error ?? body.detail ?? `Request failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as ProcessResponse;
      setSummary(data.summary as ReconciliationSummary);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-foreground">Reconciliation Results</h1>
      <p className="mb-8 text-muted-foreground">
        View matched invoices, discrepancies, and ITC eligibility breakdown.
      </p>

      {summary !== null && (
        <div className="mb-6 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
          Showing results for your account: <span className="font-semibold">{userId}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Running reconciliation…
        </div>
      )}

      {error !== null && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary !== null && (
        <div>
          {message !== null && (
            <p className="mb-6 text-sm font-medium text-muted-foreground">{message}</p>
          )}

          <h2 className="mb-3 text-lg font-semibold text-foreground">Invoice Summary</h2>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Total Invoices" value={summary.total_invoices} accent />
            <StatCard label="Matched" value={summary.matched_count} />
            <StatCard label="Fuzzy Match" value={summary.fuzzy_match_count} />
            <StatCard label="Needs Review" value={summary.needs_review_count} />
            <StatCard label="Missing in 2A" value={summary.missing_in_2a_count} />
            <StatCard label="Missing in 2B" value={summary.missing_in_2b_count} />
            <StatCard label="Value Mismatch" value={summary.value_mismatch_count} />
            <StatCard label="GSTIN Mismatch" value={summary.gstin_mismatch_count} />
          </div>

          <h2 className="mb-3 text-lg font-semibold text-foreground">ITC Summary</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Eligible ITC (₹)"
              value={formatCurrency(summary.total_eligible_itc)}
              accent
            />
            <StatCard
              label="Blocked ITC (₹)"
              value={formatCurrency(summary.total_blocked_itc)}
            />
            <StatCard
              label="Ineligible ITC (₹)"
              value={formatCurrency(summary.total_ineligible_itc)}
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
            Want a detailed PDF report?{' '}
            <Link href="/reports" className="font-medium text-primary underline underline-offset-2 hover:opacity-80">
              Go to Reports →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

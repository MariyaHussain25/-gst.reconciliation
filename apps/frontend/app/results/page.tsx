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
import { Loader2 } from 'lucide-react';
import { parseJwtUserId } from '../../lib/auth';
import { formatCurrency } from '../../lib/utils';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

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
      style={{
        background: accent ? 'rgba(229,62,62,0.07)' : '#1a1a1a',
        border: `1px solid ${accent ? 'rgba(229,62,62,0.22)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, color: accent ? '#e53e3e' : '#444', letterSpacing: '0.09em', textTransform: 'uppercase', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 21, fontWeight: 700, color: '#f0f0f0', marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </p>
    </div>
  );
}

export default function ResultsPage(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      void router.push('/login');
      return;
    }

    const resolvedUserId = parseJwtUserId(token)?.trim() ?? '';
    if (!resolvedUserId) {
      setError('Unable to identify your account. Please log in again.');
      return;
    }

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
      const res = await apiFetch(`/api/generate-pdf/by-user/${encodeURIComponent(uid.trim())}/lookup`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, `Request failed (HTTP ${res.status})`));
      }
      const data = await readApiJson<ReconciliationLookupResponse>(res);
      if (!data.reconciliations || data.reconciliations.length === 0) {
        setError('No reconciliation results found. Please upload your files and run reconciliation first.');
        return;
      }
      // Show the most recent reconciliation
      const latest = data.reconciliations.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      setSummary(latest.summary);
      setMessage(`Reconciliation for period ${latest.period} (FY ${latest.financial_year}) — ${latest.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>
        Reconciliation Results
      </h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        Matched invoices, discrepancies, and ITC eligibility breakdown.
      </p>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#555', fontSize: 14, padding: '20px 0' }}>
          <Loader2 size={18} className="animate-spin" />
          Loading results…
        </div>
      )}

      {error !== null && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {summary !== null && (
        <div>
          {message !== null && (
            <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: '#555', marginBottom: 28, fontFamily: "'JetBrains Mono', monospace" }}>
              {message}
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 600, color: '#444', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>
            Invoice Summary
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10, marginBottom: 32 }}>
            <StatCard label="Total Invoices" value={summary.total_invoices} accent />
            <StatCard label="Matched" value={summary.matched_count} />
            <StatCard label="Fuzzy Match" value={summary.fuzzy_match_count} />
            <StatCard label="Needs Review" value={summary.needs_review_count} />
            <StatCard label="Missing in 2A" value={summary.missing_in_2a_count} />
            <StatCard label="Missing in 2B" value={summary.missing_in_2b_count} />
            <StatCard label="Value Mismatch" value={summary.value_mismatch_count} />
            <StatCard label="GSTIN Mismatch" value={summary.gstin_mismatch_count} />
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#444', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>
            ITC Summary
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 32 }}>
            <StatCard label="Eligible ITC (₹)" value={formatCurrency(summary.total_eligible_itc)} accent />
            <StatCard label="Blocked ITC (₹)" value={formatCurrency(summary.total_blocked_itc)} />
            <StatCard label="Ineligible ITC (₹)" value={formatCurrency(summary.total_ineligible_itc)} />
          </div>

          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#555' }}>
            Want the detailed PDF report?{' '}
            <Link
              href="/reports"
              style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
            >
              Go to Reports →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

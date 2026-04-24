'use client';

/**
 * @file apps/frontend/app/itc-summary/page.tsx
 * @description ITC Summary page — fetches actual reconciliation data from the
 * backend and displays ITC available/unavailable breakdown.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { clearSessionAndRedirectToLogin, isTokenValid, parseJwtUserId } from '../../lib/auth';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

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

// Imported from ../../lib/auth

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
      style={{
        background: accent ? 'rgba(8,145,178,0.07)' : '#ffffff',
        border: `1px solid ${accent ? 'rgba(8,145,178,0.22)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, color: accent ? '#0891b2' : '#64748b', letterSpacing: '0.09em', textTransform: 'uppercase', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 21, fontWeight: 700, color: '#0f172a', marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </p>
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

  // 401 redirects are centralized in apiFetch, so this callback has no router dependency.
  const fetchITCData = useCallback(async (token: string, userId: string): Promise<void> => {
    try {
      const res = await apiFetch(
        `/api/generate-pdf/by-user/${encodeURIComponent(userId)}/lookup`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, `Request failed (${res.status})`));
      }

      const data = await readApiJson<ReconciliationLookupResponse>(res);

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
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!isTokenValid(token)) {
      clearSessionAndRedirectToLogin(router.push, { sessionExpired: true });
      return;
    }

    const userId = parseJwtUserId(token);
    if (!userId) {
      router.push('/login');
      return;
    }

    void fetchITCData(token, userId);
  }, [fetchITCData, router]);

  const summary = reconciliation?.summary ?? null;
  const period = reconciliation?.period ?? '—';
  const financialYear = reconciliation?.financial_year ?? '—';

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>ITC Summary</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>Input Tax Credit breakdown from your latest reconciliation.</p>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: '#64748b' }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading ITC data…</span>
        </div>
      )}

      {/* Error */}
      {error !== null && !loading && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '14px 18px', color: '#dc2626', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && reconciliation === null && error === null && (
        <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          No reconciliation data found. Please{' '}
          <Link href="/upload" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            upload your GST files
          </Link>{' '}
          to run reconciliation first.
        </div>
      )}

      {/* Data */}
      {!loading && summary !== null && (
        <>
          {/* Period info */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <span style={{ background: '#f0f9ff', border: '1px solid rgba(8,145,178,0.15)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#0891b2' }}>
              Period: <strong style={{ color: '#0c4a6e' }}>{period}</strong>
            </span>
            <span style={{ background: '#f0f9ff', border: '1px solid rgba(8,145,178,0.15)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#0891b2' }}>
              FY: <strong style={{ color: '#0c4a6e' }}>{financialYear}</strong>
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 24 }}>
            {(['available', 'not-available'] as TabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  color: activeTab === tab ? '#0891b2' : '#64748b',
                  borderBottom: activeTab === tab ? '2px solid #0891b2' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                }}
              >
                {tab === 'available' ? 'ITC Available' : 'ITC Not Available'}
              </button>
            ))}
          </div>

          {/* Tab: Available */}
          {activeTab === 'available' && (
            <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '22px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 18 }}>
                Part A — ITC Available: Credit claimable in GSTR-3B
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                <StatCard label="Total Eligible ITC (₹)" value={formatCurrency(summary.total_eligible_itc)} accent />
                <StatCard label="Total Invoices" value={summary.total_invoices} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                <StatCard label="Matched" value={summary.matched_count} />
                <StatCard label="Fuzzy Match" value={summary.fuzzy_match_count} />
                <StatCard label="Needs Review" value={summary.needs_review_count} />
                <StatCard label="Value Mismatch" value={summary.value_mismatch_count} />
              </div>
            </div>
          )}

          {/* Tab: Not Available */}
          {activeTab === 'not-available' && (
            <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '22px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 18 }}>
                Part B — ITC Not Available / Blocked
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                <StatCard label="Total Blocked ITC (₹)" value={formatCurrency(summary.total_blocked_itc)} accent />
                <StatCard label="Total Ineligible ITC (₹)" value={formatCurrency(summary.total_ineligible_itc)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                <StatCard label="Missing in 2A" value={summary.missing_in_2a_count} />
                <StatCard label="Missing in 2B" value={summary.missing_in_2b_count} />
                <StatCard label="GSTIN Mismatch" value={summary.gstin_mismatch_count} />
              </div>
            </div>
          )}

          {/* Go to Reports */}
          <p style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>
            View the full reconciliation report in{' '}
            <Link href="/reports" style={{ color: '#3b82f6', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              Reports
            </Link>.
          </p>
        </>
      )}
    </div>
  );
}

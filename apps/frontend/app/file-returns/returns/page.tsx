'use client';

/**
 * @file apps/frontend/app/file-returns/returns/page.tsx
 * @description Returns List page — fetches live data from MongoDB for the
 * selected period. Shows GSTR-1, GSTR-2A, GSTR-2B, GSTR-3B with real
 * filing status and record-count pills.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { FilingStatusBadge, type FilingStatus } from '../../../components/ui/StatusBadge';
import { apiFetch } from '../../../lib/api';
import { isTokenValid, parseJwtUserId } from '../../../lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReturnRow {
  type: string;
  description: string;
  frequency: string;
  status: FilingStatus | null;
  record_count: number | null;
  detail_href: string;
}

// ── Period helpers ───────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

/** Converts FY (e.g. "2024-25") + month name → "YYYY-MM" period string. */
function toPeriod(fy: string, month: string): string {
  const monthNum = MONTH_MAP[month] ?? 7;
  const startYear = parseInt(fy.split('-')[0], 10);
  const year = monthNum >= 4 ? startYear : startYear + 1;
  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

/** Formats a period string "YYYY-MM" to a human-readable label. */
function periodLabel(fy: string, month: string): string {
  const monthNum = MONTH_MAP[month] ?? 7;
  const startYear = parseInt(fy.split('-')[0], 10);
  const year = monthNum >= 4 ? startYear : startYear + 1;
  const quarter = monthNum <= 6 && monthNum >= 4 ? 'Q1'
    : monthNum <= 9 && monthNum >= 7 ? 'Q2'
    : monthNum <= 12 && monthNum >= 10 ? 'Q3'
    : 'Q4';
  return `${month} ${year} · ${quarter} · FY ${fy}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const PILL_FREQ: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 500,
  color: '#555',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 4,
  padding: '2px 8px',
};

const PILL_COUNT: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  color: '#3b82f6',
  background: 'rgba(59,130,246,0.1)',
  border: '1px solid rgba(59,130,246,0.18)',
  borderRadius: 4,
  padding: '2px 8px',
};

const BTN_VIEW: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#e53e3e',
  background: 'rgba(229,62,62,0.08)',
  border: '1px solid rgba(229,62,62,0.25)',
  borderRadius: 5,
  padding: '5px 14px',
  cursor: 'pointer',
  textDecoration: 'none',
};

const BTN_DOWNLOAD: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#888',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  padding: '5px 14px',
  cursor: 'pointer',
};

// ── Main component (inside Suspense for useSearchParams) ─────────────────────

function ReturnsListInner(): React.ReactElement {
  const searchParams = useSearchParams();
  const fy = searchParams.get('fy') ?? '2024-25';
  const month = searchParams.get('month') ?? 'July';
  const period = toPeriod(fy, month);

  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token || !isTokenValid(token)) {
        setError('Not authenticated');
        return;
      }
      const userId = parseJwtUserId(token);
      if (!userId) { setError('Invalid session'); return; }

      const res = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/returns-summary/${userId}?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) { setError('Failed to load returns data'); return; }
      const json = await res.json() as { success: boolean; returns: ReturnRow[] };
      if (!json.success) { setError('Failed to load returns data'); return; }
      setRows(json.returns);
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void fetchReturns(); }, [fetchReturns]);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555', marginBottom: 10 }}>
          <Link href="/" style={{ color: '#e53e3e', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href="/file-returns" style={{ color: '#e53e3e', textDecoration: 'none' }}>File Returns</Link>
          <span>›</span>
          <span>Returns List</span>
        </nav>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', margin: 0, marginBottom: 4 }}>File Returns</h1>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Period: {periodLabel(fy, month)}</p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: '20px 24px',
              borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', justifyContent: 'space-between', gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ width: 80, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ width: '60%', height: 11, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ width: 60, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ width: 60, height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
                <div style={{ width: 120, height: 26, background: 'rgba(255,255,255,0.04)', borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#e53e3e', fontSize: 13, margin: 0 }}>{error}</p>
          <button
            onClick={() => void fetchReturns()}
            style={{ marginTop: 12, fontSize: 12, color: '#888', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '5px 14px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Returns list */}
      {!loading && !error && (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {rows.map((ret, i) => (
            <div
              key={ret.type}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                padding: '20px 24px',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              {/* Left: name + description + pills */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', margin: 0, marginBottom: 3 }}>{ret.type}</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0, marginBottom: 8, lineHeight: 1.5 }}>{ret.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={PILL_FREQ}>{ret.frequency}</span>
                  {ret.record_count !== null && ret.record_count > 0 && (
                    <span style={PILL_COUNT}>{ret.record_count.toLocaleString()} records</span>
                  )}
                  {ret.record_count === 0 && (
                    <span style={{ ...PILL_COUNT, color: '#555', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      No data
                    </span>
                  )}
                </div>
              </div>

              {/* Right: status badge + actions */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                {ret.status && <FilingStatusBadge status={ret.status} />}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={ret.detail_href} style={BTN_VIEW}>VIEW</Link>
                  <button style={BTN_DOWNLOAD}>DOWNLOAD</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page export wrapped in Suspense (required for useSearchParams) ────────────

export default function ReturnsListPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#555', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <ReturnsListInner />
    </Suspense>
  );
}

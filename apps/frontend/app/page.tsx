/**
 * @file apps/frontend/app/page.tsx
 * @description Main GST Reconciliation Dashboard â€” live data from MongoDB.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MatchStatusBadge, ReconStatusBadge } from '../components/ui/StatusBadge';
import { apiFetch, readApiErrorMessage, readApiJson } from '../lib/api';
import { parseJwtUserId } from '../lib/auth';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DashboardStats {
  total_invoices: number;
  matched_count: number;
  needs_review_count: number;
  missing_in_2b_count: number;
  total_eligible_itc: number;
}

interface RecentResult {
  vendor_name: string;
  match_status: string;
  period: string;
}

interface RecentRun {
  reconciliation_id: string;
  period: string;
  financial_year: string;
  status: string;
  matched_count: number;
  total_invoices: number;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  recent_results: RecentResult[];
  recent_runs: RecentRun[];
  financial_year: string;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtPeriod(period: string): string {
  // period is YYYY-MM  â†’  "Apr 2025"
  if (!period || !period.includes('-')) return period;
  const [year, month] = period.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = parseInt(month, 10);
  return `${months[m - 1] ?? month} ${year}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Skeleton({ w, h }: { w?: string | number; h?: string | number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: w ?? '100%',
        height: h ?? 16,
        borderRadius: 6,
        background: 'rgba(255,255,255,0.06)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage(): React.ReactElement {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const userId = parseJwtUserId(token);
    if (!userId) return;

    apiFetch(`/api/dashboard/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, 'Failed to load dashboard data.'));
        }
        return readApiJson<DashboardData>(res);
      })
      .then((json: DashboardData) => setData(json))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const fy = data?.financial_year ?? 'â€”';

  // â”€â”€ Stat cards config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statCards = [
    {
      label: 'Total Invoices',
      value: loading ? null : (stats?.total_invoices ?? 0),
      topColor: 'linear-gradient(90deg, #e53e3e, #3b82f6)',
      valueColor: '#f0f0f0',
      sub: `FY ${fy}`,
      subColor: '#444444',
    },
    {
      label: 'Matched',
      value: loading ? null : (stats?.matched_count ?? 0),
      topColor: '#22c55e',
      valueColor: '#22c55e',
      sub: stats && stats.total_invoices > 0
        ? `${Math.round((stats.matched_count / stats.total_invoices) * 100)}% match rate`
        : 'â€”',
      subColor: '#22c55e',
    },
    {
      label: 'Needs Review',
      value: loading ? null : (stats?.needs_review_count ?? 0),
      topColor: '#f59e0b',
      valueColor: '#f59e0b',
      sub: 'Fuzzy or mismatch',
      subColor: '#f59e0b',
    },
    {
      label: 'Missing in 2B',
      value: loading ? null : (stats?.missing_in_2b_count ?? 0),
      topColor: '#e53e3e',
      valueColor: '#e53e3e',
      sub: 'Not in GSTR-2B',
      subColor: '#e53e3e',
    },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* â”€â”€ Page header â”€â”€ */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p
            style={{
              fontSize: 11,
              color: '#555555',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Financial Year {fy}
          </p>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Dashboard
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/upload" className="btn-primary" style={{ fontSize: 13 }}>
            + Upload Files
          </Link>
          <Link href="/results" className="btn-secondary" style={{ fontSize: 13 }}>
            Run Reconciliation
          </Link>
        </div>
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: 13, padding: '10px 16px', background: 'rgba(229,62,62,0.08)', borderRadius: 8, border: '1px solid rgba(229,62,62,0.2)' }}>
          {error}
        </p>
      )}

      {/* â”€â”€ Stats row â”€â”€ */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '20px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 2,
                background: card.topColor,
                borderRadius: '12px 12px 0 0',
              }}
            />
            <p
              style={{
                color: '#555555',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {card.label}
            </p>
            <p
              style={{
                color: card.valueColor,
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              {card.value === null ? <Skeleton w={64} h={32} /> : card.value.toLocaleString()}
            </p>
            <p style={{ color: card.subColor, fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              {loading ? <Skeleton w={80} h={12} /> : card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* â”€â”€ Two-column grid â”€â”€ */}
      <div className="two-col-grid">

        {/* Left â€” Recent Runs */}
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.01em' }}>
                Recent Runs
              </p>
              <p style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>Last 5 reconciliation jobs</p>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(59,130,246,0.1)',
                color: '#3b82f6',
                border: '1px solid rgba(59,130,246,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Live
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#141414' }}>
                  {['Period', 'FY', 'Status', 'Matched / Total', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#555555',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} style={{ padding: '12px 16px' }}>
                          <Skeleton w={j === 2 ? 70 : j === 3 ? 60 : 80} h={14} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data?.recent_runs?.length ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#444444', fontSize: 13 }}>
                      No reconciliation runs yet.{' '}
                      <Link href="/upload" style={{ color: '#3b82f6' }}>Upload files</Link> to get started.
                    </td>
                  </tr>
                ) : (
                  data.recent_runs.map((run, idx) => (
                    <tr
                      key={run.reconciliation_id}
                      style={{
                        borderBottom: idx < data.recent_runs.length - 1
                          ? '1px solid rgba(255,255,255,0.04)'
                          : 'none',
                      }}
                    >
                      <td style={{ padding: '11px 16px', color: '#e0e0e0', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {fmtPeriod(run.period)}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#666666', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, whiteSpace: 'nowrap' }}>
                        {run.financial_year}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <ReconStatusBadge status={run.status} />
                      </td>
                      <td style={{ padding: '11px 16px', color: '#888888', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, whiteSpace: 'nowrap' }}>
                        {run.matched_count} / {run.total_invoices}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#555555', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {fmtDate(run.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/upload" className="btn-primary" style={{ fontSize: 12 }}>Upload Files</Link>
            <Link href="/results" className="btn-secondary" style={{ fontSize: 12 }}>Run Reconciliation</Link>
            <Link href="/reports" className="btn-secondary" style={{ fontSize: 12 }}>Download Report</Link>
          </div>
        </div>

        {/* Right â€” Recent Supplier Results */}
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.01em' }}>
              Recent Reconciliation
            </p>
            <p style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>FY {fy}</p>
          </div>

          <div style={{ flex: 1 }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 20px',
                    borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <Skeleton w={160} h={14} />
                  <Skeleton w={72} h={22} />
                </div>
              ))
            ) : !data?.recent_results?.length ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#444444', fontSize: 13 }}>
                No results yet. Run a reconciliation to see supplier matches.
              </div>
            ) : (
              data.recent_results.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: idx < data.recent_results.length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                    transition: 'background 0.12s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 13, color: '#d0d0d0', fontWeight: 500 }}>
                    {row.vendor_name}
                  </span>
                  <MatchStatusBadge status={row.match_status} />
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link href="/results" className="btn-secondary" style={{ fontSize: 12 }}>
              View all results â†’
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

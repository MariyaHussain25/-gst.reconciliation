/**
 * @file apps/frontend/app/reports/page.tsx
 * @description PDF reports page — Phase 8.
 * Allows users to look up and download GST reconciliation PDF reports.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { parseJwtUserId } from '../../lib/auth';
import { formatCurrency, formatPeriod } from '../../lib/utils';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

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
  const map: Record<string, { bg: string; color: string }> = {
    COMPLETED: { bg: 'rgba(22,163,74,0.12)',   color: '#15803d' },
    PROCESSING: { bg: 'rgba(245,158,11,0.12)',  color: '#b45309' },
    PENDING:    { bg: 'rgba(0,0,0,0.05)', color: '#64748b' },
    FAILED:     { bg: 'rgba(220,38,38,0.10)',   color: '#dc2626' },
  };
  const s = map[status] ?? { bg: 'rgba(0,0,0,0.05)', color: '#64748b' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ReportsPage(): React.ReactElement {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const resolvedUserId = parseJwtUserId(storedToken)?.trim() ?? '';
    if (!resolvedUserId) {
      setError('Unable to identify your account. Please log in again.');
      return;
    }

    setToken(storedToken);
    setUserId(resolvedUserId);
  }, [router]);
  const [mode, setMode] = useState<DurationMode>('fy');
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
      setError('Unable to identify your account. Please log in again.');
      return;
    }
    if (!token) {
      setError('Authentication required. Please log in again.');
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
      const res = await apiFetch(
        `/api/generate-pdf/by-user/${encodeURIComponent(userId.trim())}/lookup?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, `Request failed (${res.status})`));
      }
      const data = await readApiJson<ReconciliationLookupResponse>(res);
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
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }
      const res = await apiFetch(
        `/api/generate-pdf/${encodeURIComponent(item.reconciliation_id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, `Download failed (${res.status})`));
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

  const selectSt: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: '8px 10px',
    color: '#0f172a',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
    minWidth: 160,
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>PDF Reports</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>Look up and download GST reconciliation PDF reports.</p>

      {/* Filter card */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '20px 22px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>Filter by</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['fy', 'daterange', 'all'] as DurationMode[]).map((id) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 7,
                  border: `1px solid ${active ? 'rgba(8,145,178,0.3)' : 'rgba(0,0,0,0.08)'}`,
                  background: active ? 'rgba(8,145,178,0.08)' : 'transparent',
                  color: active ? '#0891b2' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {id === 'fy' ? 'Financial Year + Quarter' : id === 'daterange' ? 'Date Range' : 'All Records'}
              </button>
            );
          })}
        </div>

        {mode === 'fy' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Financial Year</label>
              <select value={fy} onChange={(e) => setFy(e.target.value)} style={selectSt}>
                {['2023-24', '2024-25', '2025-26'].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Quarter</label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} style={selectSt}>
                {['Full Year', 'Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>
        )}

        {mode === 'daterange' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>From</label>
              <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} style={selectSt}>
                {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{formatPeriod(m)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>To</label>
              <select value={toMonth} onChange={(e) => setToMonth(e.target.value)} style={selectSt}>
                {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{formatPeriod(m)}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Account</label>
            <p style={{ fontSize: 12, color: '#475569', fontFamily: "'JetBrains Mono', monospace", background: '#f8fafc', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '9px 12px', margin: 0 }}>
              {userId || 'Loading\u2026'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleFind()}
            disabled={loading}
            className="btn-primary"
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Searching\u2026</> : 'Find Reports'}
          </button>
        </div>
      </div>

      {(error !== null || downloadError !== null) && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
          {error ?? downloadError}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>No reconciliation reports found for the selected period.</p>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Try &quot;All Records&quot; to see everything.</p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {['Period', 'FY', 'Status', 'Date', 'Invoices', 'Eligible ITC', 'Blocked ITC', ''].map((h) => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', background: '#f8fafc', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr
                  key={item.reconciliation_id}
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: idx % 2 === 0 ? '#f8fafc' : '#ffffff', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(8,145,178,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? '#f8fafc' : '#ffffff'; }}
                >
                  <td style={{ padding: '11px 14px', color: '#0f172a', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{formatPeriod(item.period)}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{item.financial_year}</td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={item.status} /></td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#475569', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{item.summary.total_invoices}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{formatCurrency(item.summary.total_eligible_itc)}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#f87171', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{formatCurrency(item.summary.total_blocked_itc)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      type="button"
                      disabled={item.status !== 'COMPLETED' || downloadingId === item.reconciliation_id}
                      onClick={() => void handleDownload(item)}
                      className="btn-primary"
                      style={{ padding: '5px 12px', fontSize: 11, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 4, opacity: (item.status !== 'COMPLETED' || downloadingId === item.reconciliation_id) ? 0.4 : 1, pointerEvents: (item.status !== 'COMPLETED' || downloadingId === item.reconciliation_id) ? 'none' : 'auto' }}
                    >
                      {downloadingId === item.reconciliation_id
                        ? <><Loader2 size={11} className="animate-spin" /> Downloading\u2026</>
                        : <>\u2193 PDF</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

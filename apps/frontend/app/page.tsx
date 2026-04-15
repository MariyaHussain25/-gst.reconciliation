/**
 * @file apps/frontend/app/page.tsx
 * @description Main GST Reconciliation Dashboard.
 * Phase 12: Stats row (4 cards) + two-column grid (Returns Calendar + Recent Results).
 */

'use client';

import Link from 'next/link';
import { FilingStatusBadge, type FilingStatus } from '../components/ui/StatusBadge';

const FINANCIAL_YEAR = '2024-25';

const PERIODS = ['Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25'] as const;

interface ReturnRow {
  type: string;
  description: string;
  statuses: FilingStatus[];
}

const RETURN_ROWS: ReturnRow[] = [
  {
    type: 'GSTR-1',
    description: 'Details of outward supplies',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2A',
    description: 'Auto drafted – view only',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'To be Filed'],
  },
  {
    type: 'GSTR-2B',
    description: 'Auto-drafted ITC statement',
    statuses: ['Filed', 'Filed', 'Filed', 'Filed', 'Not Filed'],
  },
  {
    type: 'GSTR-3B',
    description: 'Monthly summary return',
    statuses: ['Filed', 'Filed', 'Filed', 'To be Filed', 'Not Filed'],
  },
];

interface ReconRow {
  supplier: string;
  status: 'Matched' | 'Fuzzy' | 'Missing 2B' | 'Value diff';
}

const RECON_ROWS: ReconRow[] = [
  { supplier: 'Infosys BPO Ltd', status: 'Matched' },
  { supplier: 'TCS Infrastructure', status: 'Fuzzy' },
  { supplier: 'Wipro Enterprises', status: 'Missing 2B' },
  { supplier: 'HCL Technologies', status: 'Matched' },
  { supplier: 'Reliance Retail Ltd', status: 'Value diff' },
];

const STATUS_DOT: Record<ReconRow['status'], string> = {
  Matched:     '#16a34a',
  Fuzzy:       '#d97706',
  'Missing 2B':'#dc2626',
  'Value diff':'#d97706',
};

const STATUS_BADGE: Record<ReconRow['status'], { bg: string; color: string }> = {
  Matched:      { bg: '#dcfce7', color: '#15803d' },
  Fuzzy:        { bg: '#fef9c3', color: '#92400e' },
  'Missing 2B': { bg: '#fee2e2', color: '#b91c1c' },
  'Value diff': { bg: '#fef9c3', color: '#92400e' },
};

export default function DashboardPage(): React.ReactElement {
  return (
    <div>
      {/* Stats row — 4 cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Card 1 — Total Invoices (navy accent) */}
        <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '16px 18px' }}>
          <p
            style={{
              color: '#94a3b8',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Total Invoices
          </p>
          <p style={{ color: '#fff', fontSize: 26, fontWeight: 600, lineHeight: 1 }}>247</p>
          <p style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>FY {FINANCIAL_YEAR}</p>
        </div>

        {/* Card 2 — Matched */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            padding: '16px 18px',
          }}
        >
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Matched
          </p>
          <p style={{ color: '#16a34a', fontSize: 26, fontWeight: 600, lineHeight: 1 }}>198</p>
          <p style={{ color: '#16a34a', fontSize: 11, marginTop: 4 }}>80% match rate</p>
        </div>

        {/* Card 3 — Mismatched */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            padding: '16px 18px',
          }}
        >
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Mismatched
          </p>
          <p style={{ color: '#dc2626', fontSize: 26, fontWeight: 600, lineHeight: 1 }}>23</p>
          <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Needs review</p>
        </div>

        {/* Card 4 — Missing */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            padding: '16px 18px',
          }}
        >
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Missing
          </p>
          <p style={{ color: '#d97706', fontSize: 26, fontWeight: 600, lineHeight: 1 }}>26</p>
          <p style={{ color: '#d97706', fontSize: 11, marginTop: 4 }}>Not in GSTR-2B</p>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Left — Returns Calendar */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '0.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Returns Calendar — FY {FINANCIAL_YEAR}
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '8px 14px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-page)',
                      borderBottom: '0.5px solid var(--border)',
                    }}
                  >
                    Return
                  </th>
                  {PERIODS.map((p) => (
                    <th
                      key={p}
                      style={{
                        padding: '8px 10px',
                        textAlign: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-page)',
                        borderBottom: '0.5px solid var(--border)',
                      }}
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RETURN_ROWS.map((row, idx) => (
                  <tr
                    key={row.type}
                    style={{
                      borderBottom: idx < RETURN_ROWS.length - 1 ? '0.5px solid var(--border)' : 'none',
                    }}
                  >
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                        {row.type}
                      </span>
                    </td>
                    {row.statuses.map((status, i) => (
                      <td key={i} style={{ padding: '9px 10px', textAlign: 'center' }}>
                        <FilingStatusBadge status={status} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '0.5px solid var(--border)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/upload" className="btn-primary">
              Upload Files
            </Link>
            <Link href="/results" className="btn-secondary">
              Run Reconciliation
            </Link>
            <Link href="/reports" className="btn-secondary">
              Download Report
            </Link>
          </div>
        </div>

        {/* Right — Recent Reconciliation Results */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '0.5px solid var(--border)',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Recent Reconciliation Results
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              FY {FINANCIAL_YEAR}
            </p>
          </div>

          <div style={{ padding: '8px 0' }}>
            {RECON_ROWS.map((row) => {
              const dotColor = STATUS_DOT[row.status];
              const badge = STATUS_BADGE[row.status];
              return (
                <div
                  key={row.supplier}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 18px',
                    borderBottom: '0.5px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {row.supplier}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      background: badge.bg,
                      color: badge.color,
                      borderRadius: 20,
                      padding: '2px 8px',
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '12px 18px' }}>
            <Link href="/results" className="btn-secondary" style={{ fontSize: 12 }}>
              View all results →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

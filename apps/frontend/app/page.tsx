/**
 * @file apps/frontend/app/page.tsx
 * @description Main GST Reconciliation Dashboard.
 * Revamp: Black/dark-grey SaaS design system with red + blue accents.
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
  Matched:     '#22c55e',
  Fuzzy:       '#f59e0b',
  'Missing 2B':'#e53e3e',
  'Value diff':'#f59e0b',
};

const STATUS_BADGE: Record<ReconRow['status'], { bg: string; color: string; border: string }> = {
  Matched:      { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  Fuzzy:        { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  'Missing 2B': { bg: 'rgba(229,62,62,0.1)',  color: '#f87171', border: 'rgba(229,62,62,0.25)' },
  'Value diff': { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
};

export default function DashboardPage(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ── */}
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
            Financial Year {FINANCIAL_YEAR}
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

      {/* ── Stats row: 4 metric cards ── */}
      <div className="stats-grid">
        {/* Total Invoices */}
        <div
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
              background: 'linear-gradient(90deg, #e53e3e, #3b82f6)',
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
            Total Invoices
          </p>
          <p
            style={{
              color: '#f0f0f0',
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            247
          </p>
          <p style={{ color: '#444444', fontSize: 12, marginTop: 8 }}>FY {FINANCIAL_YEAR}</p>
        </div>

        {/* Matched */}
        <div
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
              background: '#22c55e',
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
            Matched
          </p>
          <p
            style={{
              color: '#22c55e',
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            198
          </p>
          <p style={{ color: '#22c55e', fontSize: 12, marginTop: 8, opacity: 0.7 }}>80% match rate</p>
        </div>

        {/* Mismatched */}
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(229,62,62,0.15)',
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
              background: '#e53e3e',
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
            Mismatched
          </p>
          <p
            style={{
              color: '#e53e3e',
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            23
          </p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 11,
              color: '#e53e3e',
              background: 'rgba(229,62,62,0.1)',
              border: '1px solid rgba(229,62,62,0.2)',
              borderRadius: 20,
              padding: '2px 9px',
            }}
          >
            Needs review
          </span>
        </div>

        {/* Missing */}
        <div
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
              background: '#f59e0b',
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
            Missing
          </p>
          <p
            style={{
              color: '#f59e0b',
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            26
          </p>
          <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 8, opacity: 0.7 }}>Not in GSTR-2B</p>
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="two-col-grid">

        {/* Left — Returns Calendar */}
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
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#f0f0f0',
                  letterSpacing: '-0.01em',
                }}
              >
                Returns Calendar
              </p>
              <p style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>FY {FINANCIAL_YEAR}</p>
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
                  <th
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#555555',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    Return
                  </th>
                  {PERIODS.map((p) => (
                    <th
                      key={p}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#555555',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                      borderBottom:
                        idx < RETURN_ROWS.length - 1
                          ? '1px solid rgba(255,255,255,0.04)'
                          : 'none',
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: '#e0e0e0',
                          fontSize: 12,
                          display: 'block',
                        }}
                      >
                        {row.type}
                      </span>
                      <span style={{ fontSize: 10, color: '#444444' }}>{row.description}</span>
                    </td>
                    {row.statuses.map((status, i) => (
                      <td key={i} style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <FilingStatusBadge status={status} />
                      </td>
                    ))}
                  </tr>
                ))}
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
            <Link href="/upload" className="btn-primary" style={{ fontSize: 12 }}>
              Upload Files
            </Link>
            <Link href="/results" className="btn-secondary" style={{ fontSize: 12 }}>
              Run Reconciliation
            </Link>
            <Link href="/reports" className="btn-secondary" style={{ fontSize: 12 }}>
              Download Report
            </Link>
          </div>
        </div>

        {/* Right — Recent Reconciliation Results */}
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
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#f0f0f0',
                letterSpacing: '-0.01em',
              }}
            >
              Recent Reconciliation
            </p>
            <p style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>FY {FINANCIAL_YEAR}</p>
          </div>

          <div style={{ flex: 1 }}>
            {RECON_ROWS.map((row, idx) => {
              const dotColor = STATUS_DOT[row.status];
              const badge = STATUS_BADGE[row.status];
              return (
                <div
                  key={row.supplier}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom:
                      idx < RECON_ROWS.length - 1
                        ? '1px solid rgba(255,255,255,0.04)'
                        : 'none',
                    transition: 'background 0.12s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      'rgba(255,255,255,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                        boxShadow: `0 0 6px ${dotColor}60`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: '#d0d0d0',
                        fontWeight: 500,
                      }}
                    >
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
                      padding: '3px 10px',
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Link href="/results" className="btn-secondary" style={{ fontSize: 12 }}>
              View all results →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

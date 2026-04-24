/**
 * @file apps/frontend/app/gstr2a/page.tsx
 * @description GSTR-2A Detail View — fetches actual reconciliation data for
 * the logged-in user and navigates inward supply sections.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearSessionAndRedirectToLogin, isTokenValid, parseJwtUserId } from '../../lib/auth';
import { apiFetch, readApiErrorMessage, readApiJson } from '../../lib/api';

interface Section {
  id: string;
  title: string;
  subtitle: string;
}

interface SectionGroup {
  part: string;
  label: string;
  sections: Section[];
}

const SECTION_GROUPS: SectionGroup[] = [
  {
    part: 'PART-A',
    label: 'Supplies from Registered Taxpayers',
    sections: [
      {
        id: 'b2b',
        title: 'B2B Invoices',
        subtitle: 'Tax invoices from registered suppliers',
      },
      {
        id: 'cdn',
        title: 'Credit / Debit Notes',
        subtitle: 'Credit and debit notes received',
      },
      {
        id: 'amend-b2b',
        title: 'Amendments to B2B Invoices',
        subtitle: 'Revised B2B invoices filed by suppliers',
      },
      {
        id: 'amend-cdn',
        title: 'Amendments to Credit / Debit Notes',
        subtitle: 'Revised credit and debit notes',
      },
    ],
  },
  {
    part: 'PART-B',
    label: 'Input Service Distributor Credits',
    sections: [
      {
        id: 'isd',
        title: 'ISD Credits',
        subtitle: 'Input service distributor credit entries',
      },
      {
        id: 'amend-isd',
        title: 'Amendments to ISD Credits',
        subtitle: 'Revised ISD credit entries',
      },
    ],
  },
  {
    part: 'PART-C',
    label: 'Inward Supplies — Unregistered / Import',
    sections: [
      {
        id: 'impg',
        title: 'Import of Goods',
        subtitle: 'Goods imported through ICEGATE portal',
      },
      {
        id: 'impgsez',
        title: 'Import of Goods from SEZ',
        subtitle: 'Goods imported from SEZ units / developers',
      },
    ],
  },
];

interface ReconciliationSummary {
  total_invoices: number;
  matched_count: number;
  missing_in_2a_count: number;
  missing_in_2b_count: number;
  total_eligible_itc: number;
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

// parseJwtUserId is imported from ../../lib/auth

/**
 * GSTR-2A detail view.
 * Shows actual FY / period metadata from the latest reconciliation,
 * a read-only note banner, and section navigation cards.
 */
export default function GSTR2APage(): React.ReactElement {
  const router = useRouter();
  const [reconciliation, setReconciliation] = useState<ReconciliationLookupItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 401 redirects are centralized in apiFetch, so this callback has no router dependency.
  const fetchReconciliationData = useCallback(async (token: string, userId: string): Promise<void> => {
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
        const sorted = [...data.reconciliations].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setReconciliation(sorted[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation data.');
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

    void fetchReconciliationData(token, userId);
  }, [fetchReconciliationData, router]);

  const period = reconciliation?.period ?? '—';
  const financialYear = reconciliation?.financial_year ?? '—';

  const statCards = [
    {
      label: 'Total Invoices',
      value: reconciliation?.summary.total_invoices ?? null,
      topColor: 'linear-gradient(90deg, #0891b2, #2563eb)',
      valueColor: '#0f172a',
    },
    {
      label: 'Matched',
      value: reconciliation?.summary.matched_count ?? null,
      topColor: '#22c55e',
      valueColor: '#22c55e',
    },
    {
      label: 'Missing in 2A',
      value: reconciliation?.summary.missing_in_2a_count ?? null,
      topColor: '#f59e0b',
      valueColor: '#f59e0b',
    },
    {
      label: 'Missing in 2B',
      value: reconciliation?.summary.missing_in_2b_count ?? null,
      topColor: '#e53e3e',
      valueColor: '#dc2626',
    },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', marginBottom: 10 }}>
          <Link href="/" style={{ color: '#64748b', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#0891b2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'; }}>
            Home
          </Link>
          <span>›</span>
          <Link href="/file-returns" style={{ color: '#64748b', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#0891b2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'; }}>
            File Returns
          </Link>
          <span>›</span>
          <Link href="/file-returns/returns" style={{ color: '#64748b', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#0891b2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'; }}>
            Returns List
          </Link>
          <span>›</span>
          <span style={{ color: '#94a3b8' }}>GSTR-2A</span>
        </nav>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: '#64748b', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {loading ? 'Loading…' : `FY ${financialYear} · Period ${period}`}
            </p>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
              GSTR-2A
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Auto Drafted Details — read-only</p>
          </div>
          <span style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 20,
            background: 'rgba(59,130,246,0.1)',
            color: '#3b82f6',
            border: '1px solid rgba(59,130,246,0.2)',
            fontFamily: "'JetBrains Mono', monospace",
            alignSelf: 'flex-start',
          }}>
            Live
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error !== null && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Stats row */}
      {reconciliation !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 2,
                background: card.topColor,
                borderRadius: '12px 12px 0 0',
              }} />
              <p style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 10 }}>
                {card.label}
              </p>
              <p style={{ color: card.valueColor, fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {card.value === null ? '—' : card.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* No data state */}
      {!loading && reconciliation === null && error === null && (
        <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          No reconciliation data found. Please{' '}
          <Link href="/upload" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}>
            upload your GST files
          </Link>{' '}
          to run reconciliation first.
        </div>
      )}

      {/* Read-only note banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: 'rgba(59,130,246,0.07)',
        border: '1px solid rgba(59,130,246,0.18)',
        borderRadius: 10,
        padding: '12px 16px',
        fontSize: 13,
        color: '#64748b',
      }}>
        <span style={{ color: '#3b82f6', flexShrink: 0, marginTop: 1 }}>ℹ</span>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: '#aaaaaa' }}>Note:</strong> You can only view details of inward supplies in GSTR-2A.
          This return is auto-populated from the GSTR-1 filed by your suppliers and cannot be edited.
        </p>
      </div>

      {/* Section groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SECTION_GROUPS.map((group) => (
          <div
            key={group.part}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Part header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#f8fafc',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(8,145,178,0.10)',
                color: '#0891b2',
                border: '1px solid rgba(8,145,178,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.06em',
              }}>
                {group.part}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{group.label}</span>
            </div>

            {/* Section rows */}
            <div>
              {group.sections.map((section, idx) => (
                <button
                  key={section.id}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', margin: 0 }}>{section.title}</p>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{section.subtitle}</p>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 18, flexShrink: 0, marginLeft: 16, fontFamily: 'monospace' }}>›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @file apps/frontend/app/gstr2a/page.tsx
 * @description GSTR-2A Detail View — fetches actual reconciliation data for
 * the logged-in user and navigates inward supply sections.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseJwtUserId } from '../../lib/auth';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
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

    void fetchReconciliationData(token, userId);
  }, [router]);

  async function fetchReconciliationData(token: string, userId: string): Promise<void> {
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
  }

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
          <Link href="/file-returns" className="transition hover:text-primary-foreground">
            File Returns
          </Link>
          <span>›</span>
          <Link href="/file-returns/returns" className="transition hover:text-primary-foreground">
            Returns List
          </Link>
          <span>›</span>
          <span className="text-primary-foreground">GSTR-2A</span>
        </nav>
        <h1 className="text-lg font-bold text-primary-foreground">GSTR-2A — Auto Drafted Details</h1>
        <div className="mt-1 flex flex-wrap gap-6 text-sm text-primary-foreground/70">
          {loading ? (
            <span>Loading period data…</span>
          ) : (
            <>
              <span>
                Financial Year:{' '}
                <strong className="text-primary-foreground">{financialYear}</strong>
              </span>
              <span>
                Return Period:{' '}
                <strong className="text-primary-foreground">{period}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error !== null && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Reconciliation summary strip (when data available) */}
      {reconciliation !== null && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Invoices</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {reconciliation.summary.total_invoices}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-xs text-muted-foreground">Matched</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {reconciliation.summary.matched_count}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-xs text-muted-foreground">Missing in 2A</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {reconciliation.summary.missing_in_2a_count}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-xs text-muted-foreground">Missing in 2B</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {reconciliation.summary.missing_in_2b_count}
            </p>
          </div>
        </div>
      )}

      {/* No data state */}
      {!loading && reconciliation === null && error === null && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          No reconciliation data found. Please{' '}
          <Link href="/upload" className="font-medium text-primary hover:underline">
            upload your GST files
          </Link>{' '}
          to run reconciliation first.
        </div>
      )}

      {/* Read-only note banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
        <span className="mt-0.5 flex-shrink-0">ℹ️</span>
        <p>
          <strong>Note:</strong> You can only view details of inward supplies in GSTR-2A.
          This return is auto-populated from the GSTR-1 filed by your suppliers and cannot
          be edited.
        </p>
      </div>

      {/* Section groups */}
      <div className="space-y-8">
        {SECTION_GROUPS.map((group) => (
          <div key={group.part}>
            {/* Part label */}
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                {group.part}
              </span>
              <span className="text-sm font-semibold text-primary">{group.label}</span>
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.sections.map((section) => (
                <button
                  key={section.id}
                  className="group flex items-center justify-between rounded-lg bg-primary px-5 py-4 text-left transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary-foreground">{section.title}</p>
                    <p className="mt-0.5 text-xs text-primary-foreground/70">{section.subtitle}</p>
                  </div>
                  <span className="ml-4 flex-shrink-0 text-lg text-primary-foreground/70 transition group-hover:text-primary-foreground">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

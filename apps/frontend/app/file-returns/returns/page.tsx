/**
 * @file apps/frontend/app/file-returns/returns/page.tsx
 * @description Returns List page — displayed after searching for a period.
 * Shows available return forms (GSTR-1, GSTR-2A, GSTR-2B, GSTR-3B) as
 * status cards with VIEW and DOWNLOAD actions.
 *
 * Phase 8: GST portal-style returns list.
 */

import Link from 'next/link';
import { FilingStatusBadge, type FilingStatus } from '../../../components/ui/StatusBadge';

interface ReturnCard {
  id: string;
  type: string;
  description: string;
  frequency: string;
  status: FilingStatus | null;
  detailHref: string;
}

const RETURNS: ReturnCard[] = [
  {
    id: 'gstr1',
    type: 'GSTR-1',
    description: 'Details of outward supplies of goods or services or both',
    frequency: 'Monthly',
    status: 'Filed',
    detailHref: '#',
  },
  {
    id: 'gstr2a',
    type: 'GSTR-2A',
    description: 'Auto drafted details of inward supplies (view only)',
    frequency: 'Auto-generated',
    status: null,
    detailHref: '/gstr2a',
  },
  {
    id: 'gstr2b',
    type: 'GSTR-2B',
    description: 'Auto-drafted ITC Statement (view only)',
    frequency: 'Auto-generated',
    status: null,
    detailHref: '#',
  },
  {
    id: 'gstr3b',
    type: 'GSTR-3B',
    description: 'Monthly return — summary of outward, inward supplies and tax liability',
    frequency: 'Monthly',
    status: 'To be Filed',
    detailHref: '#',
  },
];

/**
 * Returns List page showing available return forms for the selected period.
 * Displays a 2-column grid of return cards with status and action buttons.
 */
export default function ReturnsListPage(): React.ReactElement {
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
          <span className="text-primary-foreground">Returns List</span>
        </nav>
        <h1 className="text-lg font-bold text-primary-foreground">File Returns</h1>
        <p className="mt-0.5 text-sm text-primary-foreground/70">
          Period: July 2024 · Q2 · FY 2024-25
        </p>
      </div>

      {/* 2-column grid of return cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {RETURNS.map((ret) => (
          <div
            key={ret.id}
            className="rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:shadow-md"
          >
            {/* Card header */}
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-primary">{ret.type}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{ret.description}</p>
              </div>
              {ret.status && (
                <div className="flex-shrink-0">
                  <FilingStatusBadge status={ret.status} />
                </div>
              )}
            </div>

            {/* Frequency pill */}
            <div className="mb-4">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {ret.frequency}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Link
                href={ret.detailHref}
                className="rounded bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                VIEW
              </Link>
              <button className="rounded border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted">
                DOWNLOAD
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

/**
 * @file apps/frontend/app/itc-summary/page.tsx
 * @description ITC Summary page — shows available and unavailable ITC breakdown.
 * Includes expandable Part A / Part B table and Supplier Filing Status table
 * with pagination.
 *
 * Phase 8: GST portal-style ITC summary.
 */

import { useState } from 'react';
import Link from 'next/link';
import { YNBadge } from '../../components/ui/StatusBadge';
import { formatCurrency } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabKey = 'available' | 'not-available';

interface ITCRow {
  sno: string;
  heading: string;
  tableRef: string;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  expandable: boolean;
  children?: Omit<ITCRow, 'expandable' | 'children'>[];
}

interface SupplierRow {
  gstin: string;
  name: string;
  gstr1Filed: 'Y' | 'N';
  gstr1Date: string;
  gstr1Period: string;
  gstr3bFiled: 'Y' | 'N';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const ITC_ROWS: ITCRow[] = [
  {
    sno: 'I',
    heading: 'All other ITC — Supplies from registered persons',
    tableRef: '4(A)(5)',
    igst: 125000,
    cgst: 62500,
    sgst: 62500,
    cess: 0,
    expandable: true,
    children: [
      { sno: '', heading: 'IGST', tableRef: '', igst: 125000, cgst: 0, sgst: 0, cess: 0 },
      { sno: '', heading: 'CGST', tableRef: '', igst: 0, cgst: 62500, sgst: 0, cess: 0 },
      { sno: '', heading: 'SGST / UTGST', tableRef: '', igst: 0, cgst: 0, sgst: 62500, cess: 0 },
    ],
  },
  {
    sno: 'II',
    heading: 'Inward Supplies from ISD',
    tableRef: '4(A)(4)',
    igst: 15000,
    cgst: 7500,
    sgst: 7500,
    cess: 0,
    expandable: true,
    children: [
      { sno: '', heading: 'IGST', tableRef: '', igst: 15000, cgst: 0, sgst: 0, cess: 0 },
      { sno: '', heading: 'CGST', tableRef: '', igst: 0, cgst: 7500, sgst: 0, cess: 0 },
      { sno: '', heading: 'SGST / UTGST', tableRef: '', igst: 0, cgst: 0, sgst: 7500, cess: 0 },
    ],
  },
  {
    sno: 'III',
    heading: 'Inward Supplies liable for reverse charge',
    tableRef: '4(A)(3)',
    igst: 8500,
    cgst: 4250,
    sgst: 4250,
    cess: 0,
    expandable: true,
    children: [
      { sno: '', heading: 'IGST', tableRef: '', igst: 8500, cgst: 0, sgst: 0, cess: 0 },
      { sno: '', heading: 'CGST', tableRef: '', igst: 0, cgst: 4250, sgst: 0, cess: 0 },
      { sno: '', heading: 'SGST / UTGST', tableRef: '', igst: 0, cgst: 0, sgst: 4250, cess: 0 },
    ],
  },
  {
    sno: 'IV',
    heading: 'Import of Goods',
    tableRef: '4(A)(1)',
    igst: 45000,
    cgst: 0,
    sgst: 0,
    cess: 2250,
    expandable: true,
    children: [
      { sno: '', heading: 'IGST', tableRef: '', igst: 45000, cgst: 0, sgst: 0, cess: 0 },
      { sno: '', heading: 'Cess', tableRef: '', igst: 0, cgst: 0, sgst: 0, cess: 2250 },
    ],
  },
];

const SUPPLIER_ROWS: SupplierRow[] = [
  {
    gstin: '29AABC****234G',
    name: 'XYZ Trading Co.',
    gstr1Filed: 'Y',
    gstr1Date: '11-08-2024',
    gstr1Period: 'Jul-2024',
    gstr3bFiled: 'Y',
  },
  {
    gstin: '27AABD****678H',
    name: 'PQR Enterprises',
    gstr1Filed: 'Y',
    gstr1Date: '12-08-2024',
    gstr1Period: 'Jul-2024',
    gstr3bFiled: 'N',
  },
  {
    gstin: '06AABE****012J',
    name: 'LMN Suppliers Pvt. Ltd.',
    gstr1Filed: 'N',
    gstr1Date: '—',
    gstr1Period: 'Jul-2024',
    gstr3bFiled: 'N',
  },
  {
    gstin: '33AABF****456K',
    name: 'RST Manufacturers',
    gstr1Filed: 'Y',
    gstr1Date: '10-08-2024',
    gstr1Period: 'Jul-2024',
    gstr3bFiled: 'Y',
  },
  {
    gstin: '19AABG****890L',
    name: 'UVW Distributors',
    gstr1Filed: 'Y',
    gstr1Date: '13-08-2024',
    gstr1Period: 'Jul-2024',
    gstr3bFiled: 'Y',
  },
];

const ROWS_PER_PAGE = 3;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Renders a single currency value or a dash when zero. */
function AmtCell({ value }: { value: number }): React.ReactElement {
  return (
    <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
      {value !== 0 ? formatCurrency(value) : '—'}
    </td>
  );
}

/** One expandable row in the ITC table (plus its optional child rows). */
function ITCTableRow({ row }: { row: ITCRow }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-border hover:bg-muted">
        <td className="px-4 py-3 text-sm font-bold text-primary">{row.sno}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {row.expandable && (
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted hover:text-primary"
              >
                {expanded ? '▲' : '▼'}
              </button>
            )}
            <span className="text-sm font-medium text-foreground">{row.heading}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{row.tableRef}</td>
        <AmtCell value={row.igst} />
        <AmtCell value={row.cgst} />
        <AmtCell value={row.sgst} />
        <AmtCell value={row.cess} />
      </tr>

      {expanded &&
        row.children?.map((child, i) => (
          <tr key={i} className="border-b border-border bg-muted">
            <td className="px-4 py-3" />
            <td className="px-4 py-3">
              <span className="ml-7 text-sm text-muted-foreground">
                <span className="mr-1.5 text-border">└</span>
                {child.heading}
              </span>
            </td>
            <td className="px-4 py-3" />
            <AmtCell value={child.igst} />
            <AmtCell value={child.cgst} />
            <AmtCell value={child.sgst} />
            <AmtCell value={child.cess} />
          </tr>
        ))}
    </>
  );
}

/** Column headers reused in the ITC table. */
function ITCTableHead(): React.ReactElement {
  return (
    <thead>
      <tr className="border-b border-border bg-muted">
        <th className="w-12 px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
          S.No
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Heading</th>
        <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
          GSTR-3B Ref
        </th>
        <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
          Integrated Tax (₹)
        </th>
        <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
          Central Tax (₹)
        </th>
        <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
          State / UT Tax (₹)
        </th>
        <th className="w-24 px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
          Cess (₹)
        </th>
      </tr>
    </thead>
  );
}

/** Sticky section header row spanning all columns. */
function SectionHeader({ text }: { text: string }): React.ReactElement {
  return (
    <tr>
      <td
        colSpan={7}
        className="border-b border-t border-border bg-muted px-4 py-2.5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {text}
        </p>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * ITC Summary page.
 * Tabs: ITC Available / ITC Not Available.
 * Below: Supplier Filing Status table with pagination.
 */
export default function ITCSummaryPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>('available');
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(SUPPLIER_ROWS.length / ROWS_PER_PAGE);
  const visibleSuppliers = SUPPLIER_ROWS.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );
  const firstShown = (page - 1) * ROWS_PER_PAGE + 1;
  const lastShown = Math.min(page * ROWS_PER_PAGE, SUPPLIER_ROWS.length);

  const tabClass = (key: TabKey) =>
    `px-6 py-3 text-sm font-semibold transition border-b-2 ${
      activeTab === key
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div>
      {/* Page header strip */}
      <div className="mb-6 rounded-lg bg-primary px-6 py-4">
        <nav className="mb-1 flex items-center gap-1 text-xs text-primary-foreground/70">
          <Link href="/" className="transition hover:text-primary-foreground">
            Home
          </Link>
          <span>›</span>
          <span className="text-primary-foreground">ITC Summary</span>
        </nav>
        <h1 className="text-lg font-bold text-primary-foreground">Input Tax Credit (ITC) Summary</h1>
        <p className="mt-0.5 text-sm text-primary-foreground/70">Period: July 2024 · FY 2024-25</p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-border">
        <button onClick={() => setActiveTab('available')} className={tabClass('available')}>
          ITC Available
        </button>
        <button
          onClick={() => setActiveTab('not-available')}
          className={tabClass('not-available')}
        >
          ITC Not Available
        </button>
      </div>

      {/* Tab panels */}
      {activeTab === 'available' ? (
        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <ITCTableHead />
              <tbody>
                <SectionHeader text="Part A — ITC Available: Credit may be claimed in relevant headings in GSTR-3B" />
                {ITC_ROWS.map((row) => (
                  <ITCTableRow key={row.sno} row={row} />
                ))}
                <SectionHeader text="Part B — ITC Available: Credit notes should be net off" />
                {/* Static Part B row */}
                <tr className="border-b border-border hover:bg-muted">
                  <td className="px-4 py-3 text-sm font-bold text-primary">V</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    Credit Notes received from registered persons
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">4(B)(2)</td>
                  <AmtCell value={5500} />
                  <AmtCell value={2750} />
                  <AmtCell value={2750} />
                  <AmtCell value={0} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            No ITC Not Available entries for this period.
          </p>
        </div>
      )}

      {/* ── Supplier Filing Status Table ─────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-primary">
          Supplier Filing Status
        </h2>

        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-primary">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-foreground">
                    GSTIN of Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-primary-foreground">
                    Supplier Name
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-primary-foreground">
                    GSTR-1 / IFF / GSTR-5
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-primary-foreground">
                    GSTR-1 Filing Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-primary-foreground">
                    GSTR-1 Period
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-primary-foreground">
                    GSTR-3B
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleSuppliers.map((row, i) => (
                  <tr
                    key={row.gstin}
                    className={i % 2 === 0 ? 'bg-surface' : 'bg-muted'}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {row.gstin}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-center">
                      <YNBadge status={row.gstr1Filed} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {row.gstr1Date}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {row.gstr1Period}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <YNBadge status={row.gstr3bFiled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {firstShown}–{lastShown} of {SUPPLIER_ROWS.length} suppliers
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @file apps/frontend/app/gstr2a/page.tsx
 * @description GSTR-2A Detail View — navigates inward supply sections.
 * Displays PART-A, PART-B, and PART-C section groups as dark navy clickable cards.
 *
 * Phase 8: GST portal-style GSTR-2A section navigator.
 */

import Link from 'next/link';

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

/**
 * GSTR-2A detail view.
 * Shows FY / period metadata, a read-only note banner, and section navigation cards.
 */
export default function GSTR2APage(): React.ReactElement {
  return (
    <div>
      {/* Page header strip */}
      <div className="mb-6 rounded-lg bg-[#182844] px-6 py-4">
        <nav className="mb-1 flex items-center gap-1 text-xs text-[#a4aab4]">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <span>›</span>
          <Link href="/file-returns" className="transition hover:text-white">
            File Returns
          </Link>
          <span>›</span>
          <Link href="/file-returns/returns" className="transition hover:text-white">
            Returns List
          </Link>
          <span>›</span>
          <span className="text-white">GSTR-2A</span>
        </nav>
        <h1 className="text-lg font-bold text-white">GSTR-2A — Auto Drafted Details</h1>
        <div className="mt-1 flex flex-wrap gap-6 text-sm text-[#a4aab4]">
          <span>
            Financial Year:{' '}
            <strong className="text-white">2024-25</strong>
          </span>
          <span>
            Return Period:{' '}
            <strong className="text-white">July 2024</strong>
          </span>
        </div>
      </div>

      {/* Read-only note banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#4470b0] bg-[#eef2fa] px-4 py-3 text-sm text-[#2f5a9b]">
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
              <span className="rounded bg-[#182844] px-2.5 py-1 text-xs font-bold text-white">
                {group.part}
              </span>
              <span className="text-sm font-semibold text-[#182844]">{group.label}</span>
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.sections.map((section) => (
                <button
                  key={section.id}
                  className="group flex items-center justify-between rounded-lg bg-[#182844] px-5 py-4 text-left transition hover:bg-[#1e3566] focus:outline-none focus:ring-2 focus:ring-[#4470b0] focus:ring-offset-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{section.title}</p>
                    <p className="mt-0.5 text-xs text-[#a4aab4]">{section.subtitle}</p>
                  </div>
                  <span className="ml-4 flex-shrink-0 text-lg text-[#a4aab4] transition group-hover:text-white">
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

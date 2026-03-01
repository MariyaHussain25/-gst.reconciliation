/**
 * @file apps/frontend/app/page.tsx
 * @description Landing page for the GST Reconciliation System.
 * Provides an overview of the system and a call-to-action to get started.
 *
 * Phase 1: Static landing page.
 * Phase 3+: Add real-time status indicators and recent activity.
 */

import Link from 'next/link';

/**
 * Landing page displayed at the root URL (/).
 * Shows the system title, description, and navigation to key features.
 */
export default function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Hero section */}
      <div className="mb-8">
        <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
          AI-Powered · Phase 1 Scaffold
        </span>
      </div>

      <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        GST Reconciliation System
      </h1>

      <p className="mb-6 max-w-2xl text-lg text-gray-600">
        Automate your GST reconciliation between purchase books and GSTR-2B returns.
        Identify discrepancies, determine ITC eligibility, and generate professional reports —
        all powered by AI.
      </p>

      {/* Feature highlights */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: '3-Pass Matching',
            description: 'Exact → Fuzzy → AI-assisted invoice matching',
          },
          {
            title: 'ITC Rules Engine',
            description: 'Automated eligibility based on CGST Act Section 17',
          },
          {
            title: 'PDF Reports',
            description: 'Professional reconciliation reports in one click',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-1 font-semibold text-gray-900">{feature.title}</h3>
            <p className="text-sm text-gray-500">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Call to action */}
      <div className="flex gap-4">
        <Link
          href="/upload"
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Get Started
        </Link>
        <Link
          href="/results"
          className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          View Results
        </Link>
      </div>
    </div>
  );
}

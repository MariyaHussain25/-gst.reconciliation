/**
 * @file apps/frontend/app/results/page.tsx
 * @description Reconciliation results dashboard page.
 * Displays matched/unmatched invoices, discrepancies, and ITC summary.
 *
 * Phase 1: Placeholder page.
 * Phase 5+: Implement results tables and charts using reconciliation data.
 */

/**
 * Results page — displays the outcome of the reconciliation pipeline.
 */
export default function ResultsPage(): React.ReactElement {
  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Reconciliation Results</h1>
      <p className="mb-8 text-gray-500">
        View matched invoices, discrepancies, and ITC eligibility breakdown.
      </p>

      {/* Placeholder results area */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
        <p className="text-lg font-medium text-gray-700">Results Dashboard</p>
        <p className="mt-2 text-sm text-gray-400">
          Coming in Phase 5 — reconciliation results will be displayed here.
        </p>
      </div>
    </div>
  );
}

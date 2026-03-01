/**
 * @file apps/frontend/app/reports/page.tsx
 * @description PDF reports page.
 * Allows users to generate and download GST reconciliation reports.
 *
 * Phase 1: Placeholder page.
 * Phase 8: Implement PDF generation controls and download functionality.
 */

/**
 * Reports page — generate and download PDF reconciliation reports.
 */
export default function ReportsPage(): React.ReactElement {
  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Reports</h1>
      <p className="mb-8 text-gray-500">
        Generate and download professional GST reconciliation PDF reports.
      </p>

      {/* Placeholder reports area */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center shadow-sm">
        <p className="text-lg font-medium text-gray-700">PDF Report Generation</p>
        <p className="mt-2 text-sm text-gray-400">
          Coming in Phase 8 — PDF report generation will be implemented here.
        </p>
      </div>
    </div>
  );
}

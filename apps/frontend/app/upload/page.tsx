/**
 * @file apps/frontend/app/upload/page.tsx
 * @description Document upload page.
 * Allows users to upload purchase books (CSV/Excel) and GSTR-2A/2B files.
 *
 * Phase 1: Placeholder page.
 * Phase 3: Implement drag-and-drop file upload with progress indicators.
 */

/**
 * Upload page — users select and upload their GST documents.
 */
export default function UploadPage(): React.ReactElement {
  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Upload Documents</h1>
      <p className="mb-8 text-gray-500">
        Upload your purchase books (CSV/Excel) and GSTR-2A/2B returns to begin reconciliation.
      </p>

      {/* Placeholder upload area */}
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
        <p className="text-lg font-medium text-gray-700">File Upload Interface</p>
        <p className="mt-2 text-sm text-gray-400">
          Coming in Phase 3 — drag-and-drop file upload will be implemented here.
        </p>
      </div>
    </div>
  );
}

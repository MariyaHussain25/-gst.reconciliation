/**
 * @file packages/shared/src/types/api.types.ts
 * @description TypeScript interfaces for API request and response shapes.
 * These types are shared between the backend (Hono) and frontend (Next.js).
 */

/** Standard error response returned by all API error handlers */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

/** Standard success wrapper for API responses */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Upload endpoint  (POST /upload-docs)
// ---------------------------------------------------------------------------

/** Metadata for a single uploaded file */
export interface UploadedFileInfo {
  /** Original file name */
  fileName: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Generated document ID */
  docId: string;
}

/** Response returned after documents are uploaded */
export interface UploadResponse {
  /** ID of the user who uploaded */
  userId: string;
  /** List of files that were successfully stored */
  uploadedFiles: UploadedFileInfo[];
  /** Total number of files processed */
  totalFiles: number;
}

// ---------------------------------------------------------------------------
// Process endpoint  (POST /process/:userId)
// ---------------------------------------------------------------------------

/** Summary of a reconciliation run */
export interface ReconciliationRunSummary {
  /** Total invoices processed */
  totalInvoices: number;
  /** Invoices with exact match */
  matched: number;
  /** Invoices matched with fuzzy logic */
  fuzzyMatched: number;
  /** Invoices requiring manual review */
  needsReview: number;
  /** Invoices not matched */
  unmatched: number;
  /** Total ITC amount eligible for claim */
  eligibleItcAmount: number;
  /** Total ITC amount that is blocked */
  blockedItcAmount: number;
}

/** Response returned after the reconciliation process completes */
export interface ProcessResponse {
  /** ID of the processed user */
  userId: string;
  /** Generated result document ID */
  resultDocId: string;
  /** Tax period covered */
  period: string;
  /** Summary statistics */
  summary: ReconciliationRunSummary;
}

// ---------------------------------------------------------------------------
// PDF generation endpoint  (GET /generatePdf/:userId/:duration)
// ---------------------------------------------------------------------------

/** Response returned when a PDF report is generated */
export interface PdfGenerationResponse {
  /** ID of the user */
  userId: string;
  /** Duration / period the report covers */
  duration: string;
  /** URL or path to download the generated PDF */
  pdfUrl: string;
  /** File name of the generated PDF */
  fileName: string;
}

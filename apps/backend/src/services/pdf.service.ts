/**
 * @file apps/backend/src/services/pdf.service.ts
 * @description PDF report generation service.
 * Generates professional GST reconciliation PDF reports using @react-pdf/renderer.
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 8: Implement full PDF generation with reconciliation tables,
 *          ITC summary, and discrepancy details.
 */

/** Options for PDF report generation */
export interface PdfGenerationOptions {
  userId: string;
  period: string;
  includeMatchedInvoices?: boolean;
  includeDiscrepancies?: boolean;
  includeItcSummary?: boolean;
}

/** Result of PDF generation */
export interface PdfGenerationResult {
  /** Buffer containing the generated PDF */
  pdfBuffer: Buffer;
  /** Suggested file name for the download */
  fileName: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Generates a GST reconciliation PDF report for a user and period.
 *
 * Report sections:
 * 1. Executive Summary (total invoices, match rate, ITC eligible amount)
 * 2. Matched Invoices table (optional)
 * 3. Discrepancies table (missing/mismatched invoices)
 * 4. ITC Eligibility Summary
 * 5. Recommended Actions
 *
 * @param options - PDF generation options
 * @returns Generated PDF as a Buffer with metadata
 *
 * TODO (Phase 8): Implement PDF generation using @react-pdf/renderer
 * TODO (Phase 8): Fetch reconciliation results from MongoDB
 * TODO (Phase 8): Build React PDF components for each report section
 */
export async function generateReconciliationPdf(
  options: PdfGenerationOptions,
): Promise<PdfGenerationResult> {
  // TODO (Phase 8): Replace placeholder with actual PDF generation
  console.log(
    `[PDF] Generating report for user=${options.userId}, period=${options.period}`,
  );

  // Placeholder: return an empty buffer
  const placeholderContent = `GST Reconciliation Report - ${options.userId} - ${options.period}\n\nPlaceholder: PDF service not yet implemented (Phase 8)`;
  const pdfBuffer = Buffer.from(placeholderContent, 'utf-8');

  return {
    pdfBuffer,
    fileName: `gst-reconciliation-${options.userId}-${options.period}.pdf`,
    sizeBytes: pdfBuffer.length,
  };
}

/**
 * @file apps/backend/src/routes/pdf.route.ts
 * @description Route handler for PDF report generation endpoint.
 *
 * GET /generatePdf/:userId/:duration
 *   Generates and streams a PDF reconciliation report.
 *
 * Phase 1: Scaffold with placeholder logic.
 * Phase 8: Implement full PDF generation with @react-pdf/renderer.
 */

import { Hono } from 'hono';
import { generateReconciliationPdf } from '../services/pdf.service.js';

export const pdfRouter = new Hono();

/**
 * GET /generatePdf/:userId/:duration
 * Generates a GST reconciliation PDF report and returns it as a download.
 *
 * Path params:
 *   - userId: The user ID
 *   - duration: The tax period in YYYY-MM format
 *
 * TODO (Phase 8): Implement full PDF generation with reconciliation data
 * TODO (Phase 8): Set proper Content-Type and Content-Disposition headers
 */
pdfRouter.get('/:userId/:duration', async (context) => {
  const userId = context.req.param('userId');
  const duration = context.req.param('duration');

  if (!/^\d{4}-\d{2}$/.test(duration)) {
    return context.json(
      {
        success: false,
        error: 'INVALID_DURATION',
        message: 'Duration must be in YYYY-MM format (e.g. "2024-03")',
        statusCode: 400,
      },
      400,
    );
  }

  const result = await generateReconciliationPdf({
    userId,
    period: duration,
    includeMatchedInvoices: true,
    includeDiscrepancies: true,
    includeItcSummary: true,
  });

  // TODO (Phase 8): Return actual PDF buffer with proper headers
  // For now, return metadata as JSON
  return context.json({
    success: true,
    data: {
      userId,
      duration,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      pdfUrl: `/downloads/${result.fileName}`,
    },
  });
});

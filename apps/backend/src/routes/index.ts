/**
 * @file apps/backend/src/routes/index.ts
 * @description Route aggregator — mounts all route modules onto their base paths.
 * All routes are prefixed with /api/v1.
 *
 * Current routes:
 *   POST /api/v1/upload-docs       — Document upload
 *   POST /api/v1/process/:userId   — Reconciliation pipeline
 *   GET  /api/v1/generatePdf/:userId/:duration — PDF report
 */

import { Hono } from 'hono';
import { uploadRouter } from './upload.route.js';
import { processRouter } from './process.route.js';
import { pdfRouter } from './pdf.route.js';

/** Aggregated router with all API routes */
export const apiRouter = new Hono();

// Mount individual route modules
apiRouter.route('/upload-docs', uploadRouter);
apiRouter.route('/process', processRouter);
apiRouter.route('/generatePdf', pdfRouter);

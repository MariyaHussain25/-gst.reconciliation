/**
 * @file apps/backend/src/routes/upload.route.ts
 * @description Route handler for document upload endpoint.
 *
 * POST /upload-docs
 *   Accepts multipart form data with purchase books and/or GSTR files.
 *   Stores files and returns upload metadata.
 *
 * Phase 1: Scaffold with placeholder logic.
 * Phase 3: Implement actual file parsing and storage.
 */

import { Hono } from 'hono';
import { processUploadedFiles } from '../services/upload.service.js';

export const uploadRouter = new Hono();

/**
 * POST /upload-docs
 * Accepts multipart/form-data with files to upload.
 * Expects a `userId` field and one or more file fields.
 *
 * TODO (Phase 3): Validate file types (CSV, Excel, PDF)
 * TODO (Phase 3): Implement S3 upload or local storage
 * TODO (Phase 4): Trigger data parsing pipeline after upload
 */
uploadRouter.post('/', async (context) => {
  // TODO (Phase 3): Parse multipart form data and extract files
  const userId = context.req.query('userId') ?? 'anonymous';

  // Placeholder: pass empty files array until Phase 3
  const result = await processUploadedFiles(userId, []);

  return context.json({ success: true, data: result }, 200);
});

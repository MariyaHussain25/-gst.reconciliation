/**
 * @file packages/shared/src/schemas/api.schema.ts
 * @description Zod schemas for API request and response validation.
 */

import { z } from 'zod';

/** Schema for upload request query/body parameters */
export const UploadRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

/** Schema for process request path parameters */
export const ProcessRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

/** Schema for PDF generation request path parameters */
export const PdfRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  duration: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Duration must be YYYY-MM format'),
});

/** Schema for the reconciliation summary returned in process response */
export const ReconciliationSummarySchema = z.object({
  totalInvoices: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  fuzzyMatched: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  eligibleItcAmount: z.number().nonnegative(),
  blockedItcAmount: z.number().nonnegative(),
});

export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export type ProcessRequest = z.infer<typeof ProcessRequestSchema>;
export type PdfRequest = z.infer<typeof PdfRequestSchema>;
export type ReconciliationSummary = z.infer<typeof ReconciliationSummarySchema>;

/**
 * @file packages/shared/src/schemas/invoice.schema.ts
 * @description Zod runtime validation schemas for invoice data.
 * Used for validating incoming API data and file-parsed content.
 */

import { z } from 'zod';

export const InvoiceSourceSchema = z.enum(['BOOKS', 'GSTR_2A', 'GSTR_2B']);

export const MatchStatusSchema = z.enum([
  'MATCHED',
  'FUZZY_MATCH',
  'NEEDS_REVIEW',
  'MISSING_IN_BOOKS',
  'MISSING_IN_2B',
  'VALUE_MISMATCH',
  'GSTIN_MISMATCH',
  'UNMATCHED',
]);

export const ItcCategorySchema = z.enum([
  'ELIGIBLE',
  'BLOCKED',
  'RCM',
  'EXEMPT',
  'NIL_RATED',
  'ZERO_RATED',
  'INELIGIBLE',
]);

/** Schema for raw invoice data received from file parsing */
export const RawInvoiceDataSchema = z.object({
  gstin: z.string().min(15).max(15, 'GSTIN must be exactly 15 characters'),
  vendorName: z.string().min(1, 'Vendor name is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  taxableAmount: z.number().nonnegative(),
  igst: z.number().nonnegative(),
  cgst: z.number().nonnegative(),
  sgst: z.number().nonnegative(),
  description: z.string().optional(),
});

/** Schema for a complete invoice record */
export const InvoiceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  source: InvoiceSourceSchema,
  gstin: z.string().length(15),
  vendorName: z.string(),
  normalizedVendorName: z.string(),
  invoiceNumber: z.string(),
  normalizedInvoiceNumber: z.string(),
  invoiceDate: z.date(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  taxableAmount: z.number().nonnegative(),
  igst: z.number().nonnegative(),
  cgst: z.number().nonnegative(),
  sgst: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  matchStatus: MatchStatusSchema,
  itcCategory: ItcCategorySchema.nullable(),
  matchConfidence: z.number().min(0).max(100),
  description: z.string().optional(),
  createdAt: z.date(),
});

export type RawInvoiceDataInput = z.infer<typeof RawInvoiceDataSchema>;
export type InvoiceInput = z.infer<typeof InvoiceSchema>;

/**
 * @file apps/backend/src/models/invoice.model.ts
 * @description Mongoose schema and model for Invoice documents.
 * Stores invoices from Books, GSTR-2A, and GSTR-2B sources along
 * with reconciliation results and ITC categorization.
 *
 * Phase 1: Schema defined.
 * Phase 4: Normalization fields populated during parsing.
 * Phase 5: matchStatus and matchConfidence set by matching engine.
 * Phase 6: itcCategory set by ITC rules engine.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** TypeScript interface extending Mongoose Document for type safety */
export interface IInvoice extends Document {
  userId: string;
  source: 'BOOKS' | 'GSTR_2A' | 'GSTR_2B';
  gstin: string;
  vendorName: string;
  normalizedVendorName: string;
  invoiceNumber: string;
  normalizedInvoiceNumber: string;
  invoiceDate: Date;
  period: string; // YYYY-MM
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  matchStatus:
    | 'MATCHED'
    | 'FUZZY_MATCH'
    | 'NEEDS_REVIEW'
    | 'MISSING_IN_BOOKS'
    | 'MISSING_IN_2B'
    | 'VALUE_MISMATCH'
    | 'GSTIN_MISMATCH'
    | 'UNMATCHED';
  itcCategory:
    | 'ELIGIBLE'
    | 'BLOCKED'
    | 'RCM'
    | 'EXEMPT'
    | 'NIL_RATED'
    | 'ZERO_RATED'
    | 'INELIGIBLE'
    | null;
  matchConfidence: number; // 0–100
  description?: string;
  createdAt: Date;
}

/** Main Invoice schema */
const InvoiceSchema = new Schema<IInvoice>(
  {
    userId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ['BOOKS', 'GSTR_2A', 'GSTR_2B'],
      required: true,
    },
    gstin: { type: String, required: true },
    vendorName: { type: String, required: true },
    normalizedVendorName: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    normalizedInvoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    period: { type: String, required: true }, // YYYY-MM
    taxableAmount: { type: Number, required: true, min: 0 },
    igst: { type: Number, required: true, min: 0 },
    cgst: { type: Number, required: true, min: 0 },
    sgst: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    matchStatus: {
      type: String,
      enum: [
        'MATCHED',
        'FUZZY_MATCH',
        'NEEDS_REVIEW',
        'MISSING_IN_BOOKS',
        'MISSING_IN_2B',
        'VALUE_MISMATCH',
        'GSTIN_MISMATCH',
        'UNMATCHED',
      ],
      default: 'UNMATCHED',
    },
    itcCategory: {
      type: String,
      enum: ['ELIGIBLE', 'BLOCKED', 'RCM', 'EXEMPT', 'NIL_RATED', 'ZERO_RATED', 'INELIGIBLE'],
      default: null,
    },
    matchConfidence: { type: Number, min: 0, max: 100, default: 0 },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  {
    // Compound index for efficient reconciliation queries
    // (look up all invoices for a user in a specific period)
    timestamps: false,
  },
);

// Compound index: used frequently when reconciling invoices by user + period
InvoiceSchema.index({ userId: 1, period: 1 });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);

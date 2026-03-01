/**
 * @file packages/shared/src/types/invoice.types.ts
 * @description TypeScript interfaces for invoice data used across the system.
 * These types represent invoices from Books, GSTR-2A, and GSTR-2B sources.
 */

/** Source of the invoice document */
export type InvoiceSource = 'BOOKS' | 'GSTR_2A' | 'GSTR_2B';

/**
 * Match status after 3-pass reconciliation engine
 * - MATCHED: Exact match found
 * - FUZZY_MATCH: Match found with minor differences (Phase 5)
 * - NEEDS_REVIEW: Requires manual review
 * - MISSING_IN_BOOKS: Present in GSTR but missing in books
 * - MISSING_IN_2B: Present in books but missing in GSTR-2B
 * - VALUE_MISMATCH: Invoice found but amounts differ
 * - GSTIN_MISMATCH: Vendor GSTIN does not match
 * - UNMATCHED: No corresponding invoice found
 */
export type MatchStatus =
  | 'MATCHED'
  | 'FUZZY_MATCH'
  | 'NEEDS_REVIEW'
  | 'MISSING_IN_BOOKS'
  | 'MISSING_IN_2B'
  | 'VALUE_MISMATCH'
  | 'GSTIN_MISMATCH'
  | 'UNMATCHED';

/**
 * ITC eligibility category determined by the rules engine (Phase 6)
 * - ELIGIBLE: Input tax credit can be claimed
 * - BLOCKED: ITC blocked under Section 17(5) of CGST Act
 * - RCM: Reverse Charge Mechanism applies
 * - EXEMPT: Supply is exempt from GST
 * - NIL_RATED: Supply is nil-rated
 * - ZERO_RATED: Supply is zero-rated (exports)
 * - INELIGIBLE: ITC not eligible for other reasons
 */
export type ItcCategory =
  | 'ELIGIBLE'
  | 'BLOCKED'
  | 'RCM'
  | 'EXEMPT'
  | 'NIL_RATED'
  | 'ZERO_RATED'
  | 'INELIGIBLE';

/** Core invoice interface representing a single GST invoice */
export interface Invoice {
  /** MongoDB document ID */
  id: string;
  /** Reference to the owning user */
  userId: string;
  /** Origin of the invoice data */
  source: InvoiceSource;
  /** Goods and Services Tax Identification Number of the vendor */
  gstin: string;
  /** Vendor/supplier name as provided in the document */
  vendorName: string;
  /** Vendor name after normalization (lowercase, trimmed, punctuation removed) */
  normalizedVendorName: string;
  /** Invoice number as provided in the document */
  invoiceNumber: string;
  /** Invoice number after normalization */
  normalizedInvoiceNumber: string;
  /** Date the invoice was issued */
  invoiceDate: Date;
  /** Tax period in YYYY-MM format (e.g. "2024-03") */
  period: string;
  /** Base taxable amount before GST */
  taxableAmount: number;
  /** Integrated GST amount */
  igst: number;
  /** Central GST amount */
  cgst: number;
  /** State GST amount */
  sgst: number;
  /** Total invoice amount including all taxes */
  totalAmount: number;
  /** Result of the reconciliation matching engine */
  matchStatus: MatchStatus;
  /** ITC eligibility category (null until ITC engine runs in Phase 6) */
  itcCategory: ItcCategory | null;
  /** Confidence score of the match (0-100) */
  matchConfidence: number;
  /** Optional description or notes on the invoice */
  description?: string;
  /** Timestamp when the record was created */
  createdAt: Date;
}

/** Invoice data as received from file upload (before normalization) */
export interface RawInvoiceData {
  gstin: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
  description?: string;
}

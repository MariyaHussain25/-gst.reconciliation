/**
 * @file apps/backend/src/models/reconciliation.model.ts
 * @description Mongoose schema and model for reconciliation results.
 * Stores per-invoice match results, ITC decisions, and summary totals.
 *
 * Phase 2: Schema defined.
 * Phase 5: Populated by the matching engine.
 * Phase 6: ITC category and claimable amounts filled by ITC rules engine.
 * Phase 7: aiExplanation field populated by the AI explanation service.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** Per-invoice reconciliation result sub-document */
export interface IReconciliationResult {
  /** MongoDB ObjectId reference to the GSTR-2A record, null if missing in 2A */
  gstr2aRecordId: string | null;
  /** MongoDB ObjectId reference to the GSTR-2B record, null if missing in 2B */
  gstr2bRecordId: string | null;

  // Fields from GSTR-2A
  gstr2aVendorName: string | null;
  gstr2aVendorGstin: string | null;
  gstr2aVchNo: number | null;
  gstr2aInvoiceAmount: number | null;
  gstr2aTaxableAmount: number | null;
  gstr2aIgst: number | null;
  gstr2aCgst: number | null;
  gstr2aSgst: number | null;

  // Fields from GSTR-2B
  gstr2bVendorName: string | null;
  gstr2bVendorGstin: string | null;
  gstr2bInvoiceNumber: string | null;
  gstr2bInvoiceValue: number | null;
  gstr2bTaxableValue: number | null;
  gstr2bIgst: number | null;
  gstr2bCgst: number | null;
  gstr2bSgst: number | null;
  gstr2bItcAvailability: string | null;

  /**
   * Match status:
   * - "MATCHED" = Exact match on GSTIN + invoice number + amounts
   * - "FUZZY_MATCH" = High-confidence approximate match
   * - "NEEDS_REVIEW" = Low-confidence or ambiguous match
   * - "MISSING_IN_2A" = Present in GSTR-2B but not in GSTR-2A (books)
   * - "MISSING_IN_2B" = Present in GSTR-2A (books) but not in GSTR-2B (portal)
   * - "VALUE_MISMATCH" = GSTIN and invoice number match but amounts differ
   * - "GSTIN_MISMATCH" = Invoice appears to match but GSTIN differs
   */
  matchStatus:
    | 'MATCHED'
    | 'FUZZY_MATCH'
    | 'NEEDS_REVIEW'
    | 'MISSING_IN_2A'
    | 'MISSING_IN_2B'
    | 'VALUE_MISMATCH'
    | 'GSTIN_MISMATCH';
  /** Confidence score 0–100 */
  matchConfidence: number;
  /** List of field names that differ between 2A and 2B */
  mismatchFields: string[];
  /** Human-readable explanation of why the records don't match */
  mismatchReason: string | null;

  // Amount differences (GSTR-2A value minus GSTR-2B value)
  taxableAmountDiff: number;
  igstDiff: number;
  cgstDiff: number;
  sgstDiff: number;
  totalAmountDiff: number;

  // ITC decision fields
  /** Whether ITC can be claimed: "Yes" / "No" */
  itcAvailability: string;
  /**
   * ITC eligibility category:
   * - "ELIGIBLE" = ITC can be fully claimed
   * - "BLOCKED" = Blocked under Section 17(5) of CGST Act
   * - "RCM" = Reverse Charge Mechanism applies
   * - "EXEMPT" = Supply is exempt from tax
   * - "NIL_RATED" = Nil-rated supply
   * - "ZERO_RATED" = Zero-rated (export) supply
   * - "INELIGIBLE" = Otherwise ineligible for ITC
   */
  itcCategory:
    | 'ELIGIBLE'
    | 'BLOCKED'
    | 'RCM'
    | 'EXEMPT'
    | 'NIL_RATED'
    | 'ZERO_RATED'
    | 'INELIGIBLE';
  /** Amount of ITC that can be claimed in GSTR-3B */
  itcClaimableAmount: number;
  /** Amount of ITC that is blocked/ineligible */
  itcBlockedAmount: number;

  /** AI-generated explanation (populated in Phase 7) */
  aiExplanation: string | null;
}

/** Reconciliation summary totals sub-document */
export interface IReconciliationSummary {
  totalInvoices: number;
  matchedCount: number;
  fuzzyMatchCount: number;
  needsReviewCount: number;
  missingIn2aCount: number;
  missingIn2bCount: number;
  valueMismatchCount: number;
  gstinMismatchCount: number;
  totalEligibleItc: number;
  totalBlockedItc: number;
  totalIneligibleItc: number;
}

/** TypeScript interface extending Mongoose Document for type safety */
export interface IReconciliation extends Document {
  /** Unique identifier for this reconciliation run */
  reconciliationId: string;
  /** User who initiated the reconciliation */
  userId: string;
  /** Tax period label, e.g. "March 2023" */
  period: string;
  /** Financial year, e.g. "2022-23" */
  financialYear: string;
  /**
   * Processing status:
   * - "PENDING" = Not yet started
   * - "PROCESSING" = Currently running
   * - "COMPLETED" = Successfully finished
   * - "FAILED" = Encountered an error
   */
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  /** Per-invoice reconciliation results */
  results: IReconciliationResult[];
  /** Aggregated summary totals */
  summary: IReconciliationSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Sub-document schema for per-invoice reconciliation results */
const ReconciliationResultSchema = new Schema<IReconciliationResult>(
  {
    gstr2aRecordId: { type: String, default: null },
    gstr2bRecordId: { type: String, default: null },

    gstr2aVendorName: { type: String, default: null },
    gstr2aVendorGstin: { type: String, default: null },
    gstr2aVchNo: { type: Number, default: null },
    gstr2aInvoiceAmount: { type: Number, default: null },
    gstr2aTaxableAmount: { type: Number, default: null },
    gstr2aIgst: { type: Number, default: null },
    gstr2aCgst: { type: Number, default: null },
    gstr2aSgst: { type: Number, default: null },

    gstr2bVendorName: { type: String, default: null },
    gstr2bVendorGstin: { type: String, default: null },
    gstr2bInvoiceNumber: { type: String, default: null },
    gstr2bInvoiceValue: { type: Number, default: null },
    gstr2bTaxableValue: { type: Number, default: null },
    gstr2bIgst: { type: Number, default: null },
    gstr2bCgst: { type: Number, default: null },
    gstr2bSgst: { type: Number, default: null },
    gstr2bItcAvailability: { type: String, default: null },

    matchStatus: {
      type: String,
      enum: [
        'MATCHED',
        'FUZZY_MATCH',
        'NEEDS_REVIEW',
        'MISSING_IN_2A',
        'MISSING_IN_2B',
        'VALUE_MISMATCH',
        'GSTIN_MISMATCH',
      ],
      required: true,
    },
    matchConfidence: { type: Number, min: 0, max: 100, required: true },
    mismatchFields: { type: [String], default: [] },
    mismatchReason: { type: String, default: null },

    taxableAmountDiff: { type: Number, required: true, default: 0 },
    igstDiff: { type: Number, required: true, default: 0 },
    cgstDiff: { type: Number, required: true, default: 0 },
    sgstDiff: { type: Number, required: true, default: 0 },
    totalAmountDiff: { type: Number, required: true, default: 0 },

    itcAvailability: { type: String, required: true },
    itcCategory: {
      type: String,
      enum: ['ELIGIBLE', 'BLOCKED', 'RCM', 'EXEMPT', 'NIL_RATED', 'ZERO_RATED', 'INELIGIBLE'],
      required: true,
    },
    itcClaimableAmount: { type: Number, required: true, default: 0 },
    itcBlockedAmount: { type: Number, required: true, default: 0 },

    aiExplanation: { type: String, default: null },
  },
  { _id: false },
);

/** Sub-document schema for reconciliation summary totals */
const ReconciliationSummarySchema = new Schema<IReconciliationSummary>(
  {
    totalInvoices: { type: Number, required: true, default: 0 },
    matchedCount: { type: Number, required: true, default: 0 },
    fuzzyMatchCount: { type: Number, required: true, default: 0 },
    needsReviewCount: { type: Number, required: true, default: 0 },
    missingIn2aCount: { type: Number, required: true, default: 0 },
    missingIn2bCount: { type: Number, required: true, default: 0 },
    valueMismatchCount: { type: Number, required: true, default: 0 },
    gstinMismatchCount: { type: Number, required: true, default: 0 },
    totalEligibleItc: { type: Number, required: true, default: 0 },
    totalBlockedItc: { type: Number, required: true, default: 0 },
    totalIneligibleItc: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

/** Main Reconciliation schema */
const ReconciliationSchema = new Schema<IReconciliation>(
  {
    reconciliationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    period: { type: String, required: true },
    financialYear: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'PENDING',
    },
    results: { type: [ReconciliationResultSchema], default: [] },
    summary: { type: ReconciliationSummarySchema, required: true },
  },
  {
    timestamps: true, // manages createdAt and updatedAt
  },
);

export const ReconciliationModel = mongoose.model<IReconciliation>(
  'Reconciliation',
  ReconciliationSchema,
);

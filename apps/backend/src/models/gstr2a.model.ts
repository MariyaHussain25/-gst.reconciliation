/**
 * @file apps/backend/src/models/gstr2a.model.ts
 * @description Mongoose schema and model for GSTR-2A invoice records.
 * Fields are based EXACTLY on the real GSTR-2A Voucher Register Excel format.
 *
 * Phase 2: Schema defined based on real data samples.
 * Phase 5: Used as input by the reconciliation matching engine.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** TypeScript interface extending Mongoose Document for type safety */
export interface IGstr2ARecord extends Document {
  // File metadata
  /** Which user uploaded this file */
  userId: string;
  /** Original uploaded file name */
  fileName: string;
  /** Period start date string, e.g. "1-Mar-23" */
  periodStart: string;
  /** Period end date string, e.g. "31-Mar-23" */
  periodEnd: string;
  /** Company name extracted from file header, e.g. "NEXUS PROFILES" */
  companyName: string;
  /** Buyer's GST Registration number, e.g. "36BOTPJ1566A1ZX" */
  gstin: string;

  // Invoice fields (EXACTLY from Excel columns)
  /** Invoice date string, e.g. "15-Mar-23" */
  date: string;
  /** Supplier name from "Particulars" column, e.g. "RANJEET GLASS COMPANY" */
  particulars: string;
  /** Supplier's GSTIN/UIN, e.g. "36AMHPB5107A1ZT" */
  partyGstin: string;
  /** Voucher type, e.g. "Purchase" */
  vchType: string;
  /** Voucher number */
  vchNo: number;
  /** Taxable amount (excluding tax) */
  taxableAmount: number;
  /** Integrated GST amount */
  igst: number;
  /** Central GST amount */
  cgst: number;
  /** State/UT GST amount */
  sgstUtgst: number;
  /** Cess amount */
  cess: number;
  /** Total tax amount (IGST + CGST + SGST + Cess) */
  taxAmount: number;
  /** Total invoice amount (taxable + tax) */
  invoiceAmount: number;

  createdAt: Date;
}

/** Mongoose schema for GSTR-2A records */
const Gstr2ASchema = new Schema<IGstr2ARecord>(
  {
    // File metadata
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    companyName: { type: String, required: true },
    gstin: { type: String, required: true },

    // Invoice fields
    date: { type: String, required: true },
    particulars: { type: String, required: true },
    partyGstin: { type: String, required: true },
    vchType: { type: String, required: true },
    vchNo: { type: Number, required: true },
    taxableAmount: { type: Number, required: true, default: 0 },
    igst: { type: Number, required: true, default: 0 },
    cgst: { type: Number, required: true, default: 0 },
    sgstUtgst: { type: Number, required: true, default: 0 },
    cess: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
    invoiceAmount: { type: Number, required: true, default: 0 },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Compound index for reconciliation queries: find all 2A records for a user
Gstr2ASchema.index({ userId: 1, periodStart: 1, periodEnd: 1 });
// Index for supplier GSTIN lookups during matching
Gstr2ASchema.index({ userId: 1, partyGstin: 1 });

export const Gstr2AModel = mongoose.model<IGstr2ARecord>('Gstr2A', Gstr2ASchema);

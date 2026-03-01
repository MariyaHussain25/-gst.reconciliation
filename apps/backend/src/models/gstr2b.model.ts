/**
 * @file apps/backend/src/models/gstr2b.model.ts
 * @description Mongoose schema and model for GSTR-2B invoice records.
 * Fields are based EXACTLY on the real GSTR-2B multi-sheet Excel format.
 *
 * Phase 2: Schema defined based on real data samples.
 * Phase 5: Used as input by the reconciliation matching engine.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** TypeScript interface extending Mongoose Document for type safety */
export interface IGstr2BRecord extends Document {
  // File metadata
  /** Which user uploaded this file */
  userId: string;
  /** Original uploaded file name */
  fileName: string;
  /** Financial year string, e.g. "2022-23" */
  financialYear: string;
  /** Tax period name, e.g. "March" */
  taxPeriod: string;
  /** Buyer's GSTIN, e.g. "36BOTPJ1566A1ZX" */
  buyerGstin: string;
  /** Legal name of the buyer, e.g. "JUMANA" */
  legalName: string;
  /** Trade name of the buyer, e.g. "NEXUS PROFILES" */
  tradeName: string;
  /** Date the GSTR-2B was generated, e.g. "14/04/2023" */
  dateOfGeneration: string;
  /** Excel sheet name this record came from, e.g. "B2B" | "B2BA" | "B2B-CDNR" */
  sheetName: string;

  // B2B Invoice fields (EXACTLY from Excel columns)
  /** Supplier's GSTIN, e.g. "36AAKFL0555F1ZE" */
  supplierGstin: string;
  /** Supplier's trade or legal name, e.g. "LIBERTY GLASS CREATIONS" */
  supplierTradeName: string;
  /** Invoice number as reported by supplier, e.g. "544" */
  invoiceNumber: string;
  /**
   * Invoice type:
   * - "Regular" (R) = Regular invoices other than SEZ and Deemed exports
   * - "SEZWP" = SEZ supplies with payment of tax
   * - "SEZWOP" = SEZ supplies without payment of tax
   * - "DE" = Deemed exports
   * - "CBW" = Intra-State Supplies attracting IGST
   */
  invoiceType: string;
  /** Invoice date string, e.g. "25/03/2023" (DD/MM/YYYY) */
  invoiceDate: string;
  /** Total invoice value in INR */
  invoiceValue: number;
  /** State where supply is made, e.g. "Telangana" */
  placeOfSupply: string;
  /** Whether supply attracts Reverse Charge: "Y" / "N" or "Yes" / "No" */
  supplyAttractsReverseCharge: string;
  /** Applicable GST rate percentage, null if not present */
  taxRate: number | null;
  /** Taxable value (before tax) */
  taxableValue: number;
  /** Integrated Tax (IGST) amount */
  integratedTax: number;
  /** Central Tax (CGST) amount */
  centralTax: number;
  /** State/UT Tax (SGST/UTGST) amount */
  stateUtTax: number;
  /** Cess amount */
  cess: number;
  /** GSTR-1/IFF/GSTR-5 filing period, null if not present */
  gstr1Period: string | null;
  /** GSTR-1/IFF/GSTR-5 filing date, null if not present */
  gstr1FilingDate: string | null;
  /** Whether ITC is available: "Yes" / "No" */
  itcAvailability: string;
  /** Reason ITC is unavailable, null if ITC is available */
  itcUnavailableReason: string | null;
  /** Applicable percentage of tax rate (e.g. 65), null if not applicable */
  applicableTaxRatePercent: number | null;
  /** Invoice source, e.g. "e-invoice" or empty string */
  source: string;
  /** Invoice Reference Number, null if not e-invoice */
  irn: string | null;
  /** IRN generation date, null if not e-invoice */
  irnDate: string | null;

  createdAt: Date;
}

/** Mongoose schema for GSTR-2B records */
const Gstr2BSchema = new Schema<IGstr2BRecord>(
  {
    // File metadata
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    financialYear: { type: String, required: true },
    taxPeriod: { type: String, required: true },
    buyerGstin: { type: String, required: true },
    legalName: { type: String, required: true },
    tradeName: { type: String, required: true },
    dateOfGeneration: { type: String, required: true },
    sheetName: { type: String, required: true },

    // Invoice fields
    supplierGstin: { type: String, required: true },
    supplierTradeName: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    invoiceType: { type: String, required: true },
    invoiceDate: { type: String, required: true },
    invoiceValue: { type: Number, required: true, default: 0 },
    placeOfSupply: { type: String, required: true },
    supplyAttractsReverseCharge: { type: String, required: true },
    taxRate: { type: Number, default: null },
    taxableValue: { type: Number, required: true, default: 0 },
    integratedTax: { type: Number, required: true, default: 0 },
    centralTax: { type: Number, required: true, default: 0 },
    stateUtTax: { type: Number, required: true, default: 0 },
    cess: { type: Number, required: true, default: 0 },
    gstr1Period: { type: String, default: null },
    gstr1FilingDate: { type: String, default: null },
    itcAvailability: { type: String, required: true },
    itcUnavailableReason: { type: String, default: null },
    applicableTaxRatePercent: { type: Number, default: null },
    source: { type: String, default: '' },
    irn: { type: String, default: null },
    irnDate: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Compound index for reconciliation queries
Gstr2BSchema.index({ userId: 1, financialYear: 1, taxPeriod: 1 });
// Index for supplier GSTIN lookups during matching
Gstr2BSchema.index({ userId: 1, supplierGstin: 1 });

export const Gstr2BModel = mongoose.model<IGstr2BRecord>('Gstr2B', Gstr2BSchema);

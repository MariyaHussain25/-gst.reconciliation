/**
 * @file apps/backend/src/services/process.service.ts
 * @description Orchestrates the full GST reconciliation pipeline for a user.
 * Coordinates: standardization → matching → ITC classification → RAG enrichment.
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 4: Integrate standardize.service — fetch, map, standardize, persist invoices.
 * Phase 5: Integrate matching.service (3-pass engine)
 * Phase 6: Integrate itc.service + rag.service
 * Phase 7: Integrate llm.service for AI categorization
 */

import type { ProcessResponse } from '@gst/shared';
import { Gstr2AModel } from '../models/gstr2a.model.js';
import { Gstr2BModel } from '../models/gstr2b.model.js';
import { InvoiceModel } from '../models/invoice.model.js';
import { ReconciliationModel } from '../models/reconciliation.model.js';
import type { IReconciliationResult } from '../models/reconciliation.model.js';
import { mapGstr2AToRawInvoices, mapGstr2BToRawInvoices } from './mappers/index.js';
import { standardizeInvoices } from './standardize.service.js';
import { parseGstDate } from '../utils/date.utils.js';
import { runFullMatchingPipeline } from './matching.service.js';

// ---------------------------------------------------------------------------
// Period matching helpers
// ---------------------------------------------------------------------------

/**
 * Derives a `YYYY-MM` string from a GSTR-2A `periodEnd` date string.
 * GSTR-2A uses strings like `"31-Mar-23"` or `"31-03-2023"`.
 * We take the periodEnd date because it represents the closing month of the period.
 *
 * @param periodEnd - Period end date string from the GSTR-2A record
 */
function periodFromGstr2AEnd(periodEnd: string): string {
  try {
    const d = parseGstDate(periodEnd);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  } catch {
    return '';
  }
}

/** Maps month names (full English, case-insensitive) to zero-padded month numbers */
const MONTH_NAME_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

/**
 * Converts GSTR-2B `financialYear` (e.g. `"2022-23"`) and `taxPeriod` (e.g. `"March"`)
 * into a `YYYY-MM` period string.
 *
 * GSTR-2B financial years span April–March. Months Apr–Dec belong to the first
 * calendar year in the FY string; months Jan–Mar belong to the second calendar year.
 *
 * @param financialYear - e.g. `"2022-23"`
 * @param taxPeriod     - e.g. `"March"` or `"October"`
 */
function periodFromGstr2BMeta(financialYear: string, taxPeriod: string): string {
  const mm = MONTH_NAME_MAP[taxPeriod.toLowerCase()];
  if (!mm) return '';

  // Parse the two calendar years from the FY string, e.g. "2022-23" → [2022, 2023]
  const fyMatch = financialYear.match(/^(\d{4})-(\d{2,4})$/);
  if (!fyMatch) return '';

  const yearFirst = parseInt(fyMatch[1], 10);
  const yearSecondStr = fyMatch[2];
  const yearSecond =
    yearSecondStr.length === 2
      ? Math.floor(yearFirst / 100) * 100 + parseInt(yearSecondStr, 10)
      : parseInt(yearSecondStr, 10);

  // Apr–Dec → first year, Jan–Mar → second year
  const monthNum = parseInt(mm, 10);
  const yyyy = monthNum >= 4 ? yearFirst : yearSecond;

  return `${yyyy}-${mm}`;
}

// ---------------------------------------------------------------------------
// Financial year helpers
// ---------------------------------------------------------------------------

/**
 * Derives a financial year string (e.g. "2022-23") from a YYYY-MM period.
 * GST FY runs April–March: period months 04–12 belong to the year starting in that
 * calendar year; months 01–03 belong to the FY starting the previous calendar year.
 */
function financialYearFromPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = String(fyStart + 1).slice(-2);
  return `${fyStart}-${fyEnd}`;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the full reconciliation pipeline for a user for a given tax period.
 *
 * Pipeline stages:
 * 1. Fetch GSTR-2A records for the user + period from MongoDB
 * 2. Fetch GSTR-2B records for the user + period from MongoDB
 * 3. Map fetched documents to RawInvoiceData using the mapper functions
 * 4. Standardize both sets via standardizeInvoices()
 * 5. Delete existing invoices for this user+period (idempotent re-processing)
 * 6. Persist standardized invoices via InvoiceModel.insertMany()
 * 7. Run 3-pass matching pipeline
 * 8. Create/update ReconciliationModel document with results
 * 9. Return real summary counts
 *
 * @param userId - The ID of the user to process
 * @param period - The tax period to reconcile (YYYY-MM format)
 * @returns Process response with summary statistics
 */
export async function runReconciliationPipeline(
  userId: string,
  period: string,
): Promise<ProcessResponse> {
  // ------------------------------------------------------------------
  // 1. Fetch GSTR-2A records matching userId + period
  // ------------------------------------------------------------------
  const allGstr2ARecords = await Gstr2AModel.find({ userId }).lean();
  const gstr2ARecords = allGstr2ARecords.filter(
    (rec) => periodFromGstr2AEnd(rec.periodEnd) === period,
  );

  // ------------------------------------------------------------------
  // 2. Fetch GSTR-2B records matching userId + period
  // ------------------------------------------------------------------
  const allGstr2BRecords = await Gstr2BModel.find({ userId }).lean();
  const gstr2BRecords = allGstr2BRecords.filter(
    (rec) => periodFromGstr2BMeta(rec.financialYear, rec.taxPeriod) === period,
  );

  // ------------------------------------------------------------------
  // 3. Map Mongoose documents → RawInvoiceData[]
  // ------------------------------------------------------------------
  const raw2A =
    gstr2ARecords.length > 0
      ? mapGstr2AToRawInvoices(gstr2ARecords, {
          companyName: gstr2ARecords[0].companyName,
          periodStart: gstr2ARecords[0].periodStart,
          periodEnd: gstr2ARecords[0].periodEnd,
          gstin: gstr2ARecords[0].gstin,
        })
      : [];

  const raw2B =
    gstr2BRecords.length > 0
      ? mapGstr2BToRawInvoices(gstr2BRecords, {
          financialYear: gstr2BRecords[0].financialYear,
          taxPeriod: gstr2BRecords[0].taxPeriod,
          buyerGstin: gstr2BRecords[0].buyerGstin,
          legalName: gstr2BRecords[0].legalName,
          tradeName: gstr2BRecords[0].tradeName,
          dateOfGeneration: gstr2BRecords[0].dateOfGeneration,
        })
      : [];

  // ------------------------------------------------------------------
  // 4. Standardize both sets
  // ------------------------------------------------------------------
  const std2A = standardizeInvoices(raw2A, userId, 'GSTR_2A');
  const std2B = standardizeInvoices(raw2B, userId, 'GSTR_2B');
  const allStandardized = [...std2A, ...std2B];

  // ------------------------------------------------------------------
  // 5. Delete existing invoices for this user+period (idempotent)
  // ------------------------------------------------------------------
  await InvoiceModel.deleteMany({ userId, period });

  // ------------------------------------------------------------------
  // 6. Persist standardized invoices
  // ------------------------------------------------------------------
  if (allStandardized.length > 0) {
    await InvoiceModel.insertMany(allStandardized);
  }

  // ------------------------------------------------------------------
  // 7. Run 3-pass matching pipeline
  // ------------------------------------------------------------------
  const matchResults = await runFullMatchingPipeline(userId, period);

  // ------------------------------------------------------------------
  // 8. Build summary counts from match results
  // ------------------------------------------------------------------
  let matched = 0;
  let fuzzyMatched = 0;
  let needsReview = 0;
  let unmatched = 0;
  let missingIn2b = 0;
  let missingIn2a = 0;
  let valueMismatch = 0;
  let gstinMismatch = 0;

  for (const r of matchResults) {
    switch (r.matchStatus) {
      case 'MATCHED': matched++; break;
      case 'FUZZY_MATCH': fuzzyMatched++; break;
      case 'NEEDS_REVIEW': needsReview++; break;
      case 'MISSING_IN_2B': missingIn2b++; break;
      case 'MISSING_IN_BOOKS': missingIn2a++; break;
      case 'VALUE_MISMATCH': valueMismatch++; break;
      case 'GSTIN_MISMATCH': gstinMismatch++; break;
      default: unmatched++; break;
    }
  }

  // ------------------------------------------------------------------
  // 9. Build ReconciliationResult entries from match results
  // ------------------------------------------------------------------
  // Re-fetch persisted invoices to get their _id values
  const persistedInvoices = await InvoiceModel.find({ userId, period }).lean();
  // Build a Map for O(1) lookups instead of O(n) per result
  const persistedById = new Map(persistedInvoices.map((i) => [String(i._id), i]));

  const reconResults: IReconciliationResult[] = matchResults.map((r) => {
    const primaryInv = persistedById.get(r.invoiceId) ?? null;
    const inv2a = r.matchStatus !== 'MISSING_IN_BOOKS' && primaryInv?.source === 'GSTR_2A'
      ? primaryInv
      : null;
    const inv2b = r.matchedInvoiceId
      ? (persistedById.get(r.matchedInvoiceId) ?? null)
      : r.matchStatus === 'MISSING_IN_BOOKS' && primaryInv?.source === 'GSTR_2B'
        ? primaryInv
        : null;

    // Map to reconciliation match status (MISSING_IN_BOOKS → MISSING_IN_2A in recon model;
    // UNMATCHED fallback → NEEDS_REVIEW since recon model doesn't have UNMATCHED)
    type ReconStatus = IReconciliationResult['matchStatus'];
    const reconStatus: ReconStatus =
      r.matchStatus === 'MISSING_IN_BOOKS'
        ? 'MISSING_IN_2A'
        : r.matchStatus === 'UNMATCHED'
          ? 'NEEDS_REVIEW'
          : (r.matchStatus as ReconStatus);

    return {
      gstr2aRecordId: inv2a ? String(inv2a._id) : null,
      gstr2bRecordId: inv2b ? String(inv2b._id) : null,
      gstr2aVendorName: inv2a ? inv2a.vendorName : null,
      gstr2aVendorGstin: inv2a ? inv2a.gstin : null,
      gstr2aVchNo: null,
      gstr2aInvoiceAmount: inv2a ? inv2a.totalAmount : null,
      gstr2aTaxableAmount: inv2a ? inv2a.taxableAmount : null,
      gstr2aIgst: inv2a ? inv2a.igst : null,
      gstr2aCgst: inv2a ? inv2a.cgst : null,
      gstr2aSgst: inv2a ? inv2a.sgst : null,
      gstr2bVendorName: inv2b ? inv2b.vendorName : null,
      gstr2bVendorGstin: inv2b ? inv2b.gstin : null,
      gstr2bInvoiceNumber: inv2b ? inv2b.invoiceNumber : null,
      gstr2bInvoiceValue: inv2b ? inv2b.totalAmount : null,
      gstr2bTaxableValue: inv2b ? inv2b.taxableAmount : null,
      gstr2bIgst: inv2b ? inv2b.igst : null,
      gstr2bCgst: inv2b ? inv2b.cgst : null,
      gstr2bSgst: inv2b ? inv2b.sgst : null,
      gstr2bItcAvailability: null,
      matchStatus: reconStatus,
      matchConfidence: r.matchConfidence,
      mismatchFields: r.mismatchFields ?? [],
      mismatchReason: r.mismatchReason ?? null,
      taxableAmountDiff: r.taxableAmountDiff ?? 0,
      igstDiff: r.igstDiff ?? 0,
      cgstDiff: r.cgstDiff ?? 0,
      sgstDiff: r.sgstDiff ?? 0,
      totalAmountDiff: r.totalAmountDiff ?? 0,
      itcAvailability: 'Pending',
      itcCategory: 'ELIGIBLE',
      itcClaimableAmount: 0,
      itcBlockedAmount: 0,
      aiExplanation: null,
    };
  });

  const reconciliationId = `recon-${userId}-${period}-${Date.now()}`;
  const financialYear = financialYearFromPeriod(period);

  await ReconciliationModel.create({
    reconciliationId,
    userId,
    period,
    financialYear,
    status: 'COMPLETED',
    results: reconResults,
    summary: {
      totalInvoices: allStandardized.length,
      matchedCount: matched,
      fuzzyMatchCount: fuzzyMatched,
      needsReviewCount: needsReview,
      missingIn2aCount: missingIn2a,
      missingIn2bCount: missingIn2b,
      valueMismatchCount: valueMismatch,
      gstinMismatchCount: gstinMismatch,
      totalEligibleItc: 0,
      totalBlockedItc: 0,
      totalIneligibleItc: 0,
    },
  });

  return {
    userId,
    resultDocId: reconciliationId,
    period,
    summary: {
      totalInvoices: allStandardized.length,
      matched,
      fuzzyMatched,
      needsReview,
      unmatched: missingIn2b + missingIn2a + unmatched,
      eligibleItcAmount: 0,
      blockedItcAmount: 0,
    },
  };
}

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
import { mapGstr2AToRawInvoices, mapGstr2BToRawInvoices } from './mappers/index.js';
import { standardizeInvoices } from './standardize.service.js';
import { parseGstDate } from '../utils/date.utils.js';

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
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the full reconciliation pipeline for a user for a given tax period.
 *
 * Pipeline stages (Phase 4):
 * 1. Fetch GSTR-2A records for the user + period from MongoDB
 * 2. Fetch GSTR-2B records for the user + period from MongoDB
 * 3. Map fetched documents to RawInvoiceData using the mapper functions
 * 4. Standardize both sets via standardizeInvoices()
 * 5. Delete existing invoices for this user+period (idempotent re-processing)
 * 6. Persist standardized invoices via InvoiceModel.insertMany()
 * 7. Return real totalInvoices count (matching is Phase 5)
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
  //    GSTR-2A stores periodStart/periodEnd as date strings, so we
  //    fetch all records and filter by derived period in memory to
  //    avoid complex regex queries against varied date string formats.
  // ------------------------------------------------------------------
  const allGstr2ARecords = await Gstr2AModel.find({ userId }).lean();
  const gstr2ARecords = allGstr2ARecords.filter(
    (rec) => periodFromGstr2AEnd(rec.periodEnd) === period,
  );

  // ------------------------------------------------------------------
  // 2. Fetch GSTR-2B records matching userId + period
  //    GSTR-2B stores financialYear + taxPeriod (e.g. "2022-23" + "March")
  //    so we fetch and filter in memory for correctness.
  // ------------------------------------------------------------------
  const allGstr2BRecords = await Gstr2BModel.find({ userId }).lean();
  const gstr2BRecords = allGstr2BRecords.filter(
    (rec) => periodFromGstr2BMeta(rec.financialYear, rec.taxPeriod) === period,
  );

  // ------------------------------------------------------------------
  // 3. Map Mongoose documents → RawInvoiceData[]
  //    The mapper functions accept plain objects that match the parser
  //    interface shapes (IGstr2ARecord / IGstr2BRecord are supersets).
  //    Metadata is derived from the first record when available; an
  //    empty array produces an empty RawInvoiceData[] harmlessly.
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
  // 7. Return summary (matching stats are Phase 5)
  // ------------------------------------------------------------------
  return {
    userId,
    resultDocId: `result-${userId}-${period}-${Date.now()}`,
    period,
    summary: {
      totalInvoices: allStandardized.length,
      matched: 0,
      fuzzyMatched: 0,
      needsReview: 0,
      unmatched: 0,
      eligibleItcAmount: 0,
      blockedItcAmount: 0,
    },
  };
}

/**
 * @file apps/backend/src/services/matching.service.ts
 * @description 3-pass invoice matching engine.
 * Matches invoices from purchase books against GSTR-2B using progressive strategies:
 *   Pass 1 — Exact match (GSTIN + invoice number + amount)
 *   Pass 2 — Fuzzy match (Fuse.js on normalized vendor name + invoice number)
 *   Pass 3 — Classification (remaining unmatched → MISSING_IN_2B / MISSING_IN_BOOKS)
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 5: Implement full 3-pass matching engine with Fuse.js.
 * Phase 7: Add AI-assisted matching with GPT-4o.
 */

import Fuse from 'fuse.js';
import { InvoiceModel } from '../models/invoice.model.js';
import type { IInvoice } from '../models/invoice.model.js';

/** Result of matching a single invoice */
export interface MatchResult {
  invoiceId: string;
  matchedInvoiceId?: string;
  matchStatus:
    | 'MATCHED'
    | 'FUZZY_MATCH'
    | 'NEEDS_REVIEW'
    | 'MISSING_IN_2B'
    | 'MISSING_IN_BOOKS'
    | 'VALUE_MISMATCH'
    | 'GSTIN_MISMATCH'
    | 'UNMATCHED';
  matchConfidence: number; // 0–100
  mismatchFields?: string[];
  mismatchReason?: string;
  taxableAmountDiff?: number;
  igstDiff?: number;
  cgstDiff?: number;
  sgstDiff?: number;
  totalAmountDiff?: number;
}

/** Compare two amounts within a given tolerance */
function amountsMatch(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Compare invoice amounts and return mismatch info */
function compareAmounts(
  inv2a: IInvoice,
  inv2b: IInvoice,
  tolerance: number,
): { match: boolean; fields: string[]; diffs: Record<string, number> } {
  const fields: string[] = [];
  const diffs: Record<string, number> = {};

  for (const field of ['taxableAmount', 'igst', 'cgst', 'sgst'] as const) {
    const diff = inv2a[field] - inv2b[field];
    if (!amountsMatch(inv2a[field], inv2b[field], tolerance)) {
      fields.push(field);
    }
    diffs[`${field}Diff`] = diff;
  }
  diffs['totalAmountDiff'] = inv2a.totalAmount - inv2b.totalAmount;

  return { match: fields.length === 0, fields, diffs };
}

/**
 * Pass 1: Exact matching based on GSTIN + normalizedInvoiceNumber + amounts.
 * Most reliable match — confidence score: 100.
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @returns Array of exact match results
 */
export async function runExactMatchPass(
  userId: string,
  period: string,
): Promise<MatchResult[]> {
  console.log(`[Matching] Pass 1 — Exact match for user=${userId}, period=${period}`);

  const allInvoices = await InvoiceModel.find({ userId, period }).lean<IInvoice[]>();
  const invoices2A = allInvoices.filter((inv) => inv.source === 'GSTR_2A');
  const invoices2B = allInvoices.filter((inv) => inv.source === 'GSTR_2B');

  // Build a lookup map: gstin|normalizedInvoiceNumber → 2B invoice
  const portalMap = new Map<string, IInvoice>();
  for (const inv of invoices2B) {
    const key = `${inv.gstin}|${inv.normalizedInvoiceNumber}`;
    portalMap.set(key, inv);
  }

  const results: MatchResult[] = [];
  const consumedPortalIds = new Set<string>();
  const bulkOps: Parameters<typeof InvoiceModel.bulkWrite>[0] = [];

  for (const inv2a of invoices2A) {
    const key = `${inv2a.gstin}|${inv2a.normalizedInvoiceNumber}`;
    const inv2b = portalMap.get(key);
    if (!inv2b || consumedPortalIds.has(String(inv2b._id))) continue;

    const { match, fields, diffs } = compareAmounts(inv2a, inv2b, 1.0);
    const status = match ? 'MATCHED' : 'VALUE_MISMATCH';
    const confidence = match ? 100 : 90;

    const result: MatchResult = {
      invoiceId: String(inv2a._id),
      matchedInvoiceId: String(inv2b._id),
      matchStatus: status,
      matchConfidence: confidence,
      taxableAmountDiff: diffs['taxableAmountDiff'],
      igstDiff: diffs['igstDiff'],
      cgstDiff: diffs['cgstDiff'],
      sgstDiff: diffs['sgstDiff'],
      totalAmountDiff: diffs['totalAmountDiff'],
    };
    if (!match) {
      result.mismatchFields = fields;
      result.mismatchReason = `Amount mismatch in: ${fields.join(', ')}`;
    }
    results.push(result);

    consumedPortalIds.add(String(inv2b._id));

    // Update both invoices
    bulkOps.push({
      updateOne: {
        filter: { _id: inv2a._id },
        update: { $set: { matchStatus: status, matchConfidence: confidence } },
      },
    });
    bulkOps.push({
      updateOne: {
        filter: { _id: inv2b._id },
        update: { $set: { matchStatus: status, matchConfidence: confidence } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await InvoiceModel.bulkWrite(bulkOps);
  }

  return results;
}

/**
 * Pass 2: Fuzzy matching using Fuse.js on normalized vendor name and invoice number.
 * Handles OCR errors, typos, and minor formatting differences.
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @param unmatchedIds - Invoice IDs that were not matched in Pass 1
 * @returns Array of fuzzy match results
 */
export async function runFuzzyMatchPass(
  userId: string,
  period: string,
  unmatchedIds: string[],
): Promise<MatchResult[]> {
  console.log(`[Matching] Pass 2 — Fuzzy match for user=${userId}, period=${period}`);

  if (unmatchedIds.length === 0) return [];

  // Fetch all still-unmatched invoices for this user+period
  const allInvoices = await InvoiceModel.find({
    userId,
    period,
    matchStatus: 'UNMATCHED',
  }).lean<IInvoice[]>();

  const unmatched2A = allInvoices.filter((inv) => inv.source === 'GSTR_2A');
  const unmatched2B = allInvoices.filter((inv) => inv.source === 'GSTR_2B');

  if (unmatched2A.length === 0 || unmatched2B.length === 0) return [];

  // Build Fuse.js index from 2B invoices
  const fuse = new Fuse(unmatched2B, {
    threshold: 0.4,
    includeScore: true,
    keys: [
      { name: 'normalizedVendorName', weight: 0.6 },
      { name: 'normalizedInvoiceNumber', weight: 0.4 },
    ],
  });

  const results: MatchResult[] = [];
  const consumedPortalIds = new Set<string>();
  const bulkOps: Parameters<typeof InvoiceModel.bulkWrite>[0] = [];

  for (const inv2a of unmatched2A) {
    const query = `${inv2a.normalizedVendorName} ${inv2a.normalizedInvoiceNumber}`;
    const fuseResults = fuse.search(query);

    if (fuseResults.length === 0) continue;

    const best = fuseResults[0];
    const fuseScore = best.score ?? 1;
    if (fuseScore >= 0.4) continue; // not close enough

    const inv2b = best.item;
    if (consumedPortalIds.has(String(inv2b._id))) continue;

    let status: MatchResult['matchStatus'];
    let confidence: number;
    const result: MatchResult = {
      invoiceId: String(inv2a._id),
      matchedInvoiceId: String(inv2b._id),
      matchStatus: 'UNMATCHED',
      matchConfidence: 0,
    };

    if (inv2a.gstin === inv2b.gstin) {
      const { match, fields, diffs } = compareAmounts(inv2a, inv2b, 2.0);
      result.taxableAmountDiff = diffs['taxableAmountDiff'];
      result.igstDiff = diffs['igstDiff'];
      result.cgstDiff = diffs['cgstDiff'];
      result.sgstDiff = diffs['sgstDiff'];
      result.totalAmountDiff = diffs['totalAmountDiff'];

      if (match) {
        status = 'FUZZY_MATCH';
        confidence = Math.round((1 - fuseScore) * 100);
      } else {
        status = 'VALUE_MISMATCH';
        confidence = Math.round((1 - fuseScore) * 90);
        result.mismatchFields = fields;
        result.mismatchReason = `Amount mismatch in: ${fields.join(', ')}`;
      }
    } else {
      status = 'GSTIN_MISMATCH';
      confidence = Math.round((1 - fuseScore) * 80);
      result.mismatchReason = `GSTIN mismatch: 2A=${inv2a.gstin}, 2B=${inv2b.gstin}`;
    }

    result.matchStatus = status;
    result.matchConfidence = confidence;
    results.push(result);

    consumedPortalIds.add(String(inv2b._id));

    bulkOps.push({
      updateOne: {
        filter: { _id: inv2a._id },
        update: { $set: { matchStatus: status, matchConfidence: confidence } },
      },
    });
    bulkOps.push({
      updateOne: {
        filter: { _id: inv2b._id },
        update: { $set: { matchStatus: status, matchConfidence: confidence } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await InvoiceModel.bulkWrite(bulkOps);
  }

  return results;
}

/**
 * Pass 3 (Classification): Classify all remaining unmatched invoices.
 * GSTR-2A invoices with no match → MISSING_IN_2B
 * GSTR-2B invoices with no match → MISSING_IN_BOOKS
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @returns Array of classification results
 */
export async function runClassificationPass(
  userId: string,
  period: string,
): Promise<MatchResult[]> {
  console.log(`[Matching] Pass 3 — Classification for user=${userId}, period=${period}`);

  const stillUnmatched = await InvoiceModel.find({
    userId,
    period,
    matchStatus: 'UNMATCHED',
  }).lean<IInvoice[]>();

  const results: MatchResult[] = [];
  const bulkOps: Parameters<typeof InvoiceModel.bulkWrite>[0] = [];

  for (const inv of stillUnmatched) {
    const status: MatchResult['matchStatus'] =
      inv.source === 'GSTR_2A' ? 'MISSING_IN_2B' : 'MISSING_IN_BOOKS';

    results.push({
      invoiceId: String(inv._id),
      matchStatus: status,
      matchConfidence: 0,
    });

    bulkOps.push({
      updateOne: {
        filter: { _id: inv._id },
        update: { $set: { matchStatus: status, matchConfidence: 0 } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await InvoiceModel.bulkWrite(bulkOps);
  }

  return results;
}

/**
 * Pass 3 (AI-assisted): AI-assisted matching using GPT-4o for ambiguous/edge cases.
 * Used as last resort when fuzzy matching cannot reach a reliable threshold.
 * Confidence score: based on LLM response.
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @param unmatchedIds - Invoice IDs that were not matched in Passes 1 and 2
 * @returns Array of AI-assisted match results
 *
 * TODO (Phase 7): Integrate LLM service for AI-assisted matching
 */
export async function runAiMatchPass(
  userId: string,
  period: string,
  unmatchedIds: string[],
): Promise<MatchResult[]> {
  // TODO (Phase 7): Implement AI-assisted matching using llm.service
  console.log(`[Matching] Pass 3 — AI match for user=${userId}, period=${period}`);
  return unmatchedIds.map((invoiceId) => ({
    invoiceId,
    matchStatus: 'NEEDS_REVIEW' as const,
    matchConfidence: 0,
  }));
}

/**
 * Orchestrates the full 3-pass matching pipeline for a user+period.
 * Pass 1 → Pass 2 → Pass 3 (classification)
 *
 * @param userId - The user ID to reconcile
 * @param period - The tax period (YYYY-MM)
 * @returns Combined match results from all passes
 */
export async function runFullMatchingPipeline(
  userId: string,
  period: string,
): Promise<MatchResult[]> {
  console.log(`[Matching] Starting full pipeline for user=${userId}, period=${period}`);

  const pass1Results = await runExactMatchPass(userId, period);

  const unmatchedAfterPass1 = pass1Results
    .filter((r) => r.matchStatus === 'UNMATCHED')
    .map((r) => r.invoiceId);

  const pass2Results = await runFuzzyMatchPass(userId, period, unmatchedAfterPass1);

  const pass3Results = await runClassificationPass(userId, period);

  return [...pass1Results, ...pass2Results, ...pass3Results];
}

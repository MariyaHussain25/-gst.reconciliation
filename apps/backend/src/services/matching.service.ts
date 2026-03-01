/**
 * @file apps/backend/src/services/matching.service.ts
 * @description 3-pass invoice matching engine.
 * Matches invoices from purchase books against GSTR-2B using progressive strategies:
 *   Pass 1 — Exact match (GSTIN + invoice number + date + amount)
 *   Pass 2 — Fuzzy match (Fuse.js on normalized vendor name + invoice number)
 *   Pass 3 — AI-assisted match (LLM for ambiguous cases)
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 5: Implement full 3-pass matching engine with Fuse.js.
 * Phase 7: Add AI-assisted matching with GPT-4o.
 */

/** Result of matching a single invoice */
export interface MatchResult {
  invoiceId: string;
  matchStatus:
    | 'MATCHED'
    | 'FUZZY_MATCH'
    | 'NEEDS_REVIEW'
    | 'MISSING_IN_2B'
    | 'VALUE_MISMATCH'
    | 'GSTIN_MISMATCH'
    | 'UNMATCHED';
  matchConfidence: number; // 0–100
  matchedInvoiceId?: string;
}

/**
 * Pass 1: Exact matching based on GSTIN + invoice number + date + amount.
 * Most reliable match — confidence score: 100.
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @returns Array of exact match results
 *
 * TODO (Phase 5): Query MongoDB for exact matches using compound index
 */
export async function runExactMatchPass(
  userId: string,
  period: string,
): Promise<MatchResult[]> {
  // TODO (Phase 5): Implement exact matching logic
  console.log(`[Matching] Pass 1 — Exact match for user=${userId}, period=${period}`);
  return [];
}

/**
 * Pass 2: Fuzzy matching using Fuse.js on normalized vendor name and invoice number.
 * Handles OCR errors, typos, and minor formatting differences.
 * Confidence score: 60–99 based on Fuse.js score.
 *
 * @param userId - User ID to scope the search
 * @param period - Tax period (YYYY-MM) to reconcile
 * @param unmatchedIds - Invoice IDs that were not matched in Pass 1
 * @returns Array of fuzzy match results
 *
 * TODO (Phase 5): Integrate Fuse.js for fuzzy matching
 */
export async function runFuzzyMatchPass(
  userId: string,
  period: string,
  unmatchedIds: string[],
): Promise<MatchResult[]> {
  // TODO (Phase 5): Implement Fuse.js fuzzy matching
  console.log(`[Matching] Pass 2 — Fuzzy match for user=${userId}, period=${period}`);
  return unmatchedIds.map((invoiceId) => ({
    invoiceId,
    matchStatus: 'UNMATCHED' as const,
    matchConfidence: 0,
  }));
}

/**
 * Pass 3: AI-assisted matching using GPT-4o for ambiguous/edge cases.
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

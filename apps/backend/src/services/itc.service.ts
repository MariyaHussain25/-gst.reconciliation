/**
 * @file apps/backend/src/services/itc.service.ts
 * @description ITC (Input Tax Credit) eligibility rules engine.
 * Determines whether ITC can be claimed for each matched invoice
 * based on GST rules (primarily Section 17 of CGST Act 2017).
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 6: Implement full rules engine with MongoDB-stored rules.
 *          Integrate with RAG pipeline for rule lookup.
 */

import type { ItcCategory } from '@gst/shared';

/** Result of ITC eligibility determination for a single invoice */
export interface ItcDetermination {
  invoiceId: string;
  itcCategory: ItcCategory;
  ruleIds: string[]; // Rules that were applied
  reasoning: string; // Human-readable explanation
}

/**
 * Determines ITC eligibility for a single invoice based on keywords and category.
 *
 * Rule categories:
 * - ELIGIBLE: Standard B2B purchases with proper GSTIN
 * - BLOCKED: Section 17(5) items (personal consumption, motor vehicles, etc.)
 * - RCM: Reverse Charge Mechanism (e.g. legal services, GTA)
 * - EXEMPT/NIL_RATED/ZERO_RATED: Based on supply type
 * - INELIGIBLE: Incomplete/invalid documents
 *
 * @param invoiceId - Invoice ID to evaluate
 * @param vendorName - Normalized vendor name
 * @param description - Invoice description (if available)
 * @returns ITC determination result
 *
 * TODO (Phase 6): Query GstRuleModel for matching rules using MongoDB text search
 * TODO (Phase 6): Use RAG (rag.service) for semantic rule retrieval
 * TODO (Phase 7): Use LLM (llm.service) for ambiguous cases
 */
export async function determineItcEligibility(
  invoiceId: string,
  vendorName: string,
  description?: string,
): Promise<ItcDetermination> {
  // TODO (Phase 6): Implement rules engine
  console.log(`[ITC] Evaluating eligibility for invoice=${invoiceId}, vendor=${vendorName}`);

  return {
    invoiceId,
    itcCategory: 'ELIGIBLE', // Placeholder: default to eligible
    ruleIds: [],
    reasoning: 'Placeholder: ITC rules engine not yet implemented (Phase 6)',
  };
}

/**
 * Applies ITC eligibility rules to a batch of invoice IDs for a user/period.
 *
 * @param userId - User ID to scope the batch
 * @param period - Tax period (YYYY-MM)
 * @returns Array of ITC determinations for all invoices in the period
 *
 * TODO (Phase 6): Batch process all matched invoices for the user/period
 */
export async function applyItcRules(
  userId: string,
  period: string,
): Promise<ItcDetermination[]> {
  // TODO (Phase 6): Fetch invoices and apply rules engine
  console.log(`[ITC] Applying ITC rules for user=${userId}, period=${period}`);
  return [];
}

/**
 * @file apps/backend/src/services/llm.service.ts
 * @description LLM service for AI-assisted reconciliation decisions.
 * Uses OpenAI GPT-4o via the Vercel AI SDK for:
 *   - Invoice matching assistance (ambiguous cases)
 *   - ITC categorization explanations
 *   - Natural language reconciliation reports
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 7: Implement full LLM pipeline with Vercel AI SDK.
 */

/** Request to the LLM for invoice matching assistance */
export interface LlmMatchRequest {
  booksInvoice: Record<string, unknown>;
  gstrInvoice: Record<string, unknown>;
  question: string;
}

/** LLM response for invoice matching */
export interface LlmMatchResponse {
  isMatch: boolean;
  confidence: number; // 0–100
  reasoning: string;
}

/** Request for generating a natural language reconciliation report */
export interface LlmReportRequest {
  userId: string;
  period: string;
  summaryStats: Record<string, unknown>;
  topDiscrepancies: Record<string, unknown>[];
}

/**
 * Uses GPT-4o to determine whether two invoice records refer to the same transaction.
 * Called during Pass 3 of the matching engine for ambiguous cases.
 *
 * @param request - The two invoice records and a guiding question
 * @returns LLM determination of whether the invoices match
 *
 * TODO (Phase 7): Call GPT-4o using Vercel AI SDK streamText/generateText
 * TODO (Phase 7): Include retrieved RAG context in the prompt
 */
export async function askLlmForMatchDecision(
  request: LlmMatchRequest,
): Promise<LlmMatchResponse> {
  // TODO (Phase 7): Implement LLM-assisted matching
  console.log('[LLM] Requesting match decision from GPT-4o');
  return {
    isMatch: false,
    confidence: 0,
    reasoning: 'Placeholder: LLM service not yet implemented (Phase 7)',
  };
}

/**
 * Generates a natural language reconciliation summary report using GPT-4o.
 * The report explains key discrepancies, ITC eligibility, and recommended actions.
 *
 * @param request - Summary statistics and top discrepancies to include in the report
 * @returns Markdown-formatted report string
 *
 * TODO (Phase 7): Implement report generation with structured prompt
 * TODO (Phase 7): Stream response using Vercel AI SDK for large reports
 */
export async function generateReconciliationReport(
  request: LlmReportRequest,
): Promise<string> {
  // TODO (Phase 7): Implement GPT-4o report generation
  console.log(`[LLM] Generating report for user=${request.userId}, period=${request.period}`);
  return '# Reconciliation Report\n\nPlaceholder: LLM service not yet implemented (Phase 7)';
}

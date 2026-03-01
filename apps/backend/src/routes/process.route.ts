/**
 * @file apps/backend/src/routes/process.route.ts
 * @description Route handler for the reconciliation processing endpoint.
 *
 * POST /process/:userId
 *   Triggers the full reconciliation pipeline for a user.
 *   Expects a `period` query parameter in YYYY-MM format.
 *
 * Phase 1: Scaffold with placeholder logic.
 * Phase 5: Full pipeline integration.
 */

import { Hono } from 'hono';
import { runReconciliationPipeline } from '../services/process.service.js';

export const processRouter = new Hono();

/**
 * POST /process/:userId
 * Triggers the GST reconciliation pipeline for the given user.
 *
 * Path params:
 *   - userId: The user ID to process
 *
 * Query params:
 *   - period: Tax period in YYYY-MM format (e.g. "2024-03")
 *
 * TODO (Phase 5): Validate that the user has uploaded documents
 * TODO (Phase 5): Run standardize → match → ITC pipeline
 * TODO (Phase 7): Add AI enrichment step
 */
processRouter.post('/:userId', async (context) => {
  const userId = context.req.param('userId');
  const period = context.req.query('period') ?? '';

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return context.json(
      {
        success: false,
        error: 'INVALID_PERIOD',
        message: 'Period must be in YYYY-MM format (e.g. "2024-03")',
        statusCode: 400,
      },
      400,
    );
  }

  const result = await runReconciliationPipeline(userId, period);
  return context.json({ success: true, data: result }, 200);
});

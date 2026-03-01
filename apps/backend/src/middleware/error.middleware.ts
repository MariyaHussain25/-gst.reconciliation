/**
 * @file apps/backend/src/middleware/error.middleware.ts
 * @description Global error handler middleware for Hono.
 * Catches all unhandled errors and returns a consistent JSON error response.
 *
 * Phase 1: Scaffold — basic error handling implemented.
 */

import type { Context } from 'hono';
import type { ApiErrorResponse } from '@gst/shared';

/**
 * Handles application errors and formats them as consistent JSON responses.
 * Used as the onError handler in the Hono app.
 *
 * @param error - The error that was thrown
 * @param context - The Hono request context
 */
export function errorHandler(error: Error, context: Context): Response {
  console.error('[Error]', error.message, error.stack);

  const statusCode = 500;

  const response: ApiErrorResponse = {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message:
      process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : error.message,
    statusCode,
  };

  return context.json(response, statusCode);
}

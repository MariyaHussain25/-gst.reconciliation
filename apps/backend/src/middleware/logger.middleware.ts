/**
 * @file apps/backend/src/middleware/logger.middleware.ts
 * @description Request logging middleware for Hono.
 * Logs HTTP method, URL, status code, and response time for every request.
 *
 * Phase 1: Scaffold — basic request logging implemented.
 */

import { logger } from 'hono/logger';

/**
 * Hono built-in logger middleware.
 * Outputs: METHOD URL  STATUS  TIME
 *
 * Example output:
 *   --> GET /health
 *   <-- GET /health 200 2ms
 */
export const requestLogger = logger();

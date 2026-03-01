/**
 * @file apps/backend/src/index.ts
 * @description Entry point for the GST Reconciliation API server.
 * Uses Hono.js with the Node.js adapter.
 *
 * Startup sequence:
 * 1. Load and validate environment variables
 * 2. Create Hono app instance
 * 3. Register global middleware (CORS, logger, error handler)
 * 4. Mount all API routes
 * 5. Connect to MongoDB Atlas
 * 6. Start HTTP server
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { env } from './config/env.js';
import { connectToDatabase } from './db/connect.js';
import { requestLogger } from './middleware/logger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';

/** Create the main Hono application */
const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

/** CORS — allow requests from the Next.js frontend */
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

/** Request logger */
app.use('*', requestLogger);

// ---------------------------------------------------------------------------
// Health check route
// ---------------------------------------------------------------------------

/**
 * GET /health
 * Returns server status and environment information.
 * Used by deployment infrastructure to verify the service is running.
 */
app.get('/health', (context) => {
  return context.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.route('/api/v1', apiRouter);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError(errorHandler);

// ---------------------------------------------------------------------------
// Not found handler
// ---------------------------------------------------------------------------

app.notFound((context) => {
  return context.json(
    {
      success: false,
      error: 'NOT_FOUND',
      message: `Route ${context.req.method} ${context.req.path} not found`,
      statusCode: 404,
    },
    404,
  );
});

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
  // Connect to MongoDB Atlas before accepting requests
  await connectToDatabase();

  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      console.log(`[Server] GST Reconciliation API running on http://localhost:${info.port}`);
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
      console.log(`[Server] Health check: http://localhost:${info.port}/health`);
    },
  );
}

startServer().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});

export default app;

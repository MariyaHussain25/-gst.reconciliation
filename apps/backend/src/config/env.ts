/**
 * @file apps/backend/src/config/env.ts
 * @description Environment variable validation using Zod.
 * All required environment variables are validated on startup.
 * The application will throw an error and exit if any required variable is missing.
 *
 * Phase 1: Scaffold — validation logic in place.
 */

import { z } from 'zod';

/** Zod schema that describes and validates all environment variables */
const EnvSchema = z.object({
  /** MongoDB connection string (required) */
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),

  /** OpenAI API key for GPT-4o (required) */
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  /** AWS credentials (optional — used in Phase 3 for S3 file storage) */
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),

  /** HTTP port the server listens on (defaults to 3001) */
  PORT: z
    .string()
    .optional()
    .default('3001')
    .transform((value) => parseInt(value, 10)),

  /** Application environment */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/** Validated, typed environment variables — use this throughout the backend */
export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;

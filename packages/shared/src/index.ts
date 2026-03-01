/**
 * @file packages/shared/src/index.ts
 * @description Main entry point for the shared package.
 * Exports all types and schemas used across backend and frontend.
 */

// Types
export * from './types/invoice.types';
export * from './types/user.types';
export * from './types/api.types';

// Schemas
export * from './schemas/invoice.schema';
export * from './schemas/user.schema';
export * from './schemas/api.schema';

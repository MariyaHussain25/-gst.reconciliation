/**
 * @file packages/shared/src/schemas/user.schema.ts
 * @description Zod runtime validation schemas for user data.
 */

import { z } from 'zod';

export const PurchaseDocumentRefSchema = z.object({
  docId: z.string(),
  fileName: z.string(),
  createdAt: z.date(),
});

export const GstrDocumentRefSchema = z.object({
  docId: z.string(),
  fileName: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  type: z.enum(['2A', '2B']),
  createdAt: z.date(),
});

export const ReconciliationResultRefSchema = z.object({
  docId: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  createdAt: z.date(),
});

export const UserSchema = z.object({
  id: z.string(),
  userId: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email address'),
  purchaseData: z.array(PurchaseDocumentRefSchema),
  gstrData: z.array(GstrDocumentRefSchema),
  results: z.array(ReconciliationResultRefSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email address'),
});

export type UserInput = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

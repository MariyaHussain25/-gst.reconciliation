/**
 * @file apps/backend/src/models/user.model.ts
 * @description Mongoose schema and model for User documents.
 * Stores user profile, uploaded GSTR file references, and reconciliation result references.
 *
 * Phase 1: Schema defined.
 * Phase 2: Updated schema to track gstr2aFiles, gstr2bFiles, and reconciliations.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** Sub-document schema for uploaded GSTR-2A file references */
const Gstr2AFileSchema = new Schema(
  {
    fileId: { type: String, required: true },
    fileName: { type: String, required: true },
    period: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Sub-document schema for uploaded GSTR-2B file references */
const Gstr2BFileSchema = new Schema(
  {
    fileId: { type: String, required: true },
    fileName: { type: String, required: true },
    taxPeriod: { type: String, required: true },
    financialYear: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Sub-document schema for reconciliation result references */
const ReconciliationRefSchema = new Schema(
  {
    reconciliationId: { type: String, required: true },
    period: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** TypeScript interface extending Mongoose Document for type safety */
export interface IUser extends Document {
  userId: string;
  email: string;
  gstr2aFiles: Array<{
    fileId: string;
    fileName: string;
    period: string;
    uploadedAt: Date;
  }>;
  gstr2bFiles: Array<{
    fileId: string;
    fileName: string;
    taxPeriod: string;
    financialYear: string;
    uploadedAt: Date;
  }>;
  reconciliations: Array<{
    reconciliationId: string;
    period: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/** Main User schema */
const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    gstr2aFiles: { type: [Gstr2AFileSchema], default: [] },
    gstr2bFiles: { type: [Gstr2BFileSchema], default: [] },
    reconciliations: { type: [ReconciliationRefSchema], default: [] },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  },
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);

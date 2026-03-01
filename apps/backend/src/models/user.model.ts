/**
 * @file apps/backend/src/models/user.model.ts
 * @description Mongoose schema and model for User documents.
 * Stores user profile, uploaded document references, and reconciliation results.
 *
 * Phase 1: Schema defined.
 * Phase 2: Will add indexes and validation hooks.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** Sub-document schema for uploaded purchase/books documents */
const PurchaseDataSchema = new Schema(
  {
    docId: { type: String, required: true },
    fileName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Sub-document schema for uploaded GSTR-2A/2B documents */
const GstrDataSchema = new Schema(
  {
    docId: { type: String, required: true },
    fileName: { type: String, required: true },
    period: { type: String, required: true }, // YYYY-MM
    type: { type: String, enum: ['2A', '2B'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Sub-document schema for reconciliation result references */
const ResultsSchema = new Schema(
  {
    docId: { type: String, required: true },
    period: { type: String, required: true }, // YYYY-MM
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** TypeScript interface extending Mongoose Document for type safety */
export interface IUser extends Document {
  userId: string;
  email: string;
  purchaseData: Array<{
    docId: string;
    fileName: string;
    createdAt: Date;
  }>;
  gstrData: Array<{
    docId: string;
    fileName: string;
    period: string;
    type: '2A' | '2B';
    createdAt: Date;
  }>;
  results: Array<{
    docId: string;
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
    purchaseData: { type: [PurchaseDataSchema], default: [] },
    gstrData: { type: [GstrDataSchema], default: [] },
    results: { type: [ResultsSchema], default: [] },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  },
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);

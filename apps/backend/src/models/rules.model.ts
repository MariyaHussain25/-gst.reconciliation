/**
 * @file apps/backend/src/models/rules.model.ts
 * @description Mongoose schema and model for GSTR Rules documents.
 * Stores ITC eligibility rules with embeddings for MongoDB Atlas Vector Search.
 *
 * Phase 1: Schema defined.
 * Phase 6: Rules seeded into the database; embeddings generated via OpenAI.
 *          MongoDB Atlas Vector Search index configured on the `embedding` field.
 */

import mongoose, { Schema, Document } from 'mongoose';

/** TypeScript interface extending Mongoose Document for type safety */
export interface IGstRule extends Document {
  ruleId: string;
  category: 'ITC_ELIGIBILITY' | 'BLOCKED_ITC' | 'RCM' | 'EXEMPT' | 'MATCHING';
  title: string;
  description: string;
  keywords: string[];
  /** Relevant GST law section, e.g. "Section 17(5)" — null if not applicable */
  gstSection: string | null;
  /** GSTR-3B table reference, e.g. "4(D)(2)" — null if not applicable */
  gstr3bTable: string | null;
  /** OpenAI text-embedding vector (1536 dimensions for text-embedding-3-small) */
  embedding: number[];
  isActive: boolean;
  createdAt: Date;
}

/** Main GST Rules schema */
const GstRuleSchema = new Schema<IGstRule>(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      enum: ['ITC_ELIGIBILITY', 'BLOCKED_ITC', 'RCM', 'EXEMPT', 'MATCHING'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    keywords: { type: [String], default: [] },
    gstSection: { type: String, default: null },
    gstr3bTable: { type: String, default: null },
    /**
     * Vector embedding of the rule description.
     * Used with MongoDB Atlas Vector Search for RAG retrieval.
     * Phase 6: Will be populated during rule seeding.
     */
    embedding: { type: [Number], default: [] },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const GstRuleModel = mongoose.model<IGstRule>('GstRule', GstRuleSchema);

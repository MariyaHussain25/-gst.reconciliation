/**
 * @file apps/backend/src/scripts/setup-vector-index.ts
 * @description Creates a MongoDB Atlas Vector Search index on the `gstrules` collection.
 * This index enables semantic search over GST rules using OpenAI embeddings.
 *
 * Index configuration:
 *   - Collection:  gstrules
 *   - Field:       embedding
 *   - Dimensions:  1536 (OpenAI text-embedding-3-small output size)
 *   - Similarity:  cosine
 *
 * IMPORTANT: MongoDB Atlas Vector Search index creation requires the Atlas Admin API
 * or the MongoDB Atlas UI. This script uses the MongoDB driver's `createSearchIndex`
 * command which is available in MongoDB Atlas M10 and higher tiers.
 *
 * Usage:
 *   npx tsx src/scripts/setup-vector-index.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db/connect.js';

/** Name of the vector search index to create */
const INDEX_NAME = 'gst_rules_vector_index';
/** Collection that stores GST rules with embeddings */
const COLLECTION_NAME = 'gstrules';
/** Number of dimensions in the OpenAI text-embedding-3-small embedding */
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Creates the MongoDB Atlas Vector Search index on the `gstrules` collection.
 * Prints a clear success or failure message.
 *
 * Note: If the index already exists, MongoDB Atlas will return an error.
 * This is expected behavior — the script does not treat this as a fatal failure.
 */
async function setupVectorIndex(): Promise<void> {
  console.log('[Vector Index] Starting vector search index setup...');

  await connectDB();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('[Vector Index] Database connection not established');
  }

  const collection = db.collection(COLLECTION_NAME);

  console.log(
    `[Vector Index] Creating index "${INDEX_NAME}" on collection "${COLLECTION_NAME}"`,
  );
  console.log(`[Vector Index] Field: embedding | Dimensions: ${EMBEDDING_DIMENSIONS} | Similarity: cosine`);

  try {
    // createSearchIndex is the MongoDB Atlas Vector Search API
    await collection.createSearchIndex({
      name: INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: EMBEDDING_DIMENSIONS,
            similarity: 'cosine',
          },
        ],
      },
    });

    console.log(`[Vector Index] ✓ Successfully created vector search index "${INDEX_NAME}"`);
    console.log(
      '[Vector Index] Note: Index may take a few minutes to become active in MongoDB Atlas.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate')) {
      console.log(`[Vector Index] Index "${INDEX_NAME}" already exists — no action needed.`);
    } else {
      console.error(`[Vector Index] ✗ Failed to create vector search index: ${message}`);
      console.error(
        '[Vector Index] Ensure you are connected to MongoDB Atlas M10+ and have Atlas Admin permissions.',
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  await mongoose.disconnect();
  console.log('[Vector Index] Done.');
}

// Run if called directly
setupVectorIndex().catch((error) => {
  console.error('[Vector Index] Fatal error:', error);
  process.exit(1);
});

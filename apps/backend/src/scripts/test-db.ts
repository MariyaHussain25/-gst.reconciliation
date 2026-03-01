/**
 * @file apps/backend/src/scripts/test-db.ts
 * @description Simple MongoDB connection test script.
 * Connects to the database, inserts a test document, reads it back,
 * then cleans it up. Prints clear success or failure messages.
 *
 * Usage:
 *   npx tsx src/scripts/test-db.ts
 */

import 'dotenv/config';
import mongoose, { Schema } from 'mongoose';
import { connectDB } from '../db/connect.js';

/** Collection name used for the test — uses an unlikely name to avoid collisions */
const TEST_COLLECTION_NAME = '_db_connectivity_test';

/** Unique marker value to identify the test document */
const TEST_MARKER = `test-${Date.now()}`;

/** Minimal schema for the test document */
const TestDocSchema = new Schema(
  {
    marker: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: TEST_COLLECTION_NAME },
);

const TestDocModel = mongoose.model('_DbTest', TestDocSchema);

/**
 * Runs the database connectivity test:
 * 1. Connect to MongoDB using the MONGODB_URI environment variable
 * 2. Insert a test document
 * 3. Read the test document back by its marker
 * 4. Delete the test document
 * 5. Print the result and disconnect
 */
async function testDatabase(): Promise<void> {
  console.log('[DB Test] Starting database connectivity test...');

  try {
    await connectDB();

    // Insert test document
    console.log('[DB Test] Inserting test document...');
    const inserted = await TestDocModel.create({ marker: TEST_MARKER });
    console.log(`[DB Test] Inserted document with _id: ${inserted._id}`);

    // Read back the test document
    console.log('[DB Test] Reading test document back...');
    const found = await TestDocModel.findOne({ marker: TEST_MARKER });
    if (!found) {
      throw new Error('[DB Test] Failed to read back inserted test document');
    }
    console.log(`[DB Test] Successfully read back document with marker: ${found.marker}`);

    // Clean up the test document
    console.log('[DB Test] Cleaning up test document...');
    await TestDocModel.deleteOne({ marker: TEST_MARKER });
    console.log('[DB Test] Test document deleted');

    console.log('\n[DB Test] ✓ All database operations completed successfully');
    console.log('[DB Test] MongoDB connection is working correctly.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[DB Test] ✗ Database test FAILED: ${message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[DB Test] Disconnected from MongoDB');
  }
}

// Run if called directly
testDatabase().catch((error) => {
  console.error('[DB Test] Fatal error:', error);
  process.exit(1);
});

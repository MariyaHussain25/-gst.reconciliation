/**
 * @file apps/backend/src/db/connect.ts
 * @description MongoDB connection using Mongoose.
 * Establishes a connection to MongoDB Atlas and handles errors gracefully.
 *
 * Phase 1: Scaffold — connection logic implemented.
 * Phase 2: Will add connection pooling and retry logic.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * Connects to MongoDB Atlas using the URI from environment variables.
 * Throws an error if the connection fails.
 */
export async function connectToDatabase(): Promise<void> {
  try {
    console.log('[DB] Connecting to MongoDB Atlas...');

    await mongoose.connect(env.MONGODB_URI, {
      // Recommended options for production MongoDB Atlas connections
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('[DB] Successfully connected to MongoDB Atlas');
  } catch (error) {
    console.error('[DB] Failed to connect to MongoDB:', error);
    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Closes the MongoDB connection gracefully.
 * Called on application shutdown.
 */
export async function disconnectFromDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB');
  } catch (error) {
    console.error('[DB] Error during disconnection:', error);
  }
}

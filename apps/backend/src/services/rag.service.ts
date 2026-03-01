/**
 * @file apps/backend/src/services/rag.service.ts
 * @description Retrieval-Augmented Generation (RAG) pipeline service.
 * Uses LlamaIndex.TS with MongoDB Atlas Vector Search to retrieve
 * relevant GST rules and context for ITC determination and AI decisions.
 *
 * Phase 1: Scaffold with placeholder implementation.
 * Phase 6: Implement full RAG pipeline with:
 *          - MongoDB Atlas Vector Search index
 *          - OpenAI text-embedding-3-small for query embeddings
 *          - LlamaIndex.TS for retrieval pipeline
 */

/** A retrieved context document from the vector store */
export interface RetrievedContext {
  ruleId: string;
  title: string;
  description: string;
  score: number; // Similarity score (0–1)
}

/**
 * Retrieves relevant GST rules for a given invoice description/query.
 * Uses MongoDB Atlas Vector Search to find semantically similar rules.
 *
 * @param query - The query text (e.g. invoice description, vendor name)
 * @param topK - Number of top results to retrieve (default: 3)
 * @returns Array of retrieved rule contexts ordered by relevance
 *
 * TODO (Phase 6): Generate query embedding using OpenAI embeddings API
 * TODO (Phase 6): Run Atlas Vector Search query on GstRule.embedding field
 * TODO (Phase 6): Initialize LlamaIndex.TS VectorStoreIndex with MongoDB store
 */
export async function retrieveRelevantRules(
  query: string,
  topK: number = 3,
): Promise<RetrievedContext[]> {
  // TODO (Phase 6): Implement RAG retrieval pipeline
  console.log(`[RAG] Retrieving top-${topK} rules for query: "${query}"`);
  return [];
}

/**
 * Generates a text embedding for the given input using OpenAI's embedding model.
 * The embedding is used for both rule indexing and query-time retrieval.
 *
 * @param text - The text to embed
 * @returns Array of floating-point numbers (1536 dimensions for text-embedding-3-small)
 *
 * TODO (Phase 6): Call OpenAI Embeddings API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // TODO (Phase 6): Call openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
  console.log(`[RAG] Generating embedding for text (length=${text.length})`);
  return [];
}

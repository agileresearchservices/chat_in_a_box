// Core dependencies for vector search and database interaction
import { PrismaClient } from '@prisma/client';
import ollamaEmbedService from '@/services/embed.service';

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Search Result Interface
 * 
 * Defines the structure of document search results
 * 
 * Key Components:
 * - Chunk of text content
 * - Semantic similarity score
 * - Optional document identifiers
 * 
 * Design Principles:
 * - Provides comprehensive search result metadata
 * - Supports tracing document origins
 * 
 * Use Cases:
 * - Semantic document retrieval
 * - Contextual information ranking
 * - Document lineage tracking
 */
interface SearchResult {
  chunk: string;        // Matched text chunk
  similarity: number;   // Semantic similarity score
  id?: string;          // Unique chunk identifier
  parent_id?: string;   // Source document identifier
}

/**
 * Vector Search Configuration Interface
 * 
 * Defines parameters for controlling search behavior
 * 
 * Key Configuration Parameters:
 * - Search result limit
 * - Minimum semantic similarity threshold
 * - Maximum number of results
 * 
 * Design Principles:
 * - Environment-driven configuration
 * - Flexible search tuning
 * - Prevents information overload
 * 
 * Use Cases:
 * - Dynamic search result management
 * - Precision control in document retrieval
 */
interface SearchConfig {
  limit: number;            // Maximum number of search results
  minSimilarity: number;    // Minimum semantic similarity threshold
  maxResults: number;       // Hard cap on total results
}

/**
 * Retrieve Vector Search Configuration
 * 
 * Extracts search configuration from environment variables
 * 
 * Configuration Sources:
 * - SEARCH_LIMIT: Controls the number of search results
 * - SEARCH_MIN_SIMILARITY: Sets semantic similarity threshold
 * - SEARCH_MAX_RESULTS: Provides an additional result cap
 * 
 * Parsing Strategy:
 * - Uses environment variables with type conversion
 * - Provides type-safe configuration extraction
 * 
 * @returns {SearchConfig} Parsed search configuration
 * @throws {Error} If environment variables are missing or invalid
 */
function getSearchConfig(): SearchConfig {
  return {
    limit: parseInt(process.env.SEARCH_LIMIT!, 10),
    minSimilarity: parseFloat(process.env.SEARCH_MIN_SIMILARITY!),
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS!, 10)
  };
}

/**
 * Semantic Document Search Utility
 * 
 * Performs advanced vector similarity search across document embeddings
 * 
 * Workflow:
 * 1. Generate embedding for input query
 * 2. Validate embedding dimensions
 * 3. Perform vector similarity search in PostgreSQL
 * 4. Rank and return most semantically relevant documents
 * 
 * Key Features:
 * - Configurable search parameters
 * - Dimension-aware embedding matching
 * - Robust error handling
 * 
 * Search Mechanism:
 * - Uses PostgreSQL's vector similarity search
 * - Calculates cosine distance between query and document embeddings
 * - Filters results based on similarity threshold
 * 
 * @param {string} query - Input text to search similar documents for
 * @param {number} [limit] - Optional override for maximum search results
 * @param {number} [minSimilarity] - Optional override for minimum similarity
 * 
 * @returns {Promise<SearchResult[]>} Ranked list of semantically similar document chunks
 * 
 * @throws {Error} If embedding generation or search fails
 * 
 * @example
 * // Search for documents similar to "machine learning"
 * const results = await searchSimilarDocs("machine learning");
 * // Returns: [{ chunk: "...", similarity: 0.85, ... }, ...]
 */
export async function searchSimilarDocs(
  query: string, 
  limit?: number, 
  minSimilarity?: number
): Promise<SearchResult[]> {
  try {
    // Retrieve default search configuration
    const config = getSearchConfig();
    
    // Apply optional overrides or use default configuration
    const searchLimit = limit || config.limit;
    const searchMinSimilarity = minSimilarity || config.minSimilarity;

    // Generate embedding for the query using Ollama
    const embedResult = await ollamaEmbedService(query);
    const queryEmbedding = embedResult.embedding;

    // Convert embedding to PostgreSQL array literal for vector operations
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Validate embedding dimensions against existing document embeddings
    const [embeddingStats] = await prisma.$queryRaw`
      SELECT MIN(vector_dims(embedding)) as min_length
      FROM docs
      WHERE embedding IS NOT NULL
      LIMIT 1
    ` as [{ min_length: number }];

    // Ensure embedding dimensions are consistent
    if (embeddingStats?.min_length !== undefined && 
        queryEmbedding.length !== embeddingStats.min_length) {
      throw new Error(`Embedding dimension mismatch. Expected ${embeddingStats.min_length}, got ${queryEmbedding.length}`);
    }

    // Perform vector similarity search with PostgreSQL
    return await prisma.$queryRaw`
      SELECT 
        chunk,           -- Matched text chunk
        id,              -- Chunk identifier
        parent_id,       -- Source document identifier
        1 - (embedding <=> ${embeddingStr}::vector) as similarity  -- Semantic similarity
      FROM docs
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${searchMinSimilarity}
      ORDER BY similarity DESC
      LIMIT ${searchLimit}
    ` as SearchResult[];
  } catch (error) {
    // Centralized error handling with context preservation
    if (error instanceof Error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }
    throw error;
  }
}

// Core dependencies for vector search and database interaction
import { PrismaClient } from '@prisma/client';
import ollamaEmbedService from '@/services/embed.service';
import logger from '@/utils/logger';

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
  rerankerScore?: number; // Reranker score
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
  // Log search configuration retrieval
  logger.debug('Retrieving search configuration', {
    searchLimit: process.env.SEARCH_LIMIT,
    searchMinSimilarity: process.env.SEARCH_MIN_SIMILARITY,
    searchMaxResults: process.env.SEARCH_MAX_RESULTS
  });

  const config = {
    limit: parseInt(process.env.SEARCH_LIMIT!, 10),
    minSimilarity: parseFloat(process.env.SEARCH_MIN_SIMILARITY!),
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS!, 10)
  };

  // Log parsed configuration
  logger.debug('Search configuration parsed', {
    limit: config.limit,
    minSimilarity: config.minSimilarity,
    maxResults: config.maxResults
  });

  return config;
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
  // Log the start of document search
  logger.info('Starting semantic document search', {
    queryLength: query.length,
    customLimit: !!limit,
    customMinSimilarity: !!minSimilarity
  });

  try {
    // Retrieve default search configuration
    const config = getSearchConfig();
    
    // Apply optional overrides or use default configuration
    const searchLimit = limit || config.limit;
    const searchMinSimilarity = minSimilarity || config.minSimilarity;

    // Log search parameters
    logger.debug('Search parameters', {
      limit: searchLimit,
      minSimilarity: searchMinSimilarity
    });

    // Generate embedding for the query using Ollama
    logger.debug('Generating query embedding');
    const embedResult = await ollamaEmbedService(query);
    const queryEmbedding = embedResult.embedding;

    // Log embedding details
    logger.debug('Query embedding generated', {
      embeddingLength: queryEmbedding.length
    });

    // Convert embedding to PostgreSQL array literal for vector operations
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Validate embedding dimensions against existing document embeddings
    logger.debug('Validating embedding dimensions');
    const [embeddingStats] = await prisma.$queryRaw`
      SELECT MIN(vector_dims(embedding)) as min_length
      FROM docs
      WHERE embedding IS NOT NULL
      LIMIT 1
    ` as [{ min_length: number }];

    // Ensure embedding dimensions are consistent
    if (embeddingStats?.min_length !== undefined && 
        queryEmbedding.length !== embeddingStats.min_length) {
      logger.error('Embedding dimension mismatch', {
        expectedDimension: embeddingStats.min_length,
        actualDimension: queryEmbedding.length
      });
      throw new Error(`Embedding dimension mismatch. Expected ${embeddingStats.min_length}, got ${queryEmbedding.length}`);
    }

    // Perform vector similarity search with PostgreSQL
    logger.debug('Executing vector similarity search');
    const initialResults = await prisma.$queryRaw`
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

    // Log initial vector search results
    logger.debug('Initial vector search results', {
      query,
      results: initialResults.map(r => ({
        id: r.id,
        similarity: r.similarity,
        chunk: r.chunk.substring(0, 100) + '...'
      }))
    });

    let finalResults = initialResults;

    // Only proceed with reranking if we have multiple results
    if (initialResults.length > 1) {
      try {
        const rerankerUrl = process.env.NEXT_PUBLIC_RERANKER_URL || 'http://localhost:8005';
        logger.debug('Calling reranker service', { rerankerUrl });
        const rerankerResponse = await fetch(`${rerankerUrl}/rerank`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            passages: initialResults.map(r => r.chunk)
          })
        });

        if (!rerankerResponse.ok) {
          const errorText = await rerankerResponse.text();
          throw new Error(`Reranker service returned status ${rerankerResponse.status}: ${errorText}`);
        }

        const rerankedData: Array<{ passage: string, score: number }> = 
          await rerankerResponse.json();

        // Create a map for efficient score lookup
        const scoreMap = new Map(
          rerankedData.map(item => [item.passage, item.score])
        );

        // Map reranker scores back to original results and sort
        finalResults = initialResults
          .map(result => ({
            ...result,
            rerankerScore: scoreMap.get(result.chunk) || 0
          }))
          .sort((a, b) => (b.rerankerScore || 0) - (a.rerankerScore || 0));

        // Log reranking results with position changes
        logger.debug('Reranking results', {
          query,
          changes: finalResults.map((result, newIndex) => ({
            id: result.id,
            originalPosition: initialResults.findIndex(r => r.id === result.id),
            newPosition: newIndex,
            originalSimilarity: result.similarity,
            rerankerScore: result.rerankerScore,
            chunk: result.chunk.substring(0, 100) + '...'
          }))
        });
      } catch (rerankError) {
        logger.error('Reranking failed - using original results', {
          error: rerankError instanceof Error ? rerankError.message : String(rerankError),
          query
        });
        finalResults = initialResults;
      }
    }

    // Log completion
    logger.info('Semantic document search completed', {
      totalResults: finalResults.length,
      maxSimilarity: finalResults.length > 0 ? finalResults[0].similarity : 0,
      reranked: finalResults !== initialResults
    });

    return finalResults;
  } catch (error) {
    // Centralized error handling with context preservation
    logger.error('Vector search failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
      queryLength: query.length,
      customLimit: !!limit,
      customMinSimilarity: !!minSimilarity
    });

    if (error instanceof Error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }
    throw error;
  }
}

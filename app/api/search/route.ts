import { NextResponse } from 'next/server';
import { searchSimilarDocs } from '@/utils/vector-search';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

/**
 * Semantic Document Search Route
 * 
 * This route handler implements a semantic search functionality using vector embeddings.
 * It allows clients to perform advanced, context-aware document retrieval based on:
 * - Semantic similarity
 * - Natural language query understanding
 * - Intelligent document ranking
 * 
 * Key Features:
 * - Converts text query into vector embeddings
 * - Performs similarity search across document corpus
 * - Returns most relevant documents ranked by semantic relevance
 * 
 * Typical Use Cases:
 * - Knowledge base searching
 * - Context retrieval for AI-powered chat systems
 * - Intelligent document recommendation
 * 
 * Workflow:
 * 1. Receive search query via POST request
 * 2. Validate input query
 * 3. Perform semantic similarity search
 * 4. Return ranked search results
 * 
 * Error Handling:
 * - Returns 400 if no query is provided
 * - Returns 500 if search process fails
 * 
 * @route POST /api/search
 * @param {string} query - The natural language search query
 * @returns {NextResponse} JSON response containing ranked search results
 */
export async function POST(req: Request) {
  try {
    // Parse the request body to extract the search query
    // Uses req.json() to safely parse the JSON payload
    const { query } = await req.json();
    
    // Validate that a query is provided
    // Prevents processing of empty or undefined search inputs
    if (!query || typeof query !== 'string') {
      logger.warn('Search request received with no query');
      return createErrorResponse('Invalid input: query is required', 400);
    }

    logger.info('Performing semantic search for query:', { 
      searchQuery: query 
    });

    // Perform semantic similarity search using vector search utility
    // Delegates the complex search logic to a specialized utility function
    const results = await searchSimilarDocs(query);

    logger.debug('Search results details:', {
      queryLength: query.length,
      resultsCount: results.length
    });

    // Return the search results as a JSON response
    // Wraps results in an object to allow for future extensibility
    return createSuccessResponse({ results });
  } catch (error) {
    // Log the detailed error for server-side debugging
    // Helps in tracking and diagnosing search-related issues
    logger.error('Search error:', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    });

    // Return a generic error response
    return createErrorResponse('Search failed');
  }
}

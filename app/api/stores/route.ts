import { NextResponse } from 'next/server';
import { searchStores, storeQuerySchema } from '@/app/services/store.service';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

/**
 * Store Locator API Route
 * 
 * This route handler provides store location search functionality using OpenSearch.
 * It supports full-text search across store names, addresses and cities,
 * along with various filters for refining results.
 * 
 * Key Features:
 * - Full-text search across store names, addresses and cities
 * - City filtering
 * - State filtering
 * - ZIP code filtering
 * - Pagination support
 * - Relevance-based sorting with store name as secondary sort
 * 
 * Workflow:
 * 1. Receive search query and optional filters via POST request
 * 2. Validate input
 * 3. Execute OpenSearch query
 * 4. Return formatted store information
 * 
 * Error Handling:
 * - Returns 400 if input validation fails
 * - Returns 500 for search execution errors
 * 
 * @route POST /api/stores
 * @param {string} [query] - Optional search query
 * @param {object} [filters] - Optional filters (city, state, zipCode)
 * @param {number} [size=10] - Number of results per page (1-100)
 * @param {number} [page=1] - Page number
 * @returns {NextResponse} JSON response containing store information
 */
export async function POST(req: Request) {
  try {
    // Parse and validate request body
    const body = await req.json();
    logger.debug('Raw request body received:', { body: JSON.stringify(body) });
    
    // Restructure body to match the expected storeQuerySchema
    // Handle both nested filters from agent and flat structure from direct API calls
    const restructuredBody = {
      query: body.query || '',
      filters: body.filters || {
        city: body.city || undefined,
        state: body.state || undefined,
        zipCode: body.zipCode || undefined
      },
      size: body.size || 10,
      page: body.page || 1,
      fallbackStrategy: body.fallbackStrategy
    };
    
    // Add extra debug logging
    logger.debug('Request body and filters received:', { 
      body: JSON.stringify(body), 
      bodyFilters: body.filters, 
      restructuredFilters: restructuredBody.filters 
    });
    
    // Only keep non-empty filters
    if (!restructuredBody.filters.city && !restructuredBody.filters.state && !restructuredBody.filters.zipCode) {
      // If no filters present, provide a properly typed empty filters object
      restructuredBody.filters = {
        city: undefined,
        state: undefined,
        zipCode: undefined
      };
    }
    
    logger.debug('Restructured query:', { restructuredBody: JSON.stringify(restructuredBody) });
    
    const query = storeQuerySchema.parse(restructuredBody);

    logger.info('Processing store search request:', {
      query: query.query,
      filters: query.filters,
      size: query.size,
      page: query.page,
    });

    // Execute search
    const searchResults = await searchStores(query);

    logger.debug('Store search results:', {
      total: searchResults.total,
      returned: searchResults.stores.length,
    });

    // Return successful response
    return createSuccessResponse(searchResults);
  } catch (error: unknown) {
    // Handle validation errors
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createErrorResponse('Invalid input: ' + error.message, 400);
      }

      // Log error details
      logger.error('Store search API error:', {
        errorType: error.constructor.name,
        errorMessage: error.message,
      });

      // Return generic error for other cases
      return createErrorResponse('Failed to search stores');
    }

    // Handle non-Error objects
    logger.error('Store search API error:', {
      errorType: 'Unknown',
      errorMessage: String(error),
    });
    return createErrorResponse('An unexpected error occurred');
  }
}

import { NextResponse } from 'next/server';
import { searchProducts, productQuerySchema } from '@/app/services/product.service';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

/**
 * Product Search API Route
 * 
 * This route handler provides product search functionality using OpenSearch.
 * It supports full-text search across product titles, descriptions, brands, models and categories,
 * along with various filters for refining results.
 * 
 * Key Features:
 * - Full-text search across product titles, descriptions, brands, models and categories
 * - Price range filtering
 * - Color filtering
 * - Storage capacity filtering
 * - Release year filtering
 * - Brand and model filtering
 * - Rating filter (minimum rating)
 * - Technical specs filtering (processor, RAM, etc.)
 * - Feature filtering (water resistance, wireless charging, etc.)
 * - Category and tag filtering
 * - Sorting options (relevance, price, rating)
 * - Pagination support
 * 
 * Workflow:
 * 1. Receive search query and optional filters via POST request
 * 2. Validate input
 * 3. Execute OpenSearch query
 * 4. Return formatted product information
 * 
 * Error Handling:
 * - Returns 400 if input validation fails
 * - Returns 500 for search execution errors
 * 
 * @route POST /api/products
 * @param {string} query - The search query
 * @param {object} [filters] - Optional filters (minPrice, maxPrice, color, storage, releaseYear, 
 *                           brand, model, minRating, processor, ram, waterResistant, 
 *                           wirelessCharging, fastCharging, fiveGCompatible, category)
 * @param {string} [sort='relevance'] - Sort order ('relevance', 'price_asc', 'price_desc', 'rating_desc')
 * @param {number} [size=10] - Number of results per page (1-100)
 * @param {number} [page=1] - Page number
 * @returns {NextResponse} JSON response containing product information
 */
export async function POST(req: Request) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const query = productQuerySchema.parse(body);

    logger.info('Processing product search request:', {
      query: query.query,
      filters: query.filters,
      size: query.size,
      page: query.page,
      sort: query.sort,
    });

    // Execute search
    const searchResults = await searchProducts(query);

    logger.debug('Product search results:', {
      total: searchResults.total,
      returned: searchResults.products.length,
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
      logger.error('Product search API error:', {
        errorType: error.constructor.name,
        errorMessage: error.message,
      });

      // Return generic error for other cases
      return createErrorResponse('Failed to search products');
    }

    // Handle non-Error objects
    logger.error('Product search API error:', {
      errorType: 'Unknown',
      errorMessage: String(error),
    });
    return createErrorResponse('An unexpected error occurred');
  }
}

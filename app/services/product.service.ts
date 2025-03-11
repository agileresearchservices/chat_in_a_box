import { z } from 'zod';
import logger from '@/utils/logger';

/**
 * Schema for product search queries
 */
export const productQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filters: z.object({
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    color: z.string().optional(),
    storage: z.string().optional(),
    releaseYear: z.number().optional(),
  }).optional(),
  size: z.number().min(1).max(100).default(10),
  page: z.number().min(1).default(1),
  fallbackStrategy: z.boolean().optional(), // Add fallbackStrategy to the schema
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

interface OpenSearchSource {
  id: string;
  SKU_ID: string;
  Base_ID: string;
  Title: string;
  Price: number;
  Description: string;
  Stock: string;
  Release_Year: number;
  Storage: string;
  Screen_Size: number;
  Color: string;
}

export interface ProductData {
  id: string;
  skuId: string;
  baseId: string;
  title: string;
  price: number;
  description: string;
  stock: string;
  releaseYear: number;
  storage: string;
  screenSize: number;
  color: string;
}

interface OpenSearchQuery {
  from: number;
  size: number;
  query: {
    bool: {
      must: Array<{
        multi_match?: {
          query: string;
          fields: string[];
        };
        match_all?: {};
      }>;
      filter: Array<{
        range?: {
          Price: {
            gte?: number;
            lte?: number;
          };
        };
        term?: {
          Color?: string;
          Storage?: string;
          Release_Year?: number;
        };
      }>;
    };
  };
  sort: Array<Record<string, 'asc' | 'desc'>>;
}

/**
 * Get product information based on search criteria
 * 
 * @param query Search query and optional filters
 * @returns Array of matching products with total count
 */
export async function searchProducts(query: ProductQuery): Promise<{ products: ProductData[], total: number }> {
  try {
    // Build OpenSearch query
    const searchBody: OpenSearchQuery = buildSearchQuery(query);
    
    // Execute search
    logger.debug(`Constructed OpenSearch query: ${JSON.stringify(searchBody)}`);
    const response = await fetch('http://localhost:9200/catalog/_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      throw new Error(`OpenSearch request failed: ${response.statusText}`);
    }

    const result = (await response.json()) as { hits: { hits: Array<{ _id: string, _source: OpenSearchSource }>, total: { value: number } } };
    
    // Check if we got 0 results and should try fallback strategy
    if (result.hits.total.value === 0 && query.fallbackStrategy && Object.keys(query.filters || {}).length > 0) {
      logger.debug('No results found with initial query, trying fallback strategy');
      
      // Create a simpler query with only essential filters
      const fallbackQuery = { 
        ...query,
        query: '',  // Remove text search
        fallbackStrategy: false // Prevent infinite recursion
      };
      
      // Keep price filters and other important filters
      if (query.filters) {
        fallbackQuery.filters = {
          // Keep price filters
          ...(query.filters?.minPrice ? { minPrice: query.filters.minPrice } : {}),
          ...(query.filters?.maxPrice ? { maxPrice: query.filters.maxPrice } : {}),
          
          // Keep color and storage filters too
          ...(query.filters?.color ? { color: query.filters.color } : {}),
          ...(query.filters?.storage ? { storage: query.filters.storage } : {})
        };
      } else {
        fallbackQuery.filters = {}; // No filters for fallback
      }
      
      logger.debug(`Trying fallback query: ${JSON.stringify(fallbackQuery)}`);
      return await searchProducts(fallbackQuery);
    }
    
    // For generic queries like "Find phones" with no filters and no results
    if (result.hits.total.value === 0 && query.query && (!query.filters || Object.keys(query.filters).length === 0)) {
      logger.debug('No results for generic query, returning default products');
      
      // Create a default query to return some products
      const defaultQuery: any = {
        from: (query.page - 1) * query.size,
        size: query.size,
        query: { match_all: {} },
        sort: [{ Price: 'asc' }]  // Sort by price ascending
      };
      
      logger.debug(`Using default query for generic search: ${JSON.stringify(defaultQuery)}`);
      
      const defaultResponse = await fetch('http://localhost:9200/catalog/_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(defaultQuery),
      });
      
      if (defaultResponse.ok) {
        const defaultResult = (await defaultResponse.json()) as { 
          hits: { 
            hits: Array<{ _id: string, _source: OpenSearchSource }>, 
            total: { value: number } 
          } 
        };
        
        // Map OpenSearch results to ProductData
        const defaultProducts = defaultResult.hits.hits.map((hit) => ({
          id: hit._id,
          skuId: hit._source.SKU_ID,
          baseId: hit._source.Base_ID,
          title: hit._source.Title,
          price: hit._source.Price,
          description: hit._source.Description,
          stock: hit._source.Stock,
          releaseYear: hit._source.Release_Year,
          storage: hit._source.Storage,
          screenSize: hit._source.Screen_Size,
          color: hit._source.Color,
        }));
        
        return {
          products: defaultProducts,
          total: defaultResult.hits.total.value,
        };
      }
    }
    
    // Map OpenSearch results to ProductData
    const products = result.hits.hits.map((hit) => ({
      id: hit._id,
      skuId: hit._source.SKU_ID,
      baseId: hit._source.Base_ID,
      title: hit._source.Title,
      price: hit._source.Price,
      description: hit._source.Description,
      stock: hit._source.Stock,
      releaseYear: hit._source.Release_Year,
      storage: hit._source.Storage,
      screenSize: hit._source.Screen_Size,
      color: hit._source.Color,
    }));

    return {
      products,
      total: result.hits.total.value,
    };
  } catch (error) {
    logger.error('Product search error:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Build OpenSearch query from search parameters
 */
function buildSearchQuery(query: ProductQuery): OpenSearchQuery {
  const { filters = {}, size, page } = query;
  const from = (page - 1) * size;

  // Build must conditions for bool query
  const must = [];
  
  // Only add text search if query is not empty
  if (query.query.trim()) {
    must.push({
      multi_match: {
        query: query.query,
        fields: ['Title^2', 'Description'], // Boost title matches
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Build filter conditions
  const filter = [];

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const range = { Price: {} as { gte?: number; lte?: number } };
    if (filters.minPrice !== undefined) range.Price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) range.Price.lte = filters.maxPrice;
    filter.push({ range });
  }

  if (filters.color) {
    filter.push({ term: { Color: filters.color } });
  }

  if (filters.storage) {
    filter.push({ term: { Storage: filters.storage } });
  }

  if (filters.releaseYear) {
    filter.push({ term: { Release_Year: filters.releaseYear } });
  }

  return {
    from,
    size: size || 10,  // Ensure we have a default size
    query: {
      bool: {
        must,
        filter,
      },
    },
    sort: [
      ...(!query.query.trim() ? [] : [{ _score: 'desc' as const }]),  // Only sort by score if we have a text query
      { Price: 'asc' as const },    // Always sort by price
    ],
  };
}

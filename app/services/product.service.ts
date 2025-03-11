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

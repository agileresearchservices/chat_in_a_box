import { z } from 'zod';
import logger from '@/utils/logger';

/**
 * Schema for store search queries
 */
export const storeQuerySchema = z.object({
  query: z.string().optional().default(''),
  filters: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
  size: z.number().min(1).max(100).default(10),
  page: z.number().min(1).default(1),
  fallbackStrategy: z.boolean().optional(),
});

export type StoreQuery = z.infer<typeof storeQuerySchema>;

interface OpenSearchSource {
  Store_Number: string;
  Store_Name: string;
  Address: string;
  City: string;
  State: string;
  ZIP_Code: string;
  Phone_Number: string;
}

export interface StoreData {
  storeNumber: string;
  storeName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
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
        match?: {
          [field: string]: string;
        };
      }>;
      filter: Array<{
        term?: Record<string, string>;
        match?: {
          [field: string]: {
            query: string;
            operator: string;
          } | string;
        };
        match_phrase?: {
          [field: string]: {
            query: string;
            analyzer: string;
          };
        };
        match_phrase_prefix?: {
          [field: string]: string;
        };
        wildcard?: {
          [field: string]: string;
        };
        prefix?: {
          [field: string]: string;
        };
      }>;
    };
  };
  sort?: Array<Record<string, 'asc' | 'desc'>>;
}

/**
 * Get store locations based on search criteria
 * 
 * @param query Search query and optional filters
 * @returns Array of matching stores with total count
 */
export async function searchStores(query: StoreQuery): Promise<{ stores: StoreData[], total: number }> {
  try {
    // Build OpenSearch query
    const searchBody = buildSearchQuery(query);
    
    // Execute search
    logger.debug(`Constructed OpenSearch query: ${JSON.stringify(searchBody)}`);
    const response = await fetch('http://localhost:9200/stores/_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenSearch error response:', { 
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        query: JSON.stringify(searchBody)
      });
      throw new Error(`OpenSearch request failed: ${response.statusText}. Details: ${errorText}`);
    }

    const result = (await response.json()) as { 
      hits: { 
        hits: Array<{ _id: string, _source: OpenSearchSource }>, 
        total: { value: number } 
      } 
    };
    
    // Check if we got 0 results and should try fallback strategy
    if (result.hits.total.value === 0 && query.fallbackStrategy && Object.keys(query.filters || {}).length > 0) {
      logger.debug('No results found with initial query, trying fallback strategy');
      
      // Create a simpler query with only essential filters
      const fallbackQuery = { 
        ...query,
        query: '',  // Remove text search
        fallbackStrategy: false  // Prevent infinite recursion
      };
      
      // Keep only the state filter for a broader search
      if (query.filters) {
        fallbackQuery.filters = {
          ...(query.filters?.state ? { state: query.filters.state } : {})
        };
      } else {
        fallbackQuery.filters = {}; // No filters for fallback
      }
      
      logger.debug(`Trying fallback query: ${JSON.stringify(fallbackQuery)}`);
      return await searchStores(fallbackQuery);
    }
    
    // For generic queries like "Find stores" with no filters and no results
    if (result.hits.total.value === 0 && (!query.filters || Object.keys(query.filters).length === 0)) {
      logger.debug('No results for generic query, returning default stores');
      
      // Create a default query to return some stores
      const defaultQuery = {
        from: (query.page - 1) * query.size,
        size: query.size,
        query: { match_all: {} }
      };
      
      logger.debug(`Using default query for generic search: ${JSON.stringify(defaultQuery)}`);
      
      const defaultResponse = await fetch('http://localhost:9200/stores/_search', {
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
        
        // Map OpenSearch results to StoreData
        const defaultStores = defaultResult.hits.hits.map((hit) => ({
          storeNumber: hit._source.Store_Number,
          storeName: hit._source.Store_Name,
          address: hit._source.Address,
          city: hit._source.City,
          state: hit._source.State,
          zipCode: hit._source.ZIP_Code,
          phoneNumber: hit._source.Phone_Number,
        }));
        
        return {
          stores: defaultStores,
          total: defaultResult.hits.total.value,
        };
      }
    }
    
    // Map OpenSearch results to StoreData
    const stores = result.hits.hits.map((hit) => ({
      storeNumber: hit._source.Store_Number,
      storeName: hit._source.Store_Name,
      address: hit._source.Address,
      city: hit._source.City,
      state: hit._source.State,
      zipCode: hit._source.ZIP_Code,
      phoneNumber: hit._source.Phone_Number,
    }));

    return {
      stores,
      total: result.hits.total.value,
    };
  } catch (error) {
    logger.error('Store search error:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Build OpenSearch query from search parameters
 */
function buildSearchQuery(query: StoreQuery): OpenSearchQuery {
  const { filters = {}, size, page } = query;
  const from = (page - 1) * size;

  // Build must conditions for bool query
  const must = [];
  
  // Only add text search if query is not empty
  if (query.query?.trim()) {
    must.push({
      multi_match: {
        query: query.query,
        fields: ['Store_Name', 'Address', 'City'], // Search across these fields
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Build filter conditions
  const filter = [];

  // Use a more flexible matching for city names (partial match)
  if (filters.city) {
    filter.push({
      match_phrase_prefix: {
        "City.lowercase": filters.city.toLowerCase()
      }
    });
    logger.debug(`Adding city filter with partial matching: ${filters.city}`);
  }

  if (filters.state) {
    // Using the State.keyword field which has the keyword analyzer applied
    filter.push({
      match: {
        "State.keyword": filters.state
      }
    });
    logger.debug(`Adding state filter: original=${filters.state}`);
    // Add extra debugging for state filters
    logger.debug(`State filter debug: type=${typeof filters.state}, value=${filters.state}, length=${filters.state.length}`);
  }

  // Use exact term matching for ZIP codes
  if (filters.zipCode) {
    filter.push({
      term: {
        ZIP_Code: filters.zipCode
      }
    });
    logger.debug(`Adding ZIP code filter with exact term matching: ${filters.zipCode}`);
  }

  // Create the query with minimal structure
  const searchQuery: OpenSearchQuery = {
    from,
    size,
    query: {
      bool: {
        must,
        filter,
      },
    }
  };
  
  // Only add sort if we need it
  if (query.query?.trim()) {
    searchQuery.sort = [{ "_score": "desc" }];
  }
  
  return searchQuery;
}

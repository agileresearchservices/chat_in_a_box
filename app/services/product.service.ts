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
    // New e-commerce field filters
    brand: z.string().optional(),
    model: z.string().optional(),
    minRating: z.number().min(0).max(5).optional(),
    processor: z.string().optional(),
    ram: z.string().optional(),
    waterResistant: z.boolean().optional(),
    wirelessCharging: z.boolean().optional(),
    fastCharging: z.boolean().optional(),
    fiveGCompatible: z.boolean().optional(),
    category: z.string().optional(),
  }).optional(),
  size: z.number().min(1).max(100).default(10),
  page: z.number().min(1).default(1),
  fallbackStrategy: z.boolean().optional(), // Add fallbackStrategy to the schema
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating_desc']).optional().default('relevance'),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

interface OpenSearchSource {
  id: string;
  SKU_ID: string;
  Base_ID: string;
  Title: string;
  Price: number;
  Description: string;
  Stock: string | number;
  Release_Year: number;
  Storage: string;
  Screen_Size: number;
  Color: string;
  // New e-commerce fields
  Brand: string;
  Model: string;
  Rating: number;
  Review_Count: number;
  Camera_MP: string;
  Battery_mAh: number;
  Weight_g: number;
  Dimensions: string;
  OS: string;
  Processor: string;
  RAM: string;
  Water_Resistant: string;
  Wireless_Charging: string;
  Fast_Charging: string;
  "5G_Compatible": string;
  Category: string;
  Tags: string;
  Discount_Percentage: number;
  Original_Price: number;
  Shipping_Weight: string;
  Availability: string;
  Warranty: string;
}

export interface ProductData {
  id: string;
  skuId: string;
  baseId: string;
  title: string;
  price: number;
  description: string;
  stock: string | number;
  releaseYear: number;
  storage: string;
  screenSize: number;
  color: string;
  // New e-commerce fields
  brand: string;
  model: string;
  rating: number;
  reviewCount: number;
  cameraMP: string;
  batteryMah: number;
  weightG: number;
  dimensions: string;
  os: string;
  processor: string;
  ram: string;
  waterResistant: string;
  wirelessCharging: string;
  fastCharging: string;
  fiveGCompatible: string;
  category: string;
  tags: string;
  discountPercentage: number;
  originalPrice: number;
  shippingWeight: string;
  availability: string;
  warranty: string;
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
          Price?: {
            gte?: number;
            lte?: number;
          };
          Rating?: {
            gte?: number;
          };
        };
        term?: {
          Color?: string;
          Storage?: string;
          Release_Year?: number;
          Brand?: string;
          Model?: string;
          Processor?: string;
          RAM?: string;
          Water_Resistant?: string;
          Wireless_Charging?: string;
          Fast_Charging?: string;
          "5G_Compatible"?: string;
          Category?: string;
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
          ...(query.filters?.storage ? { storage: query.filters.storage } : {}),
          // Keep brand filter if present
          ...(query.filters?.brand ? { brand: query.filters.brand } : {})
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
        
        // Map OpenSearch results to ProductData with all enhanced fields
        const defaultProducts = defaultResult.hits.hits.map((hit) => mapOpenSearchToProductData(hit));
        
        return {
          products: defaultProducts,
          total: defaultResult.hits.total.value,
        };
      }
    }
    
    // Map OpenSearch results to ProductData with all enhanced fields
    const products = result.hits.hits.map((hit) => mapOpenSearchToProductData(hit));

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
 * Map OpenSearch source to ProductData including all enhanced fields
 */
function mapOpenSearchToProductData(hit: { _id: string, _source: OpenSearchSource }): ProductData {
  return {
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
    // New e-commerce fields
    brand: hit._source.Brand || '',
    model: hit._source.Model || '',
    rating: hit._source.Rating || 0,
    reviewCount: hit._source.Review_Count || 0,
    cameraMP: hit._source.Camera_MP || '',
    batteryMah: hit._source.Battery_mAh || 0,
    weightG: hit._source.Weight_g || 0,
    dimensions: hit._source.Dimensions || '',
    os: hit._source.OS || '',
    processor: hit._source.Processor || '',
    ram: hit._source.RAM || '',
    waterResistant: hit._source.Water_Resistant || '',
    wirelessCharging: hit._source.Wireless_Charging || '',
    fastCharging: hit._source.Fast_Charging || '',
    fiveGCompatible: hit._source["5G_Compatible"] || '',
    category: hit._source.Category || '',
    tags: hit._source.Tags || '',
    discountPercentage: hit._source.Discount_Percentage || 0,
    originalPrice: hit._source.Original_Price || hit._source.Price,
    shippingWeight: hit._source.Shipping_Weight || '',
    availability: hit._source.Availability || '',
    warranty: hit._source.Warranty || ''
  };
}

/**
 * Build OpenSearch query from search parameters
 */
function buildSearchQuery(query: ProductQuery): OpenSearchQuery {
  const { filters = {}, size, page, sort } = query;
  const from = (page - 1) * size;

  // Build must conditions for bool query
  const must = [];
  
  // Only add text search if query is not empty
  if (query.query.trim()) {
    must.push({
      multi_match: {
        query: query.query,
        fields: ['Title^3', 'Description', 'Brand^2', 'Model^2', 'Tags^1.5', 'Category'], // Boost fields by relevance
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Build filter conditions
  const filter = [];

  // Price range filter
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const range = { Price: {} as { gte?: number; lte?: number } };
    if (filters.minPrice !== undefined) range.Price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) range.Price.lte = filters.maxPrice;
    filter.push({ range });
  }

  // Rating filter
  if (filters.minRating !== undefined) {
    filter.push({ range: { Rating: { gte: filters.minRating } } });
  }

  // Original filters
  if (filters.color) {
    filter.push({ term: { Color: filters.color } });
  }

  if (filters.storage) {
    filter.push({ term: { Storage: filters.storage } });
  }

  if (filters.releaseYear) {
    filter.push({ term: { Release_Year: filters.releaseYear } });
  }

  // New filters for enhanced e-commerce fields
  if (filters.brand) {
    filter.push({ term: { Brand: filters.brand } });
  }

  if (filters.model) {
    filter.push({ term: { Model: filters.model } });
  }

  if (filters.processor) {
    filter.push({ term: { Processor: filters.processor } });
  }

  if (filters.ram) {
    filter.push({ term: { RAM: filters.ram } });
  }

  if (filters.category) {
    filter.push({ term: { Category: filters.category } });
  }

  // Boolean filters
  if (filters.waterResistant !== undefined) {
    filter.push({ term: { Water_Resistant: filters.waterResistant ? 'Yes' : 'No' } });
  }

  if (filters.wirelessCharging !== undefined) {
    filter.push({ term: { Wireless_Charging: filters.wirelessCharging ? 'Yes' : 'No' } });
  }

  if (filters.fastCharging !== undefined) {
    filter.push({ term: { Fast_Charging: filters.fastCharging ? 'Yes' : 'No' } });
  }

  if (filters.fiveGCompatible !== undefined) {
    filter.push({ term: { "5G_Compatible": filters.fiveGCompatible ? 'Yes' : 'No' } });
  }

  // Determine sort order
  const sortArray = [];
  
  switch (sort) {
    case 'price_asc':
      sortArray.push({ Price: 'asc' as const });
      break;
    case 'price_desc':
      sortArray.push({ Price: 'desc' as const });
      break;
    case 'rating_desc':
      sortArray.push({ Rating: 'desc' as const });
      sortArray.push({ Review_Count: 'desc' as const });
      break;
    case 'relevance':
    default:
      if (query.query.trim()) {
        sortArray.push({ _score: 'desc' as const });
      }
      sortArray.push({ Rating: 'desc' as const });
      break;
  }

  // Always add a secondary sort by ID for consistent pagination
  sortArray.push({ SKU_ID: 'asc' as const });

  return {
    from,
    size: size || 10,  // Ensure we have a default size
    query: {
      bool: {
        must,
        filter,
      },
    },
    sort: sortArray,
  };
}

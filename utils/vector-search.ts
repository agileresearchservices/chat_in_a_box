import { PrismaClient } from '@prisma/client';
import ollamaEmbedService from '@/services/embed.service';

const prisma = new PrismaClient();

interface SearchResult {
  chunk: string;
  similarity: number;
  doc_id?: string;
}

interface SearchConfig {
  limit: number;
  minSimilarity: number;
  maxResults: number;
}

function getSearchConfig(): SearchConfig {
  return {
    limit: parseInt(process.env.SEARCH_LIMIT || '5', 10),
    minSimilarity: parseFloat(process.env.SEARCH_MIN_SIMILARITY || '0.5'),
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '10', 10)
  };
}

export async function searchSimilarDocs(
  query: string, 
  limit?: number, 
  minSimilarity?: number
): Promise<SearchResult[]> {
  try {
    const config = getSearchConfig();
    const searchLimit = limit || config.limit;
    const searchMinSimilarity = minSimilarity || config.minSimilarity;
    const maxResults = config.maxResults;

    // Get embedding for the query using existing service
    const { embedding: queryEmbedding } = await ollamaEmbedService(query);
    
    // Convert the embedding array to a Postgres array literal
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Perform cosine similarity search with proper vector casting
    const results = await prisma.$queryRaw`
      SELECT 
        chunk,
        doc_id,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM docs
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${searchMinSimilarity}
      ORDER BY similarity DESC
      LIMIT ${maxResults};
    `;

    // Deduplicate results based on content
    const seen = new Set();
    const filteredResults = (results as SearchResult[]).filter(result => {
      const isDuplicate = seen.has(result.chunk);
      seen.add(result.chunk);
      return !isDuplicate;
    });

    return filteredResults.slice(0, searchLimit);
  } catch (error) {
    console.error('Error performing similarity search:', error);
    throw error;
  }
}

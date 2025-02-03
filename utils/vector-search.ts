import { PrismaClient } from '@prisma/client';
import ollamaEmbedService from '@/services/embed.service';

const prisma = new PrismaClient();

interface SearchResult {
  chunk: string;
  similarity: number;
  id?: string;
  parent_id?: string;
}

interface SearchConfig {
  limit: number;
  minSimilarity: number;
  maxResults: number;
}

function getSearchConfig(): SearchConfig {
  return {
    limit: parseInt(process.env.SEARCH_LIMIT!, 10),
    minSimilarity: parseFloat(process.env.SEARCH_MIN_SIMILARITY!),
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS!, 10)
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

    // Get embedding for the query
    const embedResult = await ollamaEmbedService(query);
    const queryEmbedding = embedResult.embedding;

    // Convert the embedding array to a Postgres array literal
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Validate embedding dimensions
    const [embeddingStats] = await prisma.$queryRaw`
      SELECT MIN(vector_dims(embedding)) as min_length
      FROM docs
      WHERE embedding IS NOT NULL
      LIMIT 1
    ` as [{ min_length: number }];

    if (embeddingStats?.min_length !== undefined && 
        queryEmbedding.length !== embeddingStats.min_length) {
      throw new Error(`Embedding dimension mismatch. Expected ${embeddingStats.min_length}, got ${queryEmbedding.length}`);
    }

    // Perform the search
    return await prisma.$queryRaw`
      SELECT 
        chunk,
        id,
        parent_id,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM docs
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${searchMinSimilarity}
      ORDER BY similarity DESC
      LIMIT ${searchLimit}
    ` as SearchResult[];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }
    throw error;
  }
}

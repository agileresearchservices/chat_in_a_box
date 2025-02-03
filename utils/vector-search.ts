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

interface EmbeddingStats {
  total_docs: number;
  docs_with_embedding: number;
  min_embedding_length: number;
  max_embedding_length: number;
}

interface EmbeddingSample {
  id: string;
  chunk: string;
  embedding_length: number;
}

function getSearchConfig(): SearchConfig {
  return {
    limit: parseInt(process.env.SEARCH_LIMIT || '50', 10),
    minSimilarity: parseFloat(process.env.SEARCH_MIN_SIMILARITY || '0.5'),
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '50', 10)
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
    const searchMinSimilarity = minSimilarity || 0.01; // Extremely low threshold
    const maxResults = config.maxResults;

    // console.log('🔍 Vector Search Debug Info:');
    // console.log('Query:', query);
    // console.log('Search Limit:', searchLimit);
    // console.log('Minimum Similarity:', searchMinSimilarity);

    // Get embedding for the query using existing service
    const embedResult = await ollamaEmbedService(query);
    const queryEmbedding = embedResult.embedding;

    // console.log('Query Embedding Length:', queryEmbedding.length);
    // console.log('Query Embedding (first 10 values):', queryEmbedding.slice(0, 10));
    // console.log('Query Embedding (last 10 values):', queryEmbedding.slice(-10));

    // Validate embedding
    if (queryEmbedding.length !== 768) {
      throw new Error(`Embedding dimension mismatch. Expected 768, got ${queryEmbedding.length}`);
    }

    // Convert the embedding array to a Postgres array literal
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // // Diagnostic queries
    // const diagnosticQueries = [
    //   // Check embedding column details using vector_dims
    //   prisma.$queryRaw`
    //     SELECT 
    //       COUNT(*) as total_docs,
    //       COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as docs_with_embedding,
    //       MIN(vector_dims(embedding)) as min_embedding_length,
    //       MAX(vector_dims(embedding)) as max_embedding_length
    //     FROM docs
    //   `,
      
    //   // Sample of embeddings to verify using vector_dims
    //   prisma.$queryRaw`
    //     SELECT 
    //       id, 
    //       chunk, 
    //       vector_dims(embedding) as embedding_length
    //     FROM docs
    //     WHERE embedding IS NOT NULL
    //     LIMIT 5
    //   `
    // ];

    // const [embeddingStats, embeddingSample] = await Promise.all(diagnosticQueries) as [EmbeddingStats[], EmbeddingSample[]];

    // console.log('📊 Embedding Statistics:');
    // console.log('Total Documents:', embeddingStats[0].total_docs);
    // console.log('Documents with Embeddings:', embeddingStats[0].docs_with_embedding);
    // console.log('Min Embedding Length:', embeddingStats[0].min_embedding_length);
    // console.log('Max Embedding Length:', embeddingStats[0].max_embedding_length);

    // console.log('🔬 Embedding Sample:');
    // embeddingSample.forEach((sample, index) => {
      // console.log(`Sample ${index + 1}:`);
      // console.log(`  ID: ${sample.id}`);
      // console.log(`  Chunk Preview: ${sample.chunk.slice(0, 100)}...`);
      // console.log(`  Embedding Length: ${sample.embedding_length}`);
    // });

    // Perform the actual search
    const results = await prisma.$queryRaw`
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

    // console.log('🔢 Final Results Count:', results.length);
    
    // Detailed results logging
    // results.forEach((result, index) => {
    //   console.log(`Result ${index + 1}:`);
    //   console.log(`  Similarity: ${result.similarity}`);
    //   console.log(`  Chunk Preview: ${result.chunk.slice(0, 500)}...`);
    // });

    return results;
  } catch (error) {
    console.error('❌ Error in searchSimilarDocs:', error);
    
    // Comprehensive error logging
    if (error instanceof Error) {
      console.error('Error Details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    return [];
  }
}

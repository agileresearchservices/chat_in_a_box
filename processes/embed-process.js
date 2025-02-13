// Import essential dependencies for text chunking and embedding
import pkg from 'chunker';
const { chunk } = pkg;
import ollamaEmbedService from '@/services/embed.service';
import logger from '@/utils/logger.js';

/**
 * Text Chunking Configuration
 * 
 * Defines the optimal size for text segmentation
 * 
 * Key Considerations:
 * - Balances context preservation with embedding efficiency
 * - Prevents overwhelming embedding models with large texts
 * - Enables semantic-aware text processing
 * 
 * Recommended Practices:
 * - Choose a chunk size that captures meaningful semantic units
 * - Adjust based on specific embedding model capabilities
 */
const chunkSize = 1800;

/**
 * Text Chunk Processing and Embedding Generation
 * 
 * Transforms input text into vector embeddings through a multi-step process
 * 
 * Workflow:
 * 1. Segment input text into manageable chunks
 * 2. Generate vector embeddings for each chunk
 * 3. Preserve original text and corresponding embeddings
 * 
 * Key Features:
 * - Supports variable-length text inputs
 * - Generates embeddings for complex, multi-paragraph texts
 * - Handles potential errors during processing
 * 
 * Performance Considerations:
 * - Sequential embedding generation
 * - Suitable for moderate-sized documents
 * 
 * @param {string|Object} text - Input text to be processed and embedded
 * @returns {Promise<Array>} Array of text chunks with their vector embeddings
 * @throws {Error} If embedding generation fails
 */
const processChunk = async (text) => {
  // Log the start of chunk processing
  logger.info('Starting text chunk processing', {
    inputType: typeof text,
    inputLength: text.length || (text.content ? text.content.length : 0),
    chunkSize: chunkSize
  });

  try {
    // Log the text chunking process
    logger.debug('Segmenting input text into chunks', {
      chunkingStarted: true
    });

    // Segment input text into fixed-size chunks
    const chunks = chunk(text, chunkSize);
    
    // Log chunk generation details
    logger.debug('Text segmentation completed', {
      totalChunks: chunks.length
    });

    // Initialize array to store chunk embeddings
    const embeddings = [];
    
    // Generate embeddings for each text chunk
    for (const [index, chunkText] of chunks.entries()) {
      // Log start of embedding generation for current chunk
      logger.debug('Generating embedding for chunk', {
        chunkIndex: index,
        chunkLength: chunkText.length
      });

      // Use Ollama embedding service to convert text to vector
      const embedding = await ollamaEmbedService(chunkText);
      
      // Log successful embedding generation
      logger.debug('Embedding generated successfully', {
        chunkIndex: index,
        embeddingLength: embedding.length
      });

      // Store chunk text and its corresponding embedding
      embeddings.push({ text: chunkText, embedding });
    }
    
    // Log successful completion of embedding process
    logger.info('Text chunk processing completed', {
      totalChunks: chunks.length,
      totalEmbeddings: embeddings.length
    });

    return embeddings;
  } catch (error) {
    // Log detailed error information
    logger.error('Error processing text chunks', { 
      errorMessage: error.message,
      errorStack: error.stack,
      inputType: typeof text,
      inputLength: text.length || (text.content ? text.content.length : 0)
    });

    // Rethrow the error for upstream error handling
    throw error;
  }
};

// Export chunk processing function as default
export default processChunk;

// Import essential dependencies for text chunking and embedding
import pkg from 'chunker';
const { chunk } = pkg;
import ollamaEmbedService from '@/services/embed.service';

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
  try {
    // Segment input text into fixed-size chunks
    const chunks = chunk(text, chunkSize);
    
    // Initialize array to store chunk embeddings
    const embeddings = [];
    
    // Generate embeddings for each text chunk
    for (const chunkText of chunks) {
      // Use Ollama embedding service to convert text to vector
      const embedding = await ollamaEmbedService(chunkText);
      
      // Store chunk text and its corresponding embedding
      embeddings.push({ text: chunkText, embedding });
    }
    
    return embeddings;
  } catch (error) {
    // Log and rethrow any errors during chunk processing
    console.error('Error processing chunk:', error);
    throw error;
  }
};

// Export chunk processing function as default
export default processChunk;

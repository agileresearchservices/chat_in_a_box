// Import essential dependencies for embedding creation
import { PrismaClient } from '@prisma/client';
import processChunk from '../processes/embed-process.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Prisma Database Client Initialization
 * 
 * Creates a singleton instance of PrismaClient for database interactions
 * 
 * Key Features:
 * - Provides type-safe database operations
 * - Manages database connections efficiently
 * - Supports complex query and mutation operations
 * 
 * Use Cases:
 * - Document embedding storage
 * - Vector database management
 * - Efficient data persistence
 */
const prisma = new PrismaClient();

/**
 * Create Embeddings for Text Chunks
 * 
 * Processes input text, generates vector embeddings, and stores them in the database
 * 
 * Workflow:
 * 1. Process text into semantic chunks
 * 2. Generate vector embeddings for each chunk
 * 3. Create database records with unique identifiers
 * 4. Handle potential errors during embedding creation
 * 
 * Key Features:
 * - Supports multiple text sources and types
 * - Generates unique identifiers for each embedding
 * - Bulk creates embeddings with Prisma
 * 
 * @param {Object} text - Text input for embedding generation
 * @param {string} [text.source='unknown'] - Source of the text
 * @param {string} [text.type='text'] - Type of text content
 * @returns {Promise<Array>} Created embedding database records
 * @throws {Error} If embedding generation or database creation fails
 */
export const createEmbed = async (text) => {
  // Log the start of embedding creation
  logger.info('Starting embedding creation', {
    textSource: text.source || 'unknown',
    textType: text.type || 'text',
    textLength: text.content ? text.content.length : 0
  });

  try {
    // Log the start of text chunk processing
    logger.debug('Processing text chunks', {
      chunkProcessingStarted: true
    });

    // Process text into semantic chunks and generate embeddings
    const embeddings = await processChunk(text);
    
    // Log successful chunk processing
    logger.debug('Text chunks processed successfully', {
      embeddingCount: embeddings.length
    });

    // Bulk create embeddings using Prisma with unique identifiers
    const createdEmbeddings = await Promise.all(
      embeddings.map(async (item) => {
        const embeddingRecord = await prisma.docs.create({
          data: {
            // Generate unique document identifier
            doc_id: uuidv4(),
            
            // Use provided source or default to 'unknown'
            source: text.source || 'unknown',
            
            // Use provided type or default to 'text'
            type: text.type || 'text',
            
            // Store original text chunk
            chunk: item.text,
            
            // Store vector embedding
            embedding: item.embedding
          }
        });

        // Log individual embedding creation
        logger.debug('Embedding record created', {
          docId: embeddingRecord.doc_id,
          source: embeddingRecord.source,
          chunkLength: item.text.length
        });

        return embeddingRecord;
      })
    );
    
    // Log successful embedding creation
    logger.info('Embeddings created successfully', {
      totalEmbeddings: createdEmbeddings.length
    });

    return createdEmbeddings;
  } catch (error) {
    // Log detailed error information
    logger.error('Error creating embeddings', { 
      errorMessage: error.message,
      errorStack: error.stack,
      textSource: text.source || 'unknown',
      textType: text.type || 'text'
    });

    // Rethrow the error for upstream error handling
    throw error;
  }
};

// Export Prisma client as default for database operations
export default prisma;

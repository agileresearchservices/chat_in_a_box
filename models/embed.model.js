// Import essential dependencies for embedding creation
import { PrismaClient } from '@prisma/client';
import processChunk from '../processes/embed-process.js';
import { v4 as uuidv4 } from 'uuid';

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
  try {
    // Process text into semantic chunks and generate embeddings
    const embeddings = await processChunk(text);
    
    // Bulk create embeddings using Prisma with unique identifiers
    const createdEmbeddings = await Promise.all(
      embeddings.map(async (item) => {
        return prisma.docs.create({
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
      })
    );
    
    return createdEmbeddings;
  } catch (error) {
    // Log and rethrow any errors during embedding creation
    console.error('Error creating embeddings:', error);
    throw error;
  }
};

// Export Prisma client as default for database operations
export default prisma;

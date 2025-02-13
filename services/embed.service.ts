import logger from '@/utils/logger';

/**
 * Embedding Response Interface
 * 
 * Defines the structure for embedding generation results
 * 
 * Key Features:
 * - Standardizes embedding output format
 * - Ensures type safety for embedding operations
 * 
 * Use Cases:
 * - Vector database storage
 * - Semantic search
 * - Machine learning model inputs
 */
interface EmbeddingResponse {
  embedding: number[];
}

/**
 * Ollama Embedding Request Configuration Interface
 * 
 * Defines the comprehensive request structure for Ollama's embedding API
 * 
 * Key Components:
 * - Model selection
 * - Text prompt
 * - Optional system prompt
 * - Advanced model inference parameters
 * 
 * Design Principles:
 * - Flexible configuration
 * - Environment-driven settings
 * - Support for advanced model tuning
 */
interface OllamaRequest {
  model: string;
  prompt: string;
  system?: string;
  options?: {
    num_ctx?: number;      // Context window size
    temperature?: number;  // Creativity/randomness
    top_k?: number;        // Token selection diversity
    top_p?: number;        // Cumulative probability threshold
    repeat_penalty?: number; // Repetition avoidance
  };
}

/**
 * Ollama API Response Interface
 * 
 * Extends basic embedding response with flexible additional properties
 * 
 * Key Features:
 * - Captures core embedding data
 * - Allows for additional response metadata
 * 
 * Flexibility:
 * - Supports potential future API enhancements
 * - Enables robust error handling
 */
interface OllamaResponse {
  embedding: number[];
  [key: string]: any;
}

/**
 * Ollama Embedding Service
 * 
 * Advanced text embedding generation using Ollama's local AI inference
 * 
 * Workflow:
 * 1. Configure embedding parameters from environment
 * 2. Truncate input text to prevent exceeding model limits
 * 3. Generate vector embeddings via HTTP request
 * 4. Validate and return embedding results
 * 
 * Key Features:
 * - Environment-configurable embedding parameters
 * - Robust error handling
 * - Supports advanced model inference tuning
 * 
 * Performance Considerations:
 * - Configurable context window
 * - Supports text length management
 * 
 * @param {string} text - Input text to generate embeddings for
 * @returns {Promise<EmbeddingResponse>} Generated vector embedding
 * @throws {Error} If embedding generation fails
 */
async function ollamaEmbedService(text: string): Promise<EmbeddingResponse> {
  // Log the start of embedding generation
  logger.info('Starting embedding generation', {
    inputTextLength: text.length
  });

  try {
    // Retrieve configuration from environment variables with sensible defaults
    const OLLAMA_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434';
    const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
    const SYSTEM_PROMPT = process.env.OLLAMA_SYSTEM_PROMPT;
    
    // Log embedding configuration details
    logger.debug('Embedding configuration', {
      host: OLLAMA_HOST,
      model: EMBED_MODEL,
      systemPromptConfigured: !!SYSTEM_PROMPT
    });

    // Configure maximum text length to prevent model overload
    const MAX_PROMPT_LENGTH = parseInt(process.env.MAX_PROMPT_LENGTH || '10000', 10);
    
    // Model inference parameters with environment-driven configuration
    const temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7');
    const num_ctx = parseInt(process.env.OLLAMA_NUM_CTX || '4096', 10);
    const top_k = parseInt(process.env.OLLAMA_TOP_K || '40', 10);
    const top_p = parseFloat(process.env.OLLAMA_TOP_P || '0.9');
    const repeat_penalty = parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.1');
    
    // Log model inference parameters
    logger.debug('Model inference parameters', {
      temperature,
      contextWindow: num_ctx,
      topK: top_k,
      topP: top_p,
      repeatPenalty: repeat_penalty
    });

    // Truncate text to prevent exceeding model's context window
    const truncatedText = text.slice(0, MAX_PROMPT_LENGTH);

    // Log text truncation details
    logger.debug('Text truncation', {
      originalLength: text.length,
      truncatedLength: truncatedText.length
    });

    // Construct Ollama embedding request with comprehensive configuration
    const requestBody: OllamaRequest = {
      model: EMBED_MODEL,
      prompt: truncatedText,
      options: {
        num_ctx,        // Context window size
        temperature,    // Creativity/randomness
        top_k,          // Token selection diversity
        top_p,          // Cumulative probability threshold
        repeat_penalty  // Repetition avoidance
      }
    };

    // Conditionally add system prompt for advanced model guidance
    if (SYSTEM_PROMPT) {
      requestBody.system = SYSTEM_PROMPT;
    }

    // Log embedding request details
    logger.debug('Embedding request prepared', {
      requestModel: requestBody.model,
      requestPromptLength: requestBody.prompt.length
    });

    // Execute embedding generation via Ollama's API
    const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    // Validate API response
    if (!response.ok) {
      logger.error('Embedding request failed', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Embedding request failed with status ${response.status}`);
    }
    
    // Parse embedding response
    const data: OllamaResponse = await response.json();
    
    // Validate embedding structure
    if (!data.embedding || !Array.isArray(data.embedding)) {
      logger.error('Invalid embedding response structure', {
        responseKeys: Object.keys(data)
      });
      throw new Error('Invalid embedding response structure');
    }

    // Log successful embedding generation
    logger.info('Embedding generated successfully', {
      embeddingLength: data.embedding.length
    });

    // Return standardized embedding response
    return { embedding: data.embedding };
  } catch (error) {
    // Centralized error handling with detailed logging
    logger.error('Error generating embedding', { 
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      inputTextLength: text.length
    });
    throw error;
  }
}

// Export embedding service as default for flexible import
export default ollamaEmbedService;

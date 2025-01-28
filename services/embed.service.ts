interface EmbeddingResponse {
  embedding: number[];
}

interface OllamaRequest {
  model: string;
  prompt: string;
  system?: string;
  options?: {
    num_ctx?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    repeat_penalty?: number;
  };
}

interface OllamaResponse {
  embedding: number[];
  [key: string]: any;
}

/**
 * Generates embeddings for text using Ollama's embedding endpoint
 * @param text - The text to generate embeddings for
 * @returns Promise containing the embedding array
 */
async function ollamaEmbedService(text: string): Promise<EmbeddingResponse> {
  try {
    // console.log('Attempting to embed text:', text);
    
    // Base configuration
    const OLLAMA_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434';
    const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
    const SYSTEM_PROMPT = process.env.OLLAMA_SYSTEM_PROMPT;
    const MAX_PROMPT_LENGTH = parseInt(process.env.MAX_PROMPT_LENGTH || '10000', 10);
    
    // Model parameters
    const temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7');
    const num_ctx = parseInt(process.env.OLLAMA_NUM_CTX || '4096', 10);
    const top_k = parseInt(process.env.OLLAMA_TOP_K || '40', 10);
    const top_p = parseFloat(process.env.OLLAMA_TOP_P || '0.9');
    const repeat_penalty = parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.1');
    
    // Truncate text if it exceeds max length
    const truncatedText = text.slice(0, MAX_PROMPT_LENGTH);

    const requestBody: OllamaRequest = {
      model: EMBED_MODEL,
      prompt: truncatedText,
      options: {
        num_ctx,
        temperature,
        top_k,
        top_p,
        repeat_penalty
      }
    };

    // Add system prompt if provided
    if (SYSTEM_PROMPT) {
      requestBody.system = SYSTEM_PROMPT;
    }

    const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with status ${response.status}`);
    }

    // console.log('Embedding response received');
    
    const data: OllamaResponse = await response.json();
    
    // Verify the response structure
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response structure');
    }

    return { embedding: data.embedding };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export default ollamaEmbedService;

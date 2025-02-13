/**
 * Send Message API Service
 * 
 * Handles sending messages to the chat API with comprehensive error handling
 * 
 * Key Features:
 * - Sends user prompts to the chat endpoint
 * - Supports conversation context via message history
 * - Robust error handling and response validation
 * 
 * Workflow:
 * 1. Prepare request payload with prompt and message context
 * 2. Send POST request to chat API
 * 3. Validate response and handle potential errors
 * 
 * Use Cases:
 * - Conversational AI interactions
 * - Contextual chat message processing
 * - Streaming AI-generated responses
 * 
 * @param {string} prompt - The user's input message
 * @param {Array<Message>} [messages=[]] - Previous conversation messages for context
 * @returns {Promise<Response>} The API response stream
 * @throws {Error} If the API call fails or returns an error
 */
import logger from '@/utils/logger';

type Message = {
  role: string;
  content: string;
  id?: string;
}

export const sendMessage = async (prompt: string, messages: Message[] = []): Promise<Response> => {
  logger.debug('Sending message', { prompt, messageCount: messages.length });

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id
      }))
    })
  })

  if (!response.ok) {
    const error = await response.json()
    // Provide more specific error messages for different error types
    if (error.error === 'Invalid input' && error.details) {
      // Handle validation errors specifically
      const validationErrors = error.details.map((e: any) => e.message).join(', ')
      logger.error('Message sending validation failed', { 
        validationErrors, 
        errorType: error.error 
      });
      throw new Error(`Validation failed: ${validationErrors}`)
    }
    logger.error('Failed to send message', { 
      error: error.message || error.details || error.error 
    });
    throw new Error(error.message || error.details || error.error || 'Failed to send message')
  }

  logger.debug('Message sent successfully');
  return response
}

/**
 * Text Embedding API Service
 * 
 * Generates vector embeddings for input text using the embedding API
 * 
 * Key Features:
 * - Converts text into high-dimensional vector representations
 * - Supports semantic search and machine learning tasks
 * - Robust error handling for embedding generation
 * 
 * Workflow:
 * 1. Send text to embedding API endpoint
 * 2. Validate API response
 * 3. Return embedding vector
 * 
 * Use Cases:
 * - Semantic document search
 * - Text similarity comparison
 * - Machine learning model inputs
 * 
 * @param {string} text - The input text to generate embeddings for
 * @returns {Promise<Response>} The API response containing embeddings
 * @throws {Error} If embedding generation fails or no response is received
 */
export const getEmbedding = async (text: string): Promise<Response> => {
  logger.debug('Generating embedding', { textLength: text.length });

  // Send text to embedding API endpoint
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  // Validate API response and handle potential errors
  if (!response.ok) {
    // Extract and throw a meaningful error message
    const error = await response.json()
    logger.error('Failed to get embedding', { 
      details: error.details, 
      error: error.error 
    });
    throw new Error(error.details || error.error || 'Failed to get embedding')
  }

  logger.debug('Embedding generated successfully');
  return response
}

/**
 * Conversation Memory Clearing API Service
 * 
 * Provides a method to clear the entire conversation memory
 * 
 * Key Features:
 * - Sends a DELETE request to memory management endpoint
 * - Resets conversation context and history
 * - Robust error handling for memory clearing
 * 
 * Workflow:
 * 1. Send DELETE request to memory API
 * 2. Validate API response
 * 3. Confirm memory clearing
 * 
 * Use Cases:
 * - Resetting conversation state
 * - Starting a new conversation
 * - Clearing sensitive or temporary context
 * 
 * @returns {Promise<Response>} The API response confirming memory clearing
 * @throws {Error} If memory clearing fails
 */
export const _clearMemory = async (): Promise<Response> => {
  logger.debug('Attempting to clear conversation memory');

  const response = await fetch('/api/chat', {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json()
    logger.error('Failed to clear memory', { 
      details: error.details, 
      error: error.error 
    });
    throw new Error(error.details || error.error || 'Failed to clear memory')
  }

  logger.debug('Conversation memory cleared successfully');
  return response
}

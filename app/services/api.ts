/**
 * Chat Application API Service Module
 * 
 * Core service module providing API interfaces for chat functionality, including:
 * - Message handling with PydanticAI agent integration
 * - Text embedding generation
 * - Conversation memory management
 * 
 * This module serves as the primary interface between the frontend and various
 * backend services, with special handling for agent-based queries through the
 * PydanticAI system.
 * 
 * @module ApiService
 */

import logger from '@/utils/logger';
import { agentService } from './agent';

/**
 * Message structure for chat interactions
 * Supports both regular chat and agent-based responses
 */
type Message = {
  role: 'system' | 'user' | 'assistant' | 'data';  // Message sender type
  content: string;                                  // Message content
  id?: string;                                     // Optional message identifier
}

/**
 * Sends a message to the chat system with integrated agent detection
 * 
 * This function serves as the primary entry point for all chat interactions,
 * incorporating both traditional chat functionality and PydanticAI agent processing.
 * It automatically detects if a query should be handled by a specialized agent
 * (e.g., weather, search) or processed as a regular chat message.
 * 
 * Features:
 * - Automatic agent detection and routing
 * - Conversation context management
 * - Streaming response support
 * - Comprehensive error handling
 * - Request validation
 * 
 * @param prompt - User's input message to process
 * @param messages - Previous conversation messages for context
 * @returns Promise resolving to a streaming Response
 * 
 * @example
 * ```typescript
 * // Regular chat message
 * const response = await sendMessage("Tell me a joke", previousMessages);
 * 
 * // Agent-based query (automatically detected)
 * const weatherResponse = await sendMessage("What's the weather in Boston?");
 * ```
 * 
 * @throws Error if message processing fails or returns an error response
 */
export const sendMessage = async (prompt: string, messages: Message[] = []): Promise<Response> => {
  logger.debug('Sending message', { prompt, messageCount: messages.length });

  try {
    // Check for agent-handleable queries
    const agentType = agentService.detectAgentType(prompt);
    
    if (agentType) {
      // Route to appropriate PydanticAI agent
      logger.info('Detected agent query', { agentType, prompt });
      return await agentService.executeAgent(agentType, prompt);
    }

    // Process as regular chat message if no agent matches
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
    });

    // Handle API response errors
    if (!response.ok) {
      const error = await response.json();
      if (error.error === 'Invalid input' && error.details) {
        // Handle validation errors with specific messages
        const validationErrors = error.details.map((e: any) => e.message).join(', ');
        logger.error('Message sending validation failed', { 
          validationErrors, 
          errorType: error.error 
        });
        throw new Error(`Validation failed: ${validationErrors}`);
      }
      logger.error('Failed to send message', { 
        error: error.message || error.details || error.error 
      });
      throw new Error(error.message || error.details || error.error || 'Failed to send message');
    }

    logger.debug('Message sent successfully');
    return response;
  } catch (error) {
    logger.error('Error in sendMessage', {
      error: error instanceof Error ? error.message : String(error),
      prompt
    });
    throw error;
  }
}

/**
 * Text Embedding Generation Service
 * 
 * Generates vector embeddings for input text, supporting semantic search
 * and similarity comparisons in the chat application. These embeddings
 * are used for enhanced document retrieval and context matching.
 * 
 * Features:
 * - High-dimensional vector generation
 * - Semantic similarity support
 * - Integration with document search
 * - Error handling and validation
 * 
 * @param text - Input text to generate embeddings for
 * @returns Promise resolving to embedding vectors
 * 
 * @example
 * ```typescript
 * const embedding = await getEmbedding("What's the weather like?");
 * ```
 */
export const getEmbedding = async (text: string): Promise<Response> => {
  logger.debug('Generating embedding', { textLength: text.length });

  try {
    // Request embedding generation
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    // Validate response and handle errors
    if (!response.ok) {
      const error = await response.json();
      logger.error('Failed to get embedding', { 
        details: error.details, 
        error: error.error 
      });
      throw new Error(error.details || error.error || 'Failed to get embedding');
    }

    logger.debug('Embedding generated successfully');
    return response;
  } catch (error) {
    logger.error('Error generating embedding', {
      error: error instanceof Error ? error.message : String(error),
      textLength: text.length
    });
    throw error;
  }
}

/**
 * Conversation Memory Management Service
 * 
 * Provides functionality to clear conversation history and context.
 * This is particularly important for managing conversation state
 * and ensuring clean context for both regular chat and agent-based
 * interactions.
 * 
 * Features:
 * - Complete memory reset
 * - Agent context clearing
 * - Conversation state management
 * - Error handling and validation
 * 
 * @returns Promise confirming memory clearing
 * 
 * @example
 * ```typescript
 * await _clearMemory();  // Start fresh conversation
 * ```
 */
export const _clearMemory = async (): Promise<Response> => {
  logger.debug('Attempting to clear conversation memory');

  try {
    // Send memory clear request
    const response = await fetch('/api/chat', {
      method: 'DELETE'
    });

    // Validate response and handle errors
    if (!response.ok) {
      const error = await response.json();
      logger.error('Failed to clear memory', { 
        details: error.details, 
        error: error.error 
      });
      throw new Error(error.details || error.error || 'Failed to clear memory');
    }

    logger.debug('Conversation memory cleared successfully');
    return response;
  } catch (error) {
    logger.error('Error clearing memory', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

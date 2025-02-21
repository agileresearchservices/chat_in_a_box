import { Message } from 'ai'
import logger from '@/utils/logger'

/**
 * Conversation Memory Management Utility
 * 
 * Implements a sophisticated singleton class for managing conversation context
 * 
 * Key Features:
 * - Singleton pattern ensures a single, global memory instance
 * - Configurable memory length to prevent token overflow
 * - Automatic memory trimming
 * - Context retrieval and management
 * 
 * Design Patterns:
 * - Singleton: Ensures a single, globally accessible memory instance
 * - Immutable Sliding Window: Maintains a fixed-length memory buffer
 * 
 * Use Cases:
 * - Maintaining conversation context for AI interactions
 * - Preventing excessive memory consumption
 * - Generating context prompts for language models
 * 
 * Configuration:
 * - Memory length controlled by MAX_MEMORY_LENGTH environment variable
 * - Defaults to 10 messages if not specified
 */
class ConversationMemory {
  // Singleton instance management
  private static instance: ConversationMemory
  
  // Internal message storage with type safety
  private messages: Message[] = []
  
  // Configurable memory length to prevent token overflow
  private maxMemoryLength = parseInt(process.env.MAX_MEMORY_LENGTH || '10', 10)

  // Private constructor prevents direct instantiation
  private constructor() {
    logger.debug('ConversationMemory singleton initialized', { 
      maxMemoryLength: this.maxMemoryLength 
    })
  }

  /**
   * Retrieves the singleton instance of ConversationMemory
   * 
   * Implements lazy initialization and ensures only one instance exists
   * 
   * @returns {ConversationMemory} The singleton ConversationMemory instance
   */
  public static getInstance(): ConversationMemory {
    // Create instance if it doesn't exist
    if (!ConversationMemory.instance) {
      ConversationMemory.instance = new ConversationMemory()
    }
    return ConversationMemory.instance
  }

  /**
   * Adds a new message to the conversation memory
   * 
   * Workflow:
   * 1. Append new message to messages array
   * 2. Trim memory if it exceeds maximum length
   * 
   * @param {Message} message - The message to add to memory
   */
  addMessage(message: Message) {
    // Add the new message to the end of the messages array
    this.messages.push(message)
    
    logger.debug('Message added to conversation memory', { 
      role: message.role, 
      messageLength: message.content.length,
      totalMessages: this.messages.length
    })
    
    // Implement sliding window memory management
    // Keeps only the most recent messages to prevent excessive memory usage
    if (this.messages.length > this.maxMemoryLength) {
      const removedMessages = this.messages.length - this.maxMemoryLength
      this.messages = this.messages.slice(-this.maxMemoryLength)
      
      logger.debug('Conversation memory trimmed', { 
        removedMessageCount: removedMessages,
        remainingMessages: this.messages.length 
      })
    }
  }

  /**
   * Retrieves all messages in the conversation memory
   * 
   * @returns {Message[]} An array of all stored messages
   */
  getMessages(): Message[] {
    logger.debug('Retrieved conversation messages', { 
      messageCount: this.messages.length 
    })
    return this.messages
  }

  /**
   * Clears all messages from the conversation memory and resets the singleton instance
   * 
   * Use Cases:
   * - Resetting conversation context
   * - Starting a new conversation
   * - Clearing sensitive information
   */
  clear() {
    // Log before clearing to capture the number of messages being removed
    const messageCount = this.messages.length
    
    // Reset messages array to empty state
    this.messages = []
    
    // Reset the singleton instance to ensure complete cleanup
    ConversationMemory.instance = new ConversationMemory()
    
    logger.debug('Conversation memory cleared and singleton reset', { 
      removedMessageCount: messageCount 
    })
  }

  /**
   * Generates a context prompt from the current conversation memory
   * 
   * Transforms stored messages into a single string representation
   * Useful for providing context to language models
   * 
   * @returns {string} A formatted context prompt or empty string if no messages
   */
  getContextPrompt(): string {
    // Return empty string if no messages exist
    if (this.messages.length === 0) {
      logger.debug('No messages available for context prompt')
      return ''
    }
    
    // Transform messages into a formatted context string
    // Format: "role: message content" for each message
    const contextPrompt = this.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')
    
    logger.debug('Generated context prompt', { 
      messageCount: this.messages.length,
      promptLength: contextPrompt.length 
    })
    
    return contextPrompt
  }
}

// Export a singleton instance for global use across the application
export const conversationMemory = ConversationMemory.getInstance()

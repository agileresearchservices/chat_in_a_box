import { Message } from 'ai'

class ConversationMemory {
  private static instance: ConversationMemory
  private messages: Message[] = []
  private maxMemoryLength = 10 // Limit to last 10 messages to prevent token overflow

  private constructor() {}

  public static getInstance(): ConversationMemory {
    if (!ConversationMemory.instance) {
      ConversationMemory.instance = new ConversationMemory()
    }
    return ConversationMemory.instance
  }

  addMessage(message: Message) {
    this.messages.push(message)
    
    // Trim memory if it exceeds max length
    if (this.messages.length > this.maxMemoryLength) {
      this.messages = this.messages.slice(-this.maxMemoryLength)
    }
  }

  getMessages(): Message[] {
    return this.messages
  }

  /**
   * Clears all messages from memory.
   */
  clear() {
    this.messages = []
  }

  /**
   * Gets the context prompt from memory.
   * @returns The context prompt string.
   */
  getContextPrompt(): string {
    if (this.messages.length === 0) return ''
    
    return this.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')
  }
}

// Export a singleton instance
export const conversationMemory = ConversationMemory.getInstance()

import { Message } from 'ai'

export class ConversationMemory {
  private memory: Message[] = []
  private maxMemoryLength = 10 // Limit to last 10 messages to prevent token overflow

  addMessage(message: Message) {
    this.memory.push(message)
    
    // Trim memory if it exceeds max length
    if (this.memory.length > this.maxMemoryLength) {
      this.memory = this.memory.slice(-this.maxMemoryLength)
    }
  }

  getMemory(): Message[] {
    return this.memory
  }

  getContextPrompt(): string {
    return this.memory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n')
  }

  clear() {
    this.memory = []
  }
}

// Singleton instance to maintain conversation context
export const conversationMemory = new ConversationMemory()

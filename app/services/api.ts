import { conversationMemory } from '@/app/utils/memory'

/**
 * Sends a message to the chat API.
 * @param prompt - The message to send.
 * @param messages - Previous messages for context.
 * @returns The API response.
 * @throws An error if the API call fails.
 */
export const sendMessage = async (prompt: string, messages: any[] = []): Promise<Response> => {
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
    throw new Error(error.details || error.error || 'Failed to send message')
  }

  return response
}

/**
 * Gets embeddings for the given text.
 * @param text - The text to get embeddings for.
 * @returns The API response.
 * @throws An error if the API call fails or no response body is received.
 */
export const getEmbedding = async (text: string): Promise<Response> => {
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.details || error.error || 'Failed to get embedding')
  }

  return response
}

/**
 * Clears the conversation memory.
 * @returns The API response.
 * @throws An error if the API call fails.
 */
export const clearMemory = async (): Promise<Response> => {
  const response = await fetch('/api/chat/memory', {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.details || error.error || 'Failed to clear memory')
  }

  return response
}

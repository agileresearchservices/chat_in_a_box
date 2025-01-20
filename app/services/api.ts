/**
 * Sends a message to the chat API.
 * @param prompt - The prompt to be sent to the API.
 * @returns The API response.
 * @throws An error if the API call fails or no response body is received.
 */
export async function sendMessage(prompt: string) {
  try {
    // Make a POST request to the chat API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('API error:', error)
      // Throw an error if the API call is not successful
      throw new Error(error.details + ' - Is Ollama Running?' || error.error || 'Failed to send message')
    }

    if (!response.body) {
      // Throw an error if no response body is received
      throw new Error('No response body received')
    }

    return response
  } catch (error) {
    console.error('Error in sendMessage:', error)
    throw error
  }
}

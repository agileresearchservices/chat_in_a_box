export async function sendMessage(prompt: string) {
  try {
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
      throw new Error(error.details + ' - Is Ollama Running?' || error.error || 'Failed to send message')
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    return response
  } catch (error) {
    console.error('Error in sendMessage:', error)
    throw error
  }
}

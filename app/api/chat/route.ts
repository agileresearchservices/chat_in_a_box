import { NextRequest } from 'next/server'
import { z } from 'zod'
import { conversationMemory } from '@/app/utils/memory'

// Configuration Utility: Sets up the API endpoint and model to be used
const createConfig = () => {
  const OLLAMA_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434'
  return {
    ollamaUrl: new URL('/api/chat', OLLAMA_HOST).toString(),
    model: process.env.OLLAMA_MODEL || 'phi4',
  }
}

// Input Validation Schema: Ensures the prompt is a non-empty string and not too long
const ChatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt must not be empty').max(10000, 'Prompt is too long')
})

// Streaming Transformer: Transforms the response stream into a structured format
const createStreamTransformer = () => new TransformStream({
  transform(chunk, controller) {
    try {
      const text = new TextDecoder().decode(chunk)
      const lines = text.split('\n').filter(Boolean)
      
      lines.forEach(line => {
        try {
          const data = JSON.parse(line)
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                done: data.done,
                message: { content: data.message?.content || '' }
              }) + '\n'
            )
          )
        } catch (parseError) {
          console.warn('Chunk parsing error:', parseError)
        }
      })
    } catch (error) {
      console.error('Stream transformation error:', error)
    }
  }
})

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * Handles POST requests to the chat API.
 * Validates the input, sends a request to the Ollama API, and streams the response.
 * @param request - The incoming request object.
 * @returns A Response object with the transformed stream or an error message.
 */
export async function POST(request: NextRequest) {
  try {
    // Create configuration for the API request
    const config = createConfig()
    const body = await request.json()
    
    // Validate input using the defined schema
    const validatedBody = ChatRequestSchema.parse(body)

    // Get conversation context from memory
    const conversationContext = conversationMemory.getContextPrompt()

    // Prepare the request body for the Ollama API
    const requestBody = {
      model: config.model,
      messages: [
        ...(conversationContext ? [{ 
          role: 'system', 
          content: `Previous conversation context:\n${conversationContext}` 
        }] : []),
        { 
          role: 'system', 
          content: process.env.OLLAMA_SYSTEM_PROMPT || 'You are an AI assistant.' 
        },
        { role: 'user', content: validatedBody.prompt }
      ],
      stream: true
    }
    console.log(process.env.OLLAMA_SYSTEM_PROMPT)
    // Send POST request to the Ollama API
    const response = await fetch(config.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ollama error response:', errorText)
      // Return error response if the API call fails
      return new Response(
        JSON.stringify({ 
          error: 'Ollama communication failed',
          details: errorText
        }),
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Create a stream transformer that will capture the full response
    const capturedResponseStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk)
      },
      flush(controller) {
        // This is where we'll add the response to memory
        controller.terminate()
      }
    })

    // Pipe the response through our capture stream and the existing transformer
    const transformedStream = response.body
      ?.pipeThrough(capturedResponseStream)
      .pipeThrough(createStreamTransformer())

    // Add user message to memory immediately
    conversationMemory.addMessage({ 
      role: 'user', 
      content: validatedBody.prompt,
      id: Date.now().toString()
    })

    // Return the transformed response stream
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    
    if (error instanceof z.ZodError) {
      // Return error response for invalid input
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: error.errors 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Return error response for internal server errors
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

import { NextRequest } from 'next/server'
import { z } from 'zod'

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
  prompt: z.string().min(1, 'Prompt must not be empty').max(10000, 'Prompt is too long'),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
    id: z.string()
  })).optional()
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

export const dynamic = 'force-dynamic'

/**
 * Handles POST requests to the chat API.
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

    // Prepare messages array
    const messages = [
      { 
        role: 'system', 
        content: process.env.OLLAMA_SYSTEM_PROMPT || 'You are an AI assistant.' 
      }
    ]

    // Add previous messages if available
    if (validatedBody.messages?.length) {
      // Filter out system messages and transform the rest
      messages.push(...validatedBody.messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      )
    }

    // Add the current user message
    messages.push({ role: 'user', content: validatedBody.prompt })

    // Prepare the request body for the Ollama API
    const requestBody = {
      model: config.model,
      messages,
      stream: true
    }

    // Send POST request to the Ollama API
    const response = await fetch(config.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ollama error response:', errorText)
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

    // Transform and return the response stream
    const transformedStream = response.body?.pipeThrough(createStreamTransformer())

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

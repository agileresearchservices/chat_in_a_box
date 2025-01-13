import { NextRequest } from 'next/server'
import { z } from 'zod'

// Configuration Utility
const createConfig = () => {
  const OLLAMA_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434'
  return {
    ollamaUrl: new URL('/api/generate', OLLAMA_HOST).toString(),
    model: process.env.OLLAMA_MODEL || 'phi4',
  }
}

// Input Validation Schema
const ChatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt must not be empty').max(1000, 'Prompt is too long')
})

// Streaming Transformer
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
                message: { content: data.response || '' }
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

export async function POST(request: NextRequest) {
  try {
    const config = createConfig()
    const body = await request.json()

    // Validate input
    const validatedBody = ChatRequestSchema.parse(body)

    const response = await fetch(config.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: validatedBody.prompt,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
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

    return new Response(response.body?.pipeThrough(createStreamTransformer()), {
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

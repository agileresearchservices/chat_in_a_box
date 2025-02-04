import { NextRequest } from 'next/server'
import { z } from 'zod'
import { searchSimilarDocs } from '@/utils/vector-search'

// Input Validation Schema
const ChatRequestSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt must not be empty')
    .max(parseInt(process.env.MAX_PROMPT_LENGTH!, 10), 'Prompt is too long'),
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
          let content = data.message?.content || ''
          
          // Extract only the first comprehensive answer after thinking process
          if (content.includes('<think>')) {
            const parts = content.split('</think>')
            content = parts[parts.length - 1].trim()
            
            // Remove any subsequent Answer or Final Answer sections
            content = content.split(/\n(?:Answer:|Final Answer)/).shift()?.trim() || content
          }
          
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                done: data.done,
                message: { content }
              }) + '\n'
            )
          )
        } catch (error) {
          // Silently skip invalid chunks
        }
      })
    } catch (error) {
      // Silently handle stream errors
    }
  }
})

export const dynamic = 'force-dynamic'

/**
 * Handles POST requests to the chat API.
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, messages } = await request.json()
    const validation = ChatRequestSchema.safeParse({ prompt, messages })
    
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400 })
    }

    // Get relevant context from similar documents
    const similarDocs = await searchSimilarDocs(prompt, parseInt(process.env.SEARCH_MAX_RESULTS!))
    
    // Format context and prepare messages
    const formattedContext = similarDocs.map((doc, i) => 
      `[Document ${i + 1} (Relevance: ${doc.similarity.toFixed(4)})]\n${doc.chunk}`
    ).join('\n\n')

    const messagesWithContext = [
      {
        role: 'system',
        content: `${process.env.OLLAMA_SYSTEM_PROMPT}\n\nContext for this question:\n${formattedContext}`
      },
      ...(messages || []),
      { role: 'user', content: prompt }
    ]

    // Send request to Ollama
    const response = await fetch(new URL('/api/chat', process.env.NEXT_PUBLIC_API_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL!,
        messages: messagesWithContext,
        stream: true,
        options: {
          temperature: parseFloat(process.env.OLLAMA_TEMPERATURE!),
          num_ctx: parseInt(process.env.OLLAMA_NUM_CTX!),
          top_k: parseInt(process.env.OLLAMA_TOP_K!),
          top_p: parseFloat(process.env.OLLAMA_TOP_P!),
          repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY!)
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const stream = response.body
    if (!stream) {
      throw new Error('No response stream available')
    }

    return new Response(stream.pipeThrough(createStreamTransformer()), {
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error) {
    const errorResponse = error instanceof z.ZodError
      ? { error: 'Invalid input', details: error.errors }
      : { error: 'Chat request failed', message: error instanceof Error ? error.message : 'Unknown error' }

    return new Response(JSON.stringify(errorResponse), { 
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

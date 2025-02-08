import { NextRequest } from 'next/server'
import { z } from 'zod'
import { searchSimilarDocs } from '@/utils/vector-search'

/**
 * Input Validation Schema for Chat Requests
 * 
 * Ensures that:
 * - Prompt is not empty
 * - Prompt length is within the configured maximum
 * - Optional messages follow a specific structure
 */
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

/**
 * Creates a TransformStream to process and transform the AI response stream
 * 
 * Key transformations:
 * - Decodes incoming text chunks
 * - Extracts content from JSON-encoded lines
 * - Handles special processing for AI thinking process
 * - Filters and structures the response
 * 
 * @returns {TransformStream} A stream transformer for AI responses
 */
const createStreamTransformer = () => {
  return new TransformStream({
    transform(chunk, controller) {
      try {
        // Decode the incoming chunk of data
        const text = new TextDecoder().decode(chunk)
        const lines = text.split('\n').filter(Boolean)
        
        lines.forEach(line => {
          try {
            // Parse each line of the response
            const data = JSON.parse(line)
            let content = data.message?.content || ''
            
            // Extract only the first comprehensive answer after thinking process
            if (content.includes('<think>')) {
              const parts = content.split('</think>')
              content = parts[parts.length - 1].trim()
              
              // Remove any subsequent Answer or Final Answer sections
              content = content.split(/\n(?:Answer:|Final Answer)/).shift()?.trim() || content
            }

            // Enqueue a structured response
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  done: data.done,
                  message: { content }
                }) + '\n'
              )
            )
          } catch (error) {
            console.error('Error processing chunk:', error)
          }
        })
      } catch (error) {
        console.error('Stream processing error:', error)
      }
    }
  })
}

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic'

/**
 * Handles POST requests to the chat API
 * 
 * Main workflow:
 * 1. Validate incoming request
 * 2. Search for similar documents based on the prompt
 * 3. Prepare context and messages for the AI model
 * 4. Send request to Ollama AI
 * 5. Stream and transform the AI response
 * 
 * @param {NextRequest} request - The incoming HTTP request
 * @returns {Response} Streaming response with AI-generated content
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const { prompt, messages } = await request.json()
    const validation = ChatRequestSchema.safeParse({ prompt, messages })
    
    // Return validation errors if input is invalid
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400 })
    }

    // Retrieve contextually similar documents for the prompt
    const similarDocs = await searchSimilarDocs(prompt, parseInt(process.env.SEARCH_MAX_RESULTS!))
    
    // Format context from similar documents
    const formattedContext = similarDocs.map((doc, i) => 
      `[Document ${i + 1} (Relevance: ${doc.similarity.toFixed(4)})]\n${doc.chunk}`
    ).join('\n\n')

    // Prepare messages with system context and user prompt
    const messagesWithContext = [
      {
        role: 'system',
        content: `${process.env.OLLAMA_SYSTEM_PROMPT}\n\nContext for this question:\n${formattedContext}`
      },
      ...(messages || []),
      { role: 'user', content: prompt }
    ]

    // Send request to Ollama AI with configured parameters
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

    // Validate Ollama API response
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    // Ensure response stream is available
    const stream = response.body
    if (!stream) {
      throw new Error('No response stream available')
    }

    // Return streaming response with transformed AI output
    return new Response(stream.pipeThrough(createStreamTransformer()), {
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error) {
    // Handle different types of errors with appropriate responses
    const errorResponse = error instanceof z.ZodError
      ? { error: 'Invalid input', details: error.errors }
      : { error: 'Chat request failed', message: error instanceof Error ? error.message : 'Unknown error' }

    return new Response(JSON.stringify(errorResponse), { 
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

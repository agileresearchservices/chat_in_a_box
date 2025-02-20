import { NextRequest } from 'next/server'
import { z } from 'zod'
import { searchSimilarDocs } from '@/utils/vector-search'
import { NextResponse } from 'next/server'
import { conversationMemory } from '@/app/utils/memory'
import logger from '@/utils/logger'

/**
 * API Route Handler for Clearing Conversation Memory
 * 
 * This route provides an endpoint to clear the entire conversation memory.
 * It is typically used to reset the conversation state, removing all 
 * previously stored context and conversation history.
 * 
 * @route DELETE /api/chat
 * @returns {NextResponse} JSON response indicating the success or failure of memory clearing
 */
export async function DELETE() {
  try {
    // Attempt to clear the entire conversation memory
    conversationMemory.clear()

    // Return a success response with a 200 OK status
    return NextResponse.json({ message: 'Memory cleared successfully' })
  } catch (error) {
    // Safely log the error by converting it to a string
    logger.error('Error clearing memory:', { 
      errorMessage: error instanceof Error ? error.message : String(error) 
    })

    // Return an error response with a 500 Internal Server Error status
    return NextResponse.json(
      { error: 'Failed to clear memory' },
      { status: 500 }
    )
  }
}


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
  let buffer = ''
  let lastUpdate = Date.now()
  const UPDATE_INTERVAL = 200 // Slower updates for smoother rendering

  const processLine = (line: string, controller: TransformStreamDefaultController) => {
    try {
      if (!line.trim()) return

      const data = JSON.parse(line)
      let content = data.message?.content || ''
      
      if (content.includes('<think>')) {
        const parts = content.split('</think>')
        content = parts[parts.length - 1].trim()
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
      // Safely log the error by converting it to a string
      logger.error('Error processing line:', { 
        errorMessage: error instanceof Error ? error.message : String(error) 
      })
    }
  }

  return new TransformStream({
    transform(chunk, controller) {
      try {
        // Decode and buffer the incoming chunk
        const text = new TextDecoder().decode(chunk)
        buffer += text

        // Only process buffer at intervals
        const now = Date.now()
        if (now - lastUpdate < UPDATE_INTERVAL) {
          return
        }

        // Find complete JSON objects in buffer
        let startIdx = 0
        let endIdx = buffer.indexOf('\n', startIdx)
        
        while (endIdx !== -1) {
          const line = buffer.slice(startIdx, endIdx)
          processLine(line, controller)
          startIdx = endIdx + 1
          endIdx = buffer.indexOf('\n', startIdx)
        }

        // Keep remaining partial content in buffer
        buffer = buffer.slice(startIdx)
        lastUpdate = now
      } catch (error) {
        // Safely log the error by converting it to a string
        logger.error('Stream processing error:', { 
          errorMessage: error instanceof Error ? error.message : String(error) 
        })
      }
    },
    flush(controller) {
      // Process any remaining content in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n')
        lines.forEach(line => processLine(line, controller))
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
      const errorDetails = validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      logger.warn('Invalid chat request input:', errorDetails)
      return new Response(JSON.stringify({ 
        error: 'Invalid input',
        details: errorDetails
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    logger.info('Processing chat request with prompt:', prompt)

    // Retrieve contextually similar documents for the prompt
    const similarDocs = await searchSimilarDocs(prompt, parseInt(process.env.SEARCH_MAX_RESULTS!))
    logger.debug('Found similar documents:', { 
      documentCount: similarDocs.length 
    })
    
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

    // Log Ollama API call details
    logger.debug('Ollama API Call Details', {
      model: process.env.OLLAMA_MODEL!,
      messages: messagesWithContext,
      contextLength: formattedContext.length,
      streamEnabled: true,
      modelParameters: {
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE!),
        context_size: parseInt(process.env.OLLAMA_NUM_CTX!),
        top_k: parseInt(process.env.OLLAMA_TOP_K!),
        top_p: parseFloat(process.env.OLLAMA_TOP_P!),
        repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY!)
      }
    });

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
      logger.error('Ollama API error:', { 
        statusText: response.statusText,
        status: response.status 
      })
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    // Ensure response stream is available
    const stream = response.body
    if (!stream) {
      logger.error('No response stream available', { 
        details: 'Response body is null or undefined' 
      })
      throw new Error('No response stream available')
    }

    logger.info('Successfully initiated chat response stream')

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

    // Safely log the error with additional context
    logger.error('Chat request failed:', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      ...(error instanceof z.ZodError ? { validationErrors: error.errors } : {})
    })

    return new Response(JSON.stringify(errorResponse), { 
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

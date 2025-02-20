import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import logger from '@/utils/logger'

/**
 * Input Validation Schema for Summarize Requests
 * 
 * Ensures that:
 * - Messages is a non-empty array of strings
 * - Each message has a minimum and maximum length
 */
const SummarizeRequestSchema = z.object({
  messages: z.array(
    z.string()
      .min(1, 'Message must not be empty')
      .max(parseInt(process.env.MAX_PROMPT_LENGTH!, 10), 'Message is too long')
  ).min(1, 'At least one message is required')
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the incoming request body
    const body = await request.json()
    const { messages } = SummarizeRequestSchema.parse(body)

    // Prepare the summarization prompt
    const summarizationPrompt = `Please provide a concise and clear summary of the following messages. Just answer with the summary:

${messages.map((msg, index) => `${index + 1}. ${msg}`).join('\n')}

Summary:`

    // Prepare Ollama API request parameters
    const ollamaRequestBody = {
      model: 'llama3.2:latest',
      prompt: summarizationPrompt,
      stream: false,
      options: {
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.2'),
        num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '4096', 10),
        top_k: parseInt(process.env.OLLAMA_TOP_K || '40', 10),
        top_p: parseFloat(process.env.OLLAMA_TOP_P || '0.8'),
        repeat_penalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.2')
      }
    }

    // Log the Ollama API call details
    logger.debug('Ollama Summarization API Call Details', {
      model: ollamaRequestBody.model,
      messageCount: messages.length,
      ...ollamaRequestBody.options
    })

    // Send request to Ollama AI
    const OLLAMA_HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434'
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ollamaRequestBody)
    })

    // Validate Ollama API response
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${errorText}`)
    }

    // Parse the response
    const data = await response.json()

    // Log the successful response
    logger.debug('Summarization API Response', {
      responseLength: data.response?.length || 0
    })

    // Return the summary
    return NextResponse.json({ 
      summary: data.response.trim() 
    })

  } catch (error) {
    // Handle validation and API errors
    if (error instanceof z.ZodError) {
      logger.error('Validation Error in Summarize API', {
        errorType: 'ValidationError',
        errorDetails: error.errors
      })
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    // Log other errors
    logger.error('Error in Summarize API', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic'

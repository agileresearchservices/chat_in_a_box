/**
 * NLP API Route Handler
 * 
 * Provides a REST endpoint for natural language processing capabilities.
 * Validates input, processes text through NLP service, and returns analysis results.
 * Includes comprehensive logging for debugging and monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nlpService } from '@/app/services/nlp.service';
import { z } from 'zod';

/**
 * Request body schema validation
 * Ensures text is present and within reasonable length limits
 */
const nlpRequestSchema = z.object({
  text: z.string()
    .min(1, 'Text cannot be empty')
    .max(1000, 'Text must be less than 1000 characters'),
});

/**
 * POST handler for NLP analysis
 * 
 * @param request - Next.js request object containing the text to analyze
 * @returns NextResponse with analysis results or error details
 * 
 * @example
 * // Request
 * POST /api/nlp
 * {
 *   "text": "John visited New York last summer."
 * }
 * 
 * // Success Response (200)
 * {
 *   "entities": [...],
 *   "tokens": [...],
 *   "sentiment": { ... }
 * }
 * 
 * // Error Response (400)
 * {
 *   "error": "Invalid request data",
 *   "details": [...]
 * }
 */
export async function POST(request: NextRequest) {
  console.log('[NLP API] Received NLP analysis request');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('[NLP API] Request body:', JSON.stringify(body, null, 2));
    
    const { text } = nlpRequestSchema.parse(body);
    console.log('[NLP API] Validated input text:', text);

    // Process text through NLP service
    const analysis = await nlpService.analyze(text);
    console.log('[NLP API] Analysis completed successfully');
    console.log('[NLP API] Response:', JSON.stringify(analysis, null, 2));

    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    console.error('[NLP API] Error processing request:', error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      const errorResponse = {
        error: 'Invalid request data',
        details: error.errors
      };
      console.error('[NLP API] Validation error:', JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Handle other errors
    console.error('[NLP API] Internal server error:', error);
    return NextResponse.json(
      { error: 'Failed to process text' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import ollamaEmbedService from '../../../services/embed.service.js';

/**
 * Handles POST requests to get embeddings for text.
 * @param request - The incoming request object containing the text to embed.
 * @returns A Response object with the embedding or an error message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await ollamaEmbedService(body.text);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in embedding endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}

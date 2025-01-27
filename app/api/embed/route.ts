import { NextRequest, NextResponse } from 'next/server';
import ollamaEmbedService from '@/services/embed.service';

/**
 * Handles POST requests to get embeddings for text.
 */
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const embeddings = await ollamaEmbedService(text);
    return NextResponse.json(embeddings);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json({ error: 'Failed to generate embeddings' }, { status: 500 });
  }
}

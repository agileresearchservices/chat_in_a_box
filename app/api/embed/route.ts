import { NextRequest, NextResponse } from 'next/server';
import ollamaEmbedService from '@/services/embed.service';

/**
 * Text Embedding Generation Route
 * 
 * This route handler is responsible for generating vector embeddings for input text
 * using the Ollama embedding service. Embeddings are numerical representations of 
 * text that capture semantic meaning, crucial for tasks like:
 * - Semantic search
 * - Document similarity comparison
 * - Machine learning model inputs
 * 
 * Key Workflow:
 * 1. Receive text input via POST request
 * 2. Validate input text
 * 3. Generate embeddings using Ollama embedding service
 * 4. Return embeddings as JSON response
 * 
 * Error Handling:
 * - Returns 400 if no text is provided
 * - Returns 500 if embedding generation fails
 * 
 * @route POST /api/embed
 * @param {string} text - The input text to generate embeddings for
 * @returns {NextResponse} JSON response containing the generated embeddings
 */
export async function POST(req: NextRequest) {
  try {
    // Parse the request body to extract the input text
    // Uses req.json() to safely parse the JSON payload
    const { text } = await req.json();
    
    // Validate that text is provided
    // Prevents processing of empty or undefined text inputs
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' }, 
        { status: 400 }
      );
    }

    // Generate embeddings using the Ollama embedding service
    // Delegates the actual embedding generation to a specialized service
    const embeddings = await ollamaEmbedService(text);

    // Return the generated embeddings as a JSON response
    // Allows client applications to use the embeddings for various ML tasks
    return NextResponse.json(embeddings);
  } catch (error) {
    // Log the detailed error for server-side debugging
    // Helps in tracking and diagnosing embedding generation issues
    console.error('Error generating embeddings:', error);

    // Return a generic error response
    // Prevents exposure of sensitive system details
    return NextResponse.json(
      { error: 'Failed to generate embeddings' }, 
      { status: 500 }
    );
  }
}

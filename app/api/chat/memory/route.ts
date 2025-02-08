import { NextResponse } from 'next/server'
import { conversationMemory } from '@/app/utils/memory'

/**
 * API Route Handler for Clearing Conversation Memory
 * 
 * This route provides an endpoint to clear the entire conversation memory.
 * It is typically used to reset the conversation state, removing all 
 * previously stored context and conversation history.
 * 
 * @route DELETE /api/chat/memory
 * @returns {NextResponse} JSON response indicating the success or failure of memory clearing
 */
export async function DELETE() {
  try {
    // Attempt to clear the entire conversation memory
    conversationMemory.clear()

    // Return a success response with a 200 OK status
    return NextResponse.json({ message: 'Memory cleared successfully' })
  } catch (error) {
    // Log any errors that occur during the memory clearing process
    console.error('Error clearing memory:', error)

    // Return an error response with a 500 Internal Server Error status
    return NextResponse.json(
      { error: 'Failed to clear memory' },
      { status: 500 }
    )
  }
}

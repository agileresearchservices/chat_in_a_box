import { NextResponse } from 'next/server'
import { conversationMemory } from '@/app/utils/memory'

export async function DELETE() {
  try {
    conversationMemory.clear()
    return NextResponse.json({ message: 'Memory cleared successfully' })
  } catch (error) {
    console.error('Error clearing memory:', error)
    return NextResponse.json(
      { error: 'Failed to clear memory' },
      { status: 500 }
    )
  }
}

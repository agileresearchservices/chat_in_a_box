import { NextRequest } from 'next/server'

const OLLAMA_HOST = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:11434').replace(/\/api\/generate\/?$/, '')

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ollama_url = `${OLLAMA_HOST}/api/generate`
    
    const response = await fetch(ollama_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "phi4",
        prompt: body.prompt,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ollama error response:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to communicate with Ollama',
          details: errorText,
          url: ollama_url
        }),
        { 
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    }

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        const lines = text.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            const transformedData = {
              done: data.done,
              message: {
                content: data.response
              }
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify(transformedData) + '\n'))
          } catch (error) {
            console.error('Error processing chunk:', error)
          }
        }
      }
    })

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'

export async function GET() {
  try {
    const swaggerPath = join(process.cwd(), 'swagger.yaml')
    const swaggerFile = readFileSync(swaggerPath, 'utf8')
    const swaggerDoc = yaml.parse(swaggerFile)
    
    return NextResponse.json(swaggerDoc)
  } catch (error) {
    console.error('Error reading swagger documentation:', error)
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    )
  }
}

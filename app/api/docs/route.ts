// Import necessary modules from next/server, fs, path, and yaml
// NextResponse is used for creating HTTP responses
// readFileSync is used to read files synchronously
// join is used to create file paths
// yaml is used to parse YAML files

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'

/**
 * Handles GET requests to retrieve the API documentation.
 * Reads the swagger.yaml file, parses it, and returns it as a JSON response.
 * @returns A JSON response containing the API documentation or an error message.
 */
export async function GET() {
  try {
    // Define the path to the swagger.yaml file
    const swaggerPath = join(process.cwd(), 'swagger.yaml')
    // Read the swagger.yaml file
    const swaggerFile = readFileSync(swaggerPath, 'utf8')
    // Parse the YAML content into a JavaScript object
    const swaggerDoc = yaml.parse(swaggerFile)
    
    // Return the parsed documentation as a JSON response
    return NextResponse.json(swaggerDoc)
  } catch (error) {
    console.error('Error reading swagger documentation:', error)
    // Return an error response if the documentation fails to load
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    )
  }
}

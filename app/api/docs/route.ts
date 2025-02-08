// Import necessary modules for handling API documentation retrieval
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'

/**
 * API Documentation Retrieval Route
 * 
 * This route handler is responsible for serving the Swagger/OpenAPI documentation
 * for the application's API. It reads a pre-defined YAML specification file and
 * serves it as a JSON response, enabling dynamic API documentation discovery.
 * 
 * Key Features:
 * - Reads Swagger/OpenAPI specification from a local YAML file
 * - Parses YAML into a JavaScript object
 * - Provides the documentation via a JSON response
 * - Handles potential file reading and parsing errors
 * 
 * @route GET /api/docs
 * @returns {NextResponse} JSON response containing the parsed API documentation
 */
export async function GET() {
  try {
    // Construct the absolute path to the Swagger/OpenAPI specification file
    // Uses process.cwd() to ensure correct path resolution in different environments
    const swaggerPath = join(process.cwd(), 'swagger.yaml')
    
    // Read the YAML file synchronously with UTF-8 encoding
    // This approach is suitable for small, static documentation files
    const swaggerFile = readFileSync(swaggerPath, 'utf8')
    
    // Parse the YAML content into a JavaScript object
    // Uses the 'yaml' library to handle YAML-to-JSON conversion
    const swaggerDoc = yaml.parse(swaggerFile)
    
    // Return the parsed documentation as a JSON response
    // Allows client-side tools and frontend applications to consume the API spec
    return NextResponse.json(swaggerDoc)
  } catch (error) {
    // Log the detailed error for server-side debugging
    console.error('Error reading swagger documentation:', error)
    
    // Return a generic error response to prevent exposing sensitive system details
    // Provides a 500 Internal Server Error status to indicate a server-side issue
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    )
  }
}

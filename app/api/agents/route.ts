/**
 * PydanticAI Agent Route Handler
 * 
 * This module provides the API route handler for executing PydanticAI agents in the chat application.
 * It manages the execution of different agent types (weather, search, summarize) by spawning Python
 * processes and handling the communication between the TypeScript frontend and Python agent implementations.
 * 
 * Key Features:
 * - Dynamic agent loading and execution
 * - Streaming response support with thinking process
 * - Input validation using Zod
 * - Comprehensive error handling
 * - Python environment management
 * 
 * @module AgentRoute
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import logger from '@/utils/logger';
import path from 'path';

/**
 * Zod schema for validating agent execution requests
 * 
 * Ensures that:
 * - query is a non-empty string
 * - agentType is one of the supported types
 * - parameters object is optional but must be a record if provided
 */
const AgentRequestSchema = z.object({
  query: z.string().min(1, 'Query must not be empty'),
  agentType: z.enum(['weather', 'search', 'summarize']),
  parameters: z.record(z.any()).optional()
});

/**
 * Executes a Python script in a controlled environment for PydanticAI agent processing
 * 
 * This function:
 * 1. Sets up a Python process with the correct environment
 * 2. Loads the appropriate agent module dynamically
 * 3. Captures and processes output/errors from the Python process
 * 4. Ensures proper cleanup of resources
 * 
 * @param agentType - The type of agent to execute (e.g., 'weather', 'search')
 * @param script - The Python script content to execute
 * @returns Promise resolving to the agent's output
 * @throws Error if the Python process fails or returns non-zero exit code
 * 
 * @example
 * ```typescript
 * const result = await executePythonScript('weather', 'print("Hello")')
 * ```
 */
async function executePythonScript(agentType: string, script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Resolve paths for agent module and Python interpreter
    const agentModulePath = path.join(process.cwd(), 'app', 'api', 'agents', `${agentType}_agent.py`);
    const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python');
    
    // Spawn Python process with enhanced environment
    const pythonProcess = spawn(pythonPath, ['-c', script], {
      env: { 
        ...process.env,
        // Configure Python path to include virtual environment and agent module
        PYTHONPATH: `${process.cwd()}/.venv/lib/python3.11/site-packages:${path.dirname(agentModulePath)}`,
        AGENT_MODULE_PATH: agentModulePath,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      }
    });

    let output = '';
    let error = '';

    // Capture stdout stream
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Capture stderr stream
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        logger.error('Python script execution failed', {
          agentType,
          error,
          exitCode: code
        });
        reject(new Error(`Agent execution failed: ${error}`));
      }
    });
  });
}

/**
 * POST Route Handler for PydanticAI Agent Execution
 * 
 * Handles incoming requests to execute various PydanticAI agents. Supports:
 * - Input validation
 * - Dynamic agent loading
 * - Streaming responses
 * - Error handling
 * 
 * Request Format:
 * ```json
 * {
 *   "query": "What's the weather in Boston?",
 *   "agentType": "weather",
 *   "parameters": {
 *     "weatherApiEndpoint": "/api/weather"
 *   }
 * }
 * ```
 * 
 * Response Format (streaming):
 * ```json
 * {
 *   "message": {
 *     "content": "<think>Processing weather query...</think>"
 *   }
 * }
 * {
 *   "message": {
 *     "content": "Weather information..."
 *   }
 * }
 * ```
 * 
 * @param request - The incoming HTTP request
 * @returns Streaming response with agent execution results
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = AgentRequestSchema.safeParse(body);

    if (!validation.success) {
      const errorDetails = validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      logger.warn('Invalid agent request:', errorDetails);
      return NextResponse.json({ 
        error: 'Invalid input',
        details: errorDetails
      }, { status: 400 });
    }

    const { query, agentType, parameters } = validation.data;

    // Transform parameters for Python compatibility
    const pythonParameters = parameters ? JSON.stringify(parameters)
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .replace(/null/g, 'None') : 'None';

    // Construct Python script for dynamic agent execution
    const script = `
import os
import sys
import importlib.util

# Set agent type
agent_type = ${JSON.stringify(agentType)}

# Import the agent-specific module dynamically
agent_module_path = os.environ['AGENT_MODULE_PATH']
spec = importlib.util.spec_from_file_location("agent_module", agent_module_path)
agent_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_module)

# Initialize and execute the appropriate agent
agent_class_name = f"{agent_type[0].upper()}{agent_type[1:]}Agent"
agent_class = getattr(agent_module, agent_class_name)
agent = agent_class()
result = agent.process(${JSON.stringify(query)}, ${pythonParameters})
print(result)
    `.trim();

    logger.info('Executing PydanticAI agent', {
      agentType,
      queryLength: query.length
    });

    const result = await executePythonScript(agentType, script);

    // Set up streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send thinking process indication
        controller.enqueue(encoder.encode(JSON.stringify({
          message: {
            content: `<think>Processing ${agentType} query using PydanticAI...</think>`
          }
        }) + '\n'));

        // Send agent response
        controller.enqueue(encoder.encode(JSON.stringify({
          message: {
            content: result
          }
        }) + '\n'));

        controller.close();
      }
    });

    // Return streaming response with appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    logger.error('Error in agent execution:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      error: 'Failed to execute agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

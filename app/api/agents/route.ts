import { NextRequest } from 'next/server';
import { z } from 'zod';
import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import logger from '@/utils/logger';
import path from 'path';

const AgentRequestSchema = z.object({
  query: z.string().min(1, 'Query must not be empty'),
  agentType: z.enum(['weather', 'search', 'summarize']),
  parameters: z.record(z.any()).optional()
});

/**
 * Executes a Python script using PydanticAI
 * @param agentType The type of agent to execute
 * @param script The Python script content
 * @returns Promise<string> The script output
 */
async function executePythonScript(agentType: string, script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Get the absolute path to the agent-specific module
    const agentModulePath = path.join(process.cwd(), 'app', 'api', 'agents', `${agentType}_agent.py`);
    const pythonPath = path.join(process.cwd(), '.venv', 'bin', 'python');
    
    const pythonProcess = spawn(pythonPath, ['-c', script], {
      env: { 
        ...process.env,
        PYTHONPATH: `${process.cwd()}/.venv/lib/python3.11/site-packages:${path.dirname(agentModulePath)}`,
        AGENT_MODULE_PATH: agentModulePath,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      }
    });

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

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
 * Handles requests to execute PydanticAI agents
 */
export async function POST(request: NextRequest) {
  try {
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

    // Convert parameters to Python-compatible format
    const pythonParameters = parameters ? JSON.stringify(parameters)
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .replace(/null/g, 'None') : 'None';

    // Import the agent-specific module
    const script = `
import os
import sys
import importlib.util

# Set agent type
agent_type = ${JSON.stringify(agentType)}

# Import the agent-specific module
agent_module_path = os.environ['AGENT_MODULE_PATH']
spec = importlib.util.spec_from_file_location("agent_module", agent_module_path)
agent_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_module)

# Initialize and run the agent
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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Add thinking process
        controller.enqueue(encoder.encode(JSON.stringify({
          message: {
            content: `<think>Processing ${agentType} query using PydanticAI...</think>`
          }
        }) + '\n'));

        // Add the agent response
        controller.enqueue(encoder.encode(JSON.stringify({
          message: {
            content: result
          }
        }) + '\n'));

        controller.close();
      }
    });

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

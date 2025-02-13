import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '@/utils/logger';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

export async function GET() {
  try {
    const openApiPath = path.join(process.cwd(), 'openapi.yaml');
    logger.debug('Loading OpenAPI specification from:', { 
      specificationPath: openApiPath 
    });

    const fileContents = fs.readFileSync(openApiPath, 'utf8');
    const openApiSpec = yaml.load(fileContents);
    
    logger.info('Successfully loaded OpenAPI specification');
    return createSuccessResponse(openApiSpec);
  } catch (error) {
    logger.error('Failed to load OpenAPI specification:', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return createErrorResponse('Failed to load API specification');
  }
}

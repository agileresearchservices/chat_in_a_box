import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET() {
  try {
    const openApiPath = path.join(process.cwd(), 'openapi.yaml');
    const fileContents = fs.readFileSync(openApiPath, 'utf8');
    const openApiSpec = yaml.load(fileContents);
    
    return NextResponse.json(openApiSpec);
  } catch (error) {
    console.error('Failed to load OpenAPI specification:', error);
    return NextResponse.json({ error: 'Failed to load API specification' }, { status: 500 });
  }
}

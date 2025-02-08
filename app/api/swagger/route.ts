import { NextResponse } from 'next/server';
import swaggerConfig from '@/swagger.config';

export async function GET() {
  return NextResponse.json(swaggerConfig);
}

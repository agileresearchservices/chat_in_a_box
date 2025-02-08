import { NextResponse } from 'next/server';
import redocConfig from '@/redoc.config';

export async function GET() {
  return NextResponse.json(redocConfig);
}

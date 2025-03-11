import { NextRequest, NextResponse } from 'next/server';
import { nlpService } from '@/app/services/nlp.service';
import { z } from 'zod';

const nlpRequestSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = nlpRequestSchema.parse(body);

    const analysis = await nlpService.analyze(text);

    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('NLP Analysis Error:', error);
    return NextResponse.json(
      { error: 'Failed to process text' },
      { status: 500 }
    );
  }
}

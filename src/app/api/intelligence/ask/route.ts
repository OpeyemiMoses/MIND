import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateMindAnswer } from '@/lib/intelligence/engine';

const AskSchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40,66}$/, 'Connect your Sui wallet first to analyze live onchain data'),
  query: z.string().trim().min(2, 'Question query is required').max(600),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid request payload',
        },
        { status: 400 }
      );
    }

    const result = await generateMindAnswer(parsed.data.query, parsed.data.address);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Intelligence reasoning failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

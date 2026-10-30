import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateMemoryReplay } from '@/lib/intelligence/engine';

const ReplaySchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40,66}$/, 'Connect your Sui wallet first to run Memory Replay'),
  query: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((v) => v || 'How should I manage my current Sui portfolio allocation?'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReplaySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid replay request',
        },
        { status: 400 }
      );
    }

    const replay = await generateMemoryReplay(parsed.data.query, parsed.data.address);
    return NextResponse.json({ success: true, replay });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Memory replay failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

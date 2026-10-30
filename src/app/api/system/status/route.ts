import { NextResponse, connection } from 'next/server';
import { getActiveLlmInfo } from '@/lib/env';
import { probeTatumSuiStatus } from '@/lib/sui/client';
import { probeWalrusStatus } from '@/lib/walrus/client';

export async function GET() {
  await connection();
  try {
    const [tatum, walrus] = await Promise.all([
      probeTatumSuiStatus(),
      probeWalrusStatus(),
    ]);
    const ai = getActiveLlmInfo();

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      tatum,
      walrus,
      ai: {
        ...ai,
        message: ai.configured
          ? `Structured-output AI reasoning active via ${ai.provider} (${ai.model}).`
          : 'Add GROQ_API_KEY to .env.local to upgrade from deterministic synthesis to live Groq LLM reasoning.',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Diagnostics check failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

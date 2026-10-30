import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchWalletData } from '@/lib/sui/client';
import { listGoalsForWallet } from '@/lib/goals/store';
import { verifyTenMeaningfulMemories } from '@/lib/walrus/client';

const RequestSchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40,66}$/, 'Valid Sui Mainnet wallet address required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid Sui wallet address',
        },
        { status: 400 }
      );
    }

    const [wallet, goals] = await Promise.all([
      fetchWalletData(parsed.data.address),
      listGoalsForWallet(parsed.data.address),
    ]);

    const report = await verifyTenMeaningfulMemories(parsed.data.address, wallet, goals);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Walrus Mainnet batch verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { fetchWalletData } from '@/lib/sui/client';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Wallet address query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchWalletData(address);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live Sui wallet data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

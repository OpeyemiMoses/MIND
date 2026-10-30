import { NextRequest, NextResponse } from 'next/server';
import { addGoalForWallet, deleteGoalForWallet, listGoalsForWallet } from '@/lib/goals/store';
import { GoalIconKind } from '@/lib/goals/types';
import { saveWalrusMemory } from '@/lib/walrus/client';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ success: true, goals: [] });
  }

  try {
    const goals = await listGoalsForWallet(address);
    return NextResponse.json({ success: true, goals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load goals';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const targetUsd = Number(body?.targetUsd);
    const currentUsd = Number(body?.currentUsd) || 0;
    const category = typeof body?.category === 'string' ? body.category : 'Savings Reserve';
    const iconKind = (body?.iconKind as GoalIconKind) || 'reserve';
    const deadline = typeof body?.deadline === 'string' ? body.deadline : 'Ongoing';

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Connect a Sui wallet before saving a goal' },
        { status: 400 }
      );
    }

    if (!title || !targetUsd || targetUsd <= 0) {
      return NextResponse.json(
        { success: false, error: 'Goal title and positive target USD amount are required' },
        { status: 400 }
      );
    }

    // Automatically record this goal into the wallet's Walrus Memory timeline
    const memory = await saveWalrusMemory(
      address,
      `Goal: ${title}`,
      `Target of $${targetUsd.toLocaleString()} (${category}), currently at $${currentUsd.toLocaleString()} with target date ${deadline || 'Ongoing'}.`,
      'Goal'
    );

    const goal = await addGoalForWallet({
      walletAddress: address,
      title,
      currentUsd,
      targetUsd,
      category,
      iconKind,
      deadline,
      walrusJobId: memory.jobId,
    });

    return NextResponse.json({ success: true, goal, memory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create goal';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')?.trim() || '';
    const id = request.nextUrl.searchParams.get('id')?.trim() || '';

    if (!address || !id) {
      return NextResponse.json(
        { success: false, error: 'Address and goal id are required' },
        { status: 400 }
      );
    }

    await deleteGoalForWallet(address, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete goal';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


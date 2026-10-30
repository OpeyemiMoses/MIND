import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  deleteWalrusMemory,
  getWalletMemoryNamespace,
  listWalletMemories,
  saveWalrusMemory,
  updateWalrusMemory,
} from '@/lib/walrus/client';

const SuiAddressSchema = z.string().trim().regex(/^0x[0-9a-fA-F]{40,66}$/, 'Invalid Sui wallet address');
const CategorySchema = z.enum(['Goal', 'Preference', 'Pattern', 'Outcome', 'Feedback']);

const CreateMemorySchema = z.object({
  address: SuiAddressSchema,
  title: z.string().trim().min(2).max(100),
  content: z.string().trim().min(3).max(500),
  category: CategorySchema.default('Goal'),
});

const UpdateMemorySchema = z.object({
  address: SuiAddressSchema,
  id: z.string().trim().min(1),
  title: z.string().trim().min(2).max(100),
  content: z.string().trim().min(3).max(500),
  category: CategorySchema.default('Preference'),
});

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim() || '';
  if (!address) {
    return NextResponse.json({ success: true, count: 0, memories: [] });
  }

  const parsedAddr = SuiAddressSchema.safeParse(address);
  if (!parsedAddr.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid Sui wallet address' },
      { status: 400 }
    );
  }

  try {
    const memories = await listWalletMemories(parsedAddr.data);
    return NextResponse.json({
      success: true,
      count: memories.length,
      namespace: getWalletMemoryNamespace(parsedAddr.data),
      memories,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list memories';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateMemorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid memory payload',
        },
        { status: 400 }
      );
    }

    const memory = await saveWalrusMemory(
      parsed.data.address,
      parsed.data.title,
      parsed.data.content,
      parsed.data.category
    );
    return NextResponse.json({ success: true, memory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save memory';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UpdateMemorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid memory update payload',
        },
        { status: 400 }
      );
    }

    const updated = await updateWalrusMemory(parsed.data.address, parsed.data.id, {
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Memory record not found for this wallet' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, memory: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update memory';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')?.trim() || '';
    const id = request.nextUrl.searchParams.get('id')?.trim() || '';

    const parsedAddr = SuiAddressSchema.safeParse(address);
    if (!parsedAddr.success || !id) {
      return NextResponse.json(
        { success: false, error: 'Valid Sui address and memory id are required' },
        { status: 400 }
      );
    }

    await deleteWalrusMemory(parsedAddr.data, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete memory';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

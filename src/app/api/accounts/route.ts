import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { MindAccount, normalizeWalletAddress } from '@/lib/accounts/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'wallet-accounts.json');

async function readAccountsStore(): Promise<Record<string, MindAccount>> {
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAccountsStore(store: Record<string, MindAccount>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * GET /api/accounts?address=0x...
 * Look up the persistent Mind account associated with a Sui wallet address.
 */
export async function GET(request: NextRequest) {
  try {
    const rawAddress = request.nextUrl.searchParams.get('address');
    if (!rawAddress || !rawAddress.trim()) {
      return NextResponse.json(
        { success: false, error: 'Wallet address query parameter is required' },
        { status: 400 }
      );
    }

    const key = normalizeWalletAddress(rawAddress);
    const store = await readAccountsStore();
    const account = store[key] || null;

    return NextResponse.json({ success: true, exists: Boolean(account), account });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch wallet account';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 * Sign in with a Sui wallet:
 * - If no account exists yet for this wallet, creates a brand-new persistent account bound to the wallet.
 * - If an account already exists, recalls that exact account and updates `lastLoginAt`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawAddress = typeof body?.address === 'string' ? body.address.trim() : '';
    const walletProvider =
      typeof body?.walletProvider === 'string' && body.walletProvider.trim()
        ? body.walletProvider.trim()
        : 'Sui Wallet';

    if (!rawAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const key = normalizeWalletAddress(rawAddress);
    const now = new Date().toISOString();
    const store = await readAccountsStore();

    let isNewAccount = false;
    let account = store[key];

    if (!account) {
      isNewAccount = true;
      account = {
        address: key,
        displayAddress: rawAddress,
        username: '',
        walletProvider,
        createdAt: now,
        lastLoginAt: now,
        onboardingCompleted: false,
      };
    } else {
      account = {
        ...account,
        displayAddress: rawAddress,
        walletProvider,
        lastLoginAt: now,
      };
    }

    store[key] = account;
    await writeAccountsStore(store);

    return NextResponse.json({
      success: true,
      isNewAccount,
      needsUsername: !account.onboardingCompleted || !account.username.trim(),
      account,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sign in wallet account';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/accounts
 * Save or update the username associated with a wallet's persistent Mind account.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const rawAddress = typeof body?.address === 'string' ? body.address.trim() : '';
    const rawUsername = typeof body?.username === 'string' ? body.username.trim() : '';

    if (!rawAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 32) {
      return NextResponse.json(
        { success: false, error: 'Username must be between 2 and 32 characters' },
        { status: 400 }
      );
    }

    const key = normalizeWalletAddress(rawAddress);
    const now = new Date().toISOString();
    const store = await readAccountsStore();

    const existing = store[key];
    const updated: MindAccount = existing
      ? {
          ...existing,
          username: rawUsername,
          lastLoginAt: now,
          onboardingCompleted: true,
        }
      : {
          address: key,
          displayAddress: rawAddress,
          username: rawUsername,
          walletProvider: 'Sui Wallet',
          createdAt: now,
          lastLoginAt: now,
          onboardingCompleted: true,
        };

    store[key] = updated;
    await writeAccountsStore(store);

    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update username';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


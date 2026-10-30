import { promises as fs } from 'fs';
import path from 'path';
import { FinancialGoal, GoalIconKind } from './types';
import { normalizeWalletAddress } from '@/lib/accounts/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const GOALS_FILE = path.join(DATA_DIR, 'wallet-goals.json');

async function readGoalsStore(): Promise<Record<string, FinancialGoal[]>> {
  try {
    const raw = await fs.readFile(GOALS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeGoalsStore(store: Record<string, FinancialGoal[]>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(GOALS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export async function listGoalsForWallet(walletAddress: string): Promise<FinancialGoal[]> {
  if (!walletAddress?.trim()) return [];
  const key = normalizeWalletAddress(walletAddress);
  const store = await readGoalsStore();
  return store[key] || [];
}

export async function addGoalForWallet(params: {
  walletAddress: string;
  title: string;
  currentUsd: number;
  targetUsd: number;
  category: string;
  iconKind: GoalIconKind;
  deadline: string;
  walrusJobId?: string;
}): Promise<FinancialGoal> {
  const key = normalizeWalletAddress(params.walletAddress);
  const store = await readGoalsStore();
  const list = store[key] || [];

  const goal: FinancialGoal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    walletAddress: key,
    title: params.title.trim(),
    currentUsd: Math.max(0, Number(params.currentUsd) || 0),
    targetUsd: Math.max(1, Number(params.targetUsd) || 1),
    category: params.category.trim() || 'Financial Target',
    iconKind: params.iconKind || 'reserve',
    deadline: params.deadline.trim() || 'Ongoing',
    createdAt: new Date().toISOString(),
    walrusJobId: params.walrusJobId,
  };

  store[key] = [goal, ...list];
  await writeGoalsStore(store);
  return goal;
}

export async function deleteGoalForWallet(walletAddress: string, goalId: string): Promise<boolean> {
  const key = normalizeWalletAddress(walletAddress);
  const store = await readGoalsStore();
  const list = store[key] || [];
  const filtered = list.filter((g) => g.id !== goalId);
  store[key] = filtered;
  await writeGoalsStore(store);
  return filtered.length !== list.length;
}


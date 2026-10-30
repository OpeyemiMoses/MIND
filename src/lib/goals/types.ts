export type GoalIconKind = 'reserve' | 'yield' | 'growth' | 'purchase';

export interface FinancialGoal {
  id: string;
  walletAddress: string;
  title: string;
  currentUsd: number;
  targetUsd: number;
  category: string;
  iconKind: GoalIconKind;
  deadline: string;
  createdAt: string;
  walrusJobId?: string;
}


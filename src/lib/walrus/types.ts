export type MemoryCategory =
  | 'Goal'
  | 'Preference'
  | 'Pattern'
  | 'Outcome'
  | 'Feedback';

export interface WalrusMemory {
  id: string;
  walletAddress: string;
  category: MemoryCategory;
  title: string;
  content: string;
  timestamp: string;
  source: 'walrus-mainnet' | 'mind-ledger';
  verifiedOnMainnet: boolean;
  writeStatus: 'confirmed' | 'uploading' | 'local-only' | 'failed';
  jobId?: string;
  blobId?: string;
  namespace?: string;
  distance?: number;
  usedCount?: number;
  lastUsedContext?: string;
  relevantTopics: string[];
}

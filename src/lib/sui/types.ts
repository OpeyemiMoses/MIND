export interface CoinBalance {
  coinType: string;
  coinSymbol: string;
  coinName: string;
  iconUrl?: string;
  decimals: number;
  totalBalanceRaw: string;
  formattedBalance: number;
  usdPrice: number;
  usdValue: number;
  percentageOfPortfolio: number;
}

export interface SuiTransaction {
  digest: string;
  checkpoint?: string;
  type: 'Received' | 'Sent' | 'Swap' | 'Contract';
  asset: string;
  amount: string;
  usdAmount: number;
  fromOrTo: string;
  timestamp: number;
  timeAgo: string;
  status: 'success' | 'failure';
  semanticNote?: string;
  explorerUrl: string;
}

export interface WalletOverview {
  address: string;
  rpcSource: 'tatum-mainnet' | 'sui-mainnet-rpc';
  rpcMethodSummary: string;
  fetchedAt: string;
  totalBalanceUsd: number;
  suiChange24hPercent: number;
  monthlySpendUsd: number;
  stableReserveUsd: number;
  balances: CoinBalance[];
  transactions: SuiTransaction[];
  sparkline: { date: string; value: number }[];
}

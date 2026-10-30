'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  Wallet,
  Coins,
  Activity,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WalletOverview } from '@/lib/sui/types';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';

interface WalletIntelligenceViewProps {
  walletData: WalletOverview | null;
  loading: boolean;
}

const DONUT_COLORS = ['#E7C45D', '#2CCD9A', '#60A5FA', '#C084FC', '#F59E0B', '#9CA3AF'];
const CIRCUMFERENCE = 2 * Math.PI * 38;
const TX_PAGE_SIZE = 8;

function formatUsd(val: number): string {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const WalletIntelligenceView: React.FC<WalletIntelligenceViewProps> = ({
  walletData,
  loading,
}) => {
  const { connected, openWalletModal } = useWallet();
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'transactions' | 'patterns'>(
    'overview'
  );
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('30D');
  const [txPage, setTxPage] = useState<number>(1);
  const [anchorNowMs, setAnchorNowMs] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnchorNowMs(Date.now());
      setTxPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [walletData]);

  const balances = useMemo(
    () => (connected && walletData ? walletData.balances : []),
    [connected, walletData]
  );
  const transactions = useMemo(
    () => (connected && walletData ? walletData.transactions : []),
    [connected, walletData]
  );
  const totalUsd = connected && walletData ? walletData.totalBalanceUsd : 0;

  const totalTxPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
  const safePage = Math.min(txPage, totalTxPages);
  const pagedTransactions = useMemo(() => {
    const start = (safePage - 1) * TX_PAGE_SIZE;
    return transactions.slice(start, start + TX_PAGE_SIZE);
  }, [transactions, safePage]);

  // Dynamic SVG Donut segments from real token USD weights
  const donutSegments = useMemo(() => {
    if (balances.length === 0 || totalUsd <= 0) return [];
    let cumulative = 0;
    return balances.slice(0, 6).map((b, idx) => {
      const weight = Math.max(0, b.usdValue / totalUsd);
      const arc = weight * CIRCUMFERENCE;
      const offset = -cumulative;
      cumulative += arc;
      return {
        symbol: b.coinSymbol,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
        dashArray: `${arc.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`,
        dashOffset: offset.toFixed(2),
      };
    });
  }, [balances, totalUsd]);

  // Dynamic transaction bucket histogram from real Mainnet block timestamps
  const activityBuckets = useMemo(() => {
    const now = anchorNowMs || transactions[0]?.timestamp || 1767225600000;
    const dayMs = 24 * 60 * 60 * 1000;
    const config =
      timeRange === '7D'
        ? { buckets: 7, spanDays: 1 }
        : timeRange === '30D'
        ? { buckets: 6, spanDays: 5 }
        : { buckets: 6, spanDays: 15 };

    const items: { label: string; count: number; usdVolume: number }[] = [];

    for (let i = config.buckets - 1; i >= 0; i--) {
      const endMs = now - i * config.spanDays * dayMs;
      const startMs = endMs - config.spanDays * dayMs;
      const d = new Date(endMs);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const matching = transactions.filter(
        (tx) => tx.timestamp > startMs && tx.timestamp <= endMs
      );
      const usdVolume = matching.reduce((acc, tx) => acc + (tx.usdAmount || 0), 0);

      items.push({
        label,
        count: matching.length,
        usdVolume,
      });
    }

    const maxCount = Math.max(1, ...items.map((b) => b.count));
    return items.map((b) => ({
      ...b,
      heightPct: b.count === 0 ? 6 : Math.max(16, Math.round((b.count / maxCount) * 100)),
    }));
  }, [transactions, timeRange, anchorNowMs]);

  // Real behavioral metrics for the Patterns tab
  const patternSummary = useMemo(() => {
    const receivedCount = transactions.filter((t) => t.type === 'Received').length;
    const sentCount = transactions.filter((t) => t.type === 'Sent').length;
    const swapOrContractCount = transactions.filter(
      (t) => t.type === 'Swap' || t.type === 'Contract'
    ).length;
    const stableRatio =
      totalUsd > 0 && walletData
        ? Math.round((walletData.stableReserveUsd / totalUsd) * 100)
        : 0;
    const topAsset = balances[0] || null;

    return {
      receivedCount,
      sentCount,
      swapOrContractCount,
      stableRatio,
      topAsset,
    };
  }, [transactions, balances, totalUsd, walletData]);

  return (
    <div className="space-y-6">
      {!connected && (
        <div className="gold-glass-plaque rounded-2xl p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute -top-px left-8 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
          <div className="flex items-center gap-3.5">
            <MindLogo size="sm" framed showWordmark={false} />
            <div>
              <p className="text-sm font-semibold text-white font-sora">
                Connect your Sui wallet to inspect live Mainnet holdings &amp; blocks
              </p>
              <p className="text-xs text-[#8E939E] mt-0.5">
                All token weights, USD valuations, and transaction histograms are computed directly from Tatum Sui Mainnet gRPC &amp; Sui Mainnet GraphQL.
              </p>
            </div>
          </div>
          <button
            onClick={openWalletModal}
            className="btn-gold-primary px-5 py-2.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center gap-2"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallet</span>
          </button>
        </div>
      )}

      {/* Luxury Subnav Pill Bar + Live RPC Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['overview', 'tokens', 'transactions', 'patterns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#28200E] to-[#15120A] text-[#F8E296] border border-[#D4AF37]/50 shadow-[inset_0_1px_0_rgba(255,240,185,0.2)]'
                  : 'text-[#8E939E] hover:text-white bg-white/[0.02] border border-white/[0.06]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {connected && walletData && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-3 py-1 rounded-full bg-[#13110B] border border-[#D4AF37]/30 text-[#F8E296]">
              Source: {walletData.rpcSource === 'tatum-mainnet' ? 'Tatum Sui Mainnet gRPC' : 'Sui Mainnet'}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#11100D] border border-white/[0.07] text-[#8E939E]">
              Synced {new Date(walletData.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Top Row: Token Distribution + Transaction Activity */}
      {(activeTab === 'overview' || activeTab === 'tokens' || activeTab === 'transactions') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token Distribution Donut Card */}
          <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/55 to-transparent" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-white font-sora">Token Distribution</h3>
                <p className="text-[11px] text-[#8E939E] mt-0.5">
                  Live CoinMetadata &amp; CoinGecko USD pricing
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#15120B] border border-[#D4AF37]/30 text-[#E7C45D] font-mono">
                {balances.length} Asset{balances.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Dynamic SVG Donut */}
              <div className="relative w-36 h-36 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#1B1915" strokeWidth="14" />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.symbol}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="14"
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-[#8E939E]">Total</span>
                  <span className="text-xs sm:text-sm font-bold text-white font-sora truncate max-w-[92px]">
                    {connected && loading ? '...' : formatUsd(totalUsd)}
                  </span>
                </div>
              </div>

              {/* Token Legend Breakdown */}
              <div className="flex-1 w-full">
                {balances.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#0C0B09]/80 border border-white/[0.06] text-xs text-[#8E939E]">
                    {connected
                      ? 'No non-zero token balances found on Sui Mainnet for this wallet.'
                      : 'Connect a Sui wallet to calculate real portfolio weights.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {balances.slice(0, 5).map((b, idx) => (
                      <div
                        key={b.coinType}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04] last:border-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                          />
                          <span className="font-semibold text-white truncate">{b.coinSymbol}</span>
                          <span className="text-[11px] text-[#6B7280] font-mono truncate">
                            {b.formattedBalance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono shrink-0">
                          <span className="text-[#9CA3AF]">{formatUsd(b.usdValue)}</span>
                          <span className="font-semibold text-[#F8E296] w-11 text-right">
                            {b.percentageOfPortfolio}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Activity Histogram Card */}
          <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/55 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white font-sora">Transaction Activity</h3>
                <p className="text-[11px] text-[#8E939E] mt-0.5">
                  Verified block frequency over selected window
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#0E0D0A] p-1 rounded-xl border border-white/[0.08]">
                {(['7D', '30D', '90D'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      timeRange === range
                        ? 'bg-gradient-to-b from-[#F8E296] to-[#D4AF37] text-[#0A0A0A]'
                        : 'text-[#8E939E] hover:text-white'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-44 w-full flex items-end justify-between gap-2.5 px-1 pt-8">
              {activityBuckets.map((bar, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all relative ${
                        bar.count > 0
                          ? 'bg-gradient-to-t from-[#8F6F1A] via-[#D4AF37] to-[#F8E296] shadow-[0_0_18px_rgba(212,175,55,0.22)]'
                          : 'bg-white/[0.06] group-hover:bg-white/[0.12]'
                      }`}
                      style={{ height: `${bar.heightPct}%` }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#12100B] text-[10px] text-[#F8E296] px-2 py-0.5 rounded-md border border-[#D4AF37]/40 pointer-events-none whitespace-nowrap font-mono z-20">
                        {bar.count} tx{bar.count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#8E939E] font-mono whitespace-nowrap">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Token Holdings Table (Shown on Overview & Tokens tabs) */}
      {(activeTab === 'overview' || activeTab === 'tokens') && (
        <div className="mind-luxury-card rounded-3xl overflow-hidden relative">
          <div className="p-6 border-b border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-[#E7C45D]" />
              <div>
                <h3 className="text-sm font-semibold text-white font-sora">
                  Sui Network Token Holdings ({balances.length})
                </h3>
                <p className="text-xs text-[#8E939E]">
                  All live fungible tokens detected on the connected Sui wallet
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#E7C45D]">{formatUsd(totalUsd)}</span>
          </div>

          {balances.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#8E939E]">
              {connected
                ? 'This Sui address currently holds 0 non-zero fungible coin balances on Sui Mainnet.'
                : 'Connect your Sui wallet to read all live Sui network tokens.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0D0C0A] text-[#8E939E] uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th className="py-3.5 px-6">Token</th>
                    <th className="py-3.5 px-6">Balance</th>
                    <th className="py-3.5 px-6">Live Price</th>
                    <th className="py-3.5 px-6">USD Value</th>
                    <th className="py-3.5 px-6 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {balances.map((coin) => (
                    <tr key={coin.coinType} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          {coin.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={coin.iconUrl}
                              alt={coin.coinSymbol}
                              className="w-7 h-7 rounded-full object-cover border border-white/[0.1] shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#211B0E] border border-[#D4AF37]/35 text-[#F8E296] flex items-center justify-center font-sora font-bold text-[10px] shrink-0">
                              {coin.coinSymbol.slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white">{coin.coinSymbol}</p>
                            <p className="text-[11px] text-[#6B7280] truncate max-w-[220px]">
                              {coin.coinName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-white">
                        {coin.formattedBalance.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-[#9CA3AF]">
                        {coin.usdPrice > 0 ? formatUsd(coin.usdPrice) : 'Unpriced'}
                      </td>
                      <td className="py-3.5 px-6 font-mono font-semibold text-white">
                        {formatUsd(coin.usdValue)}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono text-[#F8E296]">
                        {coin.percentageOfPortfolio}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Behavioral Patterns View (Shown on Patterns tab) */}
      {activeTab === 'patterns' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="mind-luxury-card rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#211B0E] border border-[#D4AF37]/35 text-[#E7C45D] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white font-sora">Asset Concentration</h3>
            <p className="text-2xl font-bold font-sora text-[#F8E296]">
              {patternSummary.topAsset
                ? `${patternSummary.topAsset.percentageOfPortfolio}% ${patternSummary.topAsset.coinSymbol}`
                : '0%'}
            </p>
            <p className="text-xs text-[#8E939E] leading-relaxed">
              {patternSummary.topAsset
                ? `Your largest position is ${patternSummary.topAsset.coinSymbol} valued at ${formatUsd(patternSummary.topAsset.usdValue)} across ${balances.length} total token${balances.length === 1 ? '' : 's'}.`
                : 'Connect a funded Sui wallet to evaluate portfolio concentration.'}
            </p>
          </div>

          <div className="mind-luxury-card rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#211B0E] border border-[#D4AF37]/35 text-[#E7C45D] flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white font-sora">Stable Liquidity Buffer</h3>
            <p className="text-2xl font-bold font-sora text-white">
              {patternSummary.stableRatio}%
            </p>
            <p className="text-xs text-[#8E939E] leading-relaxed">
              {formatUsd(connected && walletData ? walletData.stableReserveUsd : 0)} held in liquid USD stablecoins (USDC / USDT / AUSD / FDUSD) on Sui Mainnet.
            </p>
          </div>

          <div className="mind-luxury-card rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#211B0E] border border-[#D4AF37]/35 text-[#E7C45D] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white font-sora">Execution Mix</h3>
            <p className="text-2xl font-bold font-sora text-white">
              {transactions.length} Blocks
            </p>
            <p className="text-xs text-[#8E939E] leading-relaxed">
              {patternSummary.receivedCount} inflows, {patternSummary.sentCount} outflows, and{' '}
              {patternSummary.swapOrContractCount} swaps or Move contract calls. Outflows are never guessed as merchant spending without user context.
            </p>
          </div>
        </div>
      )}

      {/* Recent Verified Transactions Table with Pagination & Semantic Notes */}
      {(activeTab === 'overview' || activeTab === 'transactions') && (
        <div className="mind-luxury-card rounded-3xl overflow-hidden relative">
          <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/50 to-transparent" />

          <div className="p-6 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white font-sora">Recent Transactions</h3>
              <p className="text-xs text-[#8E939E] mt-0.5">
                Verified transaction blocks with explicit transfer-intent provenance
              </p>
            </div>
            <span className="text-xs text-[#E7C45D] font-mono">
              {transactions.length} Verified Record{transactions.length === 1 ? '' : 's'}
            </span>
          </div>

          {!connected ? (
            <div className="p-10 text-center text-xs text-[#8E939E]">
              Connect your Sui wallet to load verified Mainnet transaction history.
            </div>
          ) : loading ? (
            <div className="p-10 text-center text-xs text-[#8E939E] font-mono">
              Fetching transaction blocks from Sui Mainnet...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#8E939E]">
              No transaction blocks found for this Sui Mainnet address yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0D0C0A] text-[#8E939E] uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="py-3.5 px-6">Type &amp; Provenance</th>
                      <th className="py-3.5 px-6">Asset</th>
                      <th className="py-3.5 px-6">Amount</th>
                      <th className="py-3.5 px-6">Counterparty</th>
                      <th className="py-3.5 px-6">Time</th>
                      <th className="py-3.5 px-6 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {pagedTransactions.map((tx) => (
                      <tr key={tx.digest} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-6 max-w-[300px]">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                                tx.type === 'Received'
                                  ? 'bg-[#2CCD9A]/10 text-[#2CCD9A] border-[#2CCD9A]/25'
                                  : tx.type === 'Swap'
                                  ? 'bg-[#D4AF37]/12 text-[#E7C45D] border-[#D4AF37]/30'
                                  : 'bg-white/[0.05] text-white border-white/[0.1]'
                              }`}
                            >
                              {tx.type === 'Received' ? (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              ) : tx.type === 'Swap' ? (
                                <RefreshCw className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-white block">{tx.type}</span>
                              {tx.semanticNote && (
                                <span className="text-[10px] text-[#8E939E] leading-snug block mt-0.5">
                                  {tx.semanticNote}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-white">{tx.asset}</td>
                        <td className="py-3.5 px-6 font-mono font-semibold">
                          <span className={tx.type === 'Received' ? 'text-[#2CCD9A]' : 'text-white'}>
                            {tx.amount}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 font-mono text-[#9CA3AF]">{tx.fromOrTo}</td>
                        <td className="py-3.5 px-6 text-[#8E939E]">{tx.timeAgo}</td>
                        <td className="py-3.5 px-6 text-right">
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#E7C45D] hover:text-[#FFF0B3] hover:underline font-mono text-[11px]"
                          >
                            <span>{tx.digest.slice(0, 6)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalTxPages > 1 && (
                <div className="px-6 py-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-[#8E939E] font-mono">
                    Page {safePage} of {totalTxPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-[#D1D5DB] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <button
                      onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                      disabled={safePage >= totalTxPages}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-[#D1D5DB] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

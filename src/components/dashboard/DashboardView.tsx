'use client';

import React, { useMemo } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Shield,
  Coins,
  Target,
  ExternalLink,
  Wallet,
  Layers,
  History,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { WalletOverview } from '@/lib/sui/types';
import { FinancialGoal, GoalIconKind } from '@/lib/goals/types';
import { ScreenTab } from '@/components/common/AppSidebar';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';

interface DashboardViewProps {
  walletData: WalletOverview | null;
  goals: FinancialGoal[];
  memoriesCount: number;
  loading: boolean;
  onNavigateTab: (tab: ScreenTab) => void;
}

const GOAL_ICON_MAP: Record<GoalIconKind, React.FC<{ className?: string }>> = {
  reserve: Shield,
  yield: Coins,
  growth: TrendingUp,
  purchase: Target,
};

function formatUsd(val: number): string {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  walletData,
  goals,
  memoriesCount,
  loading,
  onNavigateTab,
}) => {
  const { connected, openWalletModal } = useWallet();

  const totalUsd = connected && walletData ? walletData.totalBalanceUsd : 0;
  const suiChange = walletData?.suiChange24hPercent ?? 0;

  // Build SVG path from real sparkline data
  const sparklineGeometry = useMemo(() => {
    const pts = connected && walletData?.sparkline ? walletData.sparkline : [];
    const width = 500;
    const height = 104;

    if (pts.length < 2) {
      const flatY = 78;
      return {
        hasCurve: false,
        linePath: `M 0,${flatY} L ${width},${flatY}`,
        areaPath: `M 0,${flatY} L ${width},${flatY} L ${width},${height} L 0,${height} Z`,
        endX: width,
        endY: flatY,
      };
    }

    const values = pts.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    const coords = pts.map((pt, i) => {
      const x = (i / (pts.length - 1)) * width;
      const y =
        range < 0.0001
          ? 64
          : 84 - ((pt.value - minVal) / range) * 62;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x},${c.y}`)
      .join(' ');
    const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
    const last = coords[coords.length - 1];

    return {
      hasCurve: range >= 0.0001 || maxVal > 0,
      linePath,
      areaPath,
      endX: last.x,
      endY: last.y,
    };
  }, [connected, walletData]);

  // Dynamic real-data insights
  const dynamicInsights = useMemo(() => {
    if (!connected || !walletData) {
      return [
        {
          icon: Wallet,
          title: 'Awaiting Sui Wallet Connection',
          detail:
            'Connect Slush, Suiet, Nightly, Phantom, or any Sui Wallet Standard extension to stream real Mainnet balances.',
        },
        {
          icon: Target,
          title: 'Bind Financial Targets to Your Account',
          detail:
            'Once connected, create custom USD targets in Goals to anchor Mind’s allocation guidance.',
        },
        {
          icon: History,
          title: 'Persistent Memory Ledger',
          detail:
            'Record risk rules and financial preferences per wallet so future insights recall your exact context.',
        },
      ];
    }

    const items: {
      icon: React.FC<{ className?: string }>;
      title: string;
      detail: string;
    }[] = [];

    const topAsset = walletData.balances[0];
    if (topAsset) {
      items.push({
        icon: Layers,
        title: `Primary Exposure: ${topAsset.coinSymbol} (${topAsset.percentageOfPortfolio}%)`,
        detail: `Holding ${topAsset.formattedBalance.toLocaleString()} ${topAsset.coinSymbol} (${formatUsd(topAsset.usdValue)}) across ${walletData.balances.length} active Mainnet asset${walletData.balances.length === 1 ? '' : 's'}.`,
      });
    } else {
      items.push({
        icon: Layers,
        title: 'Zero Active Token Balances on Mainnet',
        detail:
          'No non-zero coin objects were found for this address yet. Deposit SUI or USDC to begin live portfolio tracking.',
      });
    }

    items.push({
      icon: Shield,
      title: `Stablecoin Reserve: ${formatUsd(walletData.stableReserveUsd)}`,
      detail:
        walletData.monthlySpendUsd > 0
          ? `30-day verified onchain outflow is ${formatUsd(walletData.monthlySpendUsd)} across ${walletData.transactions.length} inspected blocks.`
          : `0.00 USD in 30-day outgoing transfers detected across ${walletData.transactions.length} recent Mainnet transactions.`,
    });

    if (goals.length > 0) {
      const lead = goals[0];
      const pct = Math.min(100, Math.round((lead.currentUsd / lead.targetUsd) * 100));
      items.push({
        icon: Target,
        title: `Goal Progress: ${lead.title} (${pct}%)`,
        detail: `${formatUsd(lead.currentUsd)} allocated toward ${formatUsd(lead.targetUsd)} target • ${memoriesCount} context memor${memoriesCount === 1 ? 'y' : 'ies'} active.`,
      });
    } else {
      items.push({
        icon: History,
        title: `${memoriesCount} Saved Context Record${memoriesCount === 1 ? '' : 's'}`,
        detail:
          memoriesCount > 0
            ? 'Mind is actively grounding answers in your saved wallet memories. Add a financial goal to track target funding.'
            : 'No goals or memories recorded yet. Visit Goals or Memory to personalize Mind for this wallet.',
      });
    }

    return items;
  }, [connected, walletData, goals, memoriesCount]);

  return (
    <div className="space-y-6">
      {!connected && (
        <div className="gold-glass-plaque rounded-2xl p-5 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute -top-px left-8 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
          <div className="flex items-center gap-4">
            <MindLogo size="sm" framed showWordmark={false} />
            <div>
              <p className="text-sm font-semibold text-white font-sora">
                Sign in with your Sui wallet to activate live intelligence
              </p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Detects installed Sui browser extensions automatically and binds a dedicated profile, goals, and memory ledger to your address.
              </p>
            </div>
          </div>
          <button
            onClick={openWalletModal}
            className="btn-gold-primary px-5 py-2.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallet</span>
          </button>
        </div>
      )}

      {/* Top Grid: Portfolio Valuation (left 7 cols) + Live Intelligence Brief (right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hero Portfolio Balance Card */}
        <div className="lg:col-span-7 mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/65 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.14)_0%,transparent_70%)]" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[#9CA3AF]">
                Total Onchain Value
              </span>
              <span className="text-[11px] px-3 py-1 rounded-full bg-[#15120B] border border-[#D4AF37]/35 text-[#F5D76E] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D] animate-pulse-ring inline-block" />
                {!connected
                  ? 'Wallet Disconnected'
                  : walletData?.rpcSource === 'tatum-mainnet'
                  ? 'Sui Mainnet • Tatum RPC'
                  : 'Sui Mainnet • Live RPC'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-4xl font-sora font-bold text-white tracking-tight">
                {connected && loading ? 'Syncing...' : formatUsd(totalUsd)}
              </span>
              {connected && walletData && (
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full font-mono ${
                    suiChange >= 0
                      ? 'text-[#2CCD9A] bg-[#2CCD9A]/10 border border-[#2CCD9A]/25'
                      : 'text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/25'
                  }`}
                >
                  SUI {suiChange >= 0 ? '+' : ''}
                  {suiChange.toFixed(2)}% (24h)
                </span>
              )}
            </div>
          </div>

          {/* Real Trajectory Sparkline */}
          <div className="my-6 relative h-28 w-full z-10">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 500 104"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="mindGoldSparkArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E7C45D" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={sparklineGeometry.areaPath} fill="url(#mindGoldSparkArea)" />
              <path
                d={sparklineGeometry.linePath}
                fill="none"
                stroke="#E7C45D"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={sparklineGeometry.hasCurve ? undefined : '5 5'}
                opacity={sparklineGeometry.hasCurve ? 1 : 0.45}
                className={sparklineGeometry.hasCurve ? 'animate-sparkline' : ''}
              />
              {connected && sparklineGeometry.hasCurve && (
                <>
                  <circle
                    cx={sparklineGeometry.endX}
                    cy={sparklineGeometry.endY}
                    r="8"
                    fill="none"
                    stroke="#E7C45D"
                    strokeWidth="1.5"
                    className="animate-pulse-ring"
                  />
                  <circle
                    cx={sparklineGeometry.endX}
                    cy={sparklineGeometry.endY}
                    r="4"
                    fill="#FFF0B3"
                    className="animate-pulse"
                  />
                </>
              )}
            </svg>
            {!connected && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[11px] font-mono text-[#8E939E] bg-[#0B0B0B]/85 border border-white/[0.07] px-3 py-1 rounded-full">
                  Connect wallet to plot verified Mainnet balance history
                </span>
              </div>
            )}
          </div>

          {/* 3 Real Metrics Footer */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-left relative z-10">
            <div>
              <span className="text-[11px] text-[#8E939E] block">30d Outflow</span>
              <span className="text-base sm:text-lg font-semibold text-white font-sora mt-0.5 block">
                {formatUsd(connected && walletData ? walletData.monthlySpendUsd : 0)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-[#8E939E] block">Stable Reserve</span>
              <span className="text-base sm:text-lg font-semibold text-white font-sora mt-0.5 block">
                {formatUsd(connected && walletData ? walletData.stableReserveUsd : 0)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-[#8E939E] block">Active Goals</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base sm:text-lg font-semibold text-white font-sora">
                  {connected ? goals.length : 0}
                </span>
                <span className="text-[11px] text-[#D4AF37] font-mono hidden sm:inline">
                  {connected ? `${memoriesCount} mem` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Intelligence Brief Card */}
        <div className="lg:col-span-5 mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/55 to-transparent" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <MindLogo size="sm" showWordmark={false} />
              <h3 className="text-sm font-semibold text-white font-sora">Intelligence Brief</h3>
            </div>
            <button
              onClick={() => onNavigateTab('ask')}
              className="text-xs text-[#E7C45D] hover:text-[#FFF0B3] inline-flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              <span>Ask Mind</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 my-auto">
            {dynamicInsights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#0D0C0A]/90 border border-[#D4AF37]/18 hover:border-[#D4AF37]/38 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#251E0F] to-[#12100B] border border-[#D4AF37]/35 text-[#E7C45D] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F7F3E8] leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#8E939E] mt-1 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Financial Goals (left) + Recent Mainnet Activity (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Goals Card */}
        <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/50 to-transparent" />

          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-white font-sora">Financial Goals</h3>
                <p className="text-[11px] text-[#8E939E] mt-0.5">
                  Wallet-bound targets synced with Mind Memory
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('goals')}
                className="text-xs text-[#E7C45D] hover:text-[#FFF0B3] inline-flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <span>Manage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!connected ? (
              <div className="py-10 px-4 rounded-2xl bg-[#0C0B09]/80 border border-white/[0.06] text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E190E] border border-[#D4AF37]/30 text-[#E7C45D] flex items-center justify-center mx-auto">
                  <Target className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-[#D1D5DB]">
                  Connect your Sui wallet to view or create personal financial goals.
                </p>
              </div>
            ) : goals.length === 0 ? (
              <div className="py-9 px-4 rounded-2xl bg-[#0C0B09]/80 border border-white/[0.06] text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E190E] border border-[#D4AF37]/30 text-[#E7C45D] flex items-center justify-center mx-auto">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white font-sora">No active goals yet</p>
                  <p className="text-[11px] text-[#8E939E] mt-1 max-w-xs mx-auto">
                    Create your first savings or allocation target so Mind can measure your live portfolio against it.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('goals')}
                  className="btn-gold-secondary px-4 py-2 rounded-full text-xs text-[#F8E296] font-medium cursor-pointer"
                >
                  Create First Goal
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 3).map((goal) => {
                  const Icon = GOAL_ICON_MAP[goal.iconKind] || Target;
                  const pct = Math.min(
                    100,
                    Math.max(0, Math.round((goal.currentUsd / goal.targetUsd) * 100))
                  );
                  return (
                    <div
                      key={goal.id}
                      className="p-4 rounded-2xl bg-[#0D0C0A]/90 border border-white/[0.07] hover:border-[#D4AF37]/35 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-2.5 gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#211B0E] border border-[#D4AF37]/30 text-[#E7C45D] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-white block truncate">
                              {goal.title}
                            </span>
                            <span className="text-[10px] text-[#8E939E]">{goal.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono shrink-0">
                          <span className="text-white font-semibold">
                            ${goal.currentUsd.toLocaleString()}
                          </span>
                          <span className="text-[#6B7280]">
                            / ${goal.targetUsd.toLocaleString()}
                          </span>
                          <span className="text-[#E7C45D] font-bold ml-1">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#191815] overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-[#C9A227] via-[#E7C45D] to-[#FFF0B3] rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                          style={{ width: `${pct}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Onchain Activity Card */}
        <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/50 to-transparent" />

          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-white font-sora">Recent Activity</h3>
                <p className="text-[11px] text-[#8E939E] mt-0.5">
                  Verified Sui Mainnet transaction blocks
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('wallet')}
                className="text-xs text-[#E7C45D] hover:text-[#FFF0B3] inline-flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <span>Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!connected ? (
              <div className="py-10 px-4 rounded-2xl bg-[#0C0B09]/80 border border-white/[0.06] text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E190E] border border-[#D4AF37]/30 text-[#E7C45D] flex items-center justify-center mx-auto">
                  <Activity className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-[#D1D5DB]">
                  Connect your Sui wallet to inspect real incoming and outgoing Mainnet transactions.
                </p>
              </div>
            ) : loading ? (
              <div className="py-10 text-xs text-[#8E939E] text-center font-mono">
                Querying Sui Mainnet transaction blocks...
              </div>
            ) : !walletData || walletData.transactions.length === 0 ? (
              <div className="py-10 px-4 rounded-2xl bg-[#0C0B09]/80 border border-white/[0.06] text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#1E190E] border border-[#D4AF37]/30 text-[#E7C45D] flex items-center justify-center mx-auto">
                  <Activity className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-white font-sora">
                  No Mainnet transactions found
                </p>
                <p className="text-[11px] text-[#8E939E]">
                  Transactions signed or received by this Sui address will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {walletData.transactions.slice(0, 4).map((tx) => (
                  <div
                    key={tx.digest}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0D0C0A]/90 border border-white/[0.07] hover:border-[#D4AF37]/35 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          tx.type === 'Received'
                            ? 'bg-[#2CCD9A]/10 text-[#2CCD9A] border-[#2CCD9A]/25'
                            : tx.type === 'Swap'
                            ? 'bg-[#D4AF37]/12 text-[#E7C45D] border-[#D4AF37]/30'
                            : 'bg-white/[0.05] text-[#E5E7EB] border-white/[0.1]'
                        }`}
                      >
                        {tx.type === 'Received' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : tx.type === 'Swap' ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {tx.type === 'Received'
                            ? `Received ${tx.asset}`
                            : tx.type === 'Sent'
                            ? `Sent ${tx.asset}`
                            : tx.type === 'Swap'
                            ? `Swapped ${tx.asset}`
                            : `${tx.asset} Interaction`}
                        </p>
                        <p className="text-[11px] text-[#8E939E] font-mono truncate">
                          {tx.fromOrTo} • {tx.timeAgo}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-semibold font-mono block ${
                          tx.type === 'Received' ? 'text-[#2CCD9A]' : 'text-white'
                        }`}
                      >
                        {tx.amount}
                      </span>
                      <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-[#8E939E] hover:text-[#E7C45D] font-mono mt-0.5"
                      >
                        <span>SuiVision</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

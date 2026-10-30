'use client';

import React, { useState } from 'react';
import {
  Play,
  Wallet,
  History,
  RefreshCcw,
  AlertCircle,
  GitCompare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ReplayComparison } from '@/lib/intelligence/engine';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';

export const MemoryReplayView: React.FC = () => {
  const { connected, address, openWalletModal } = useWallet();
  const [queryInput, setQueryInput] = useState(
    'Should I rebalance my current Sui portfolio or hold?'
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayData, setReplayData] = useState<ReplayComparison | null>(null);

  const presets = [
    'Should I rebalance my current Sui portfolio or hold?',
    'How much liquidity can I deploy into DeFi yield right now?',
    'Evaluate my portfolio risk against my stated goals',
  ];

  const handleRunReplay = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? queryInput).trim();
    if (!q || running) return;

    if (!connected || !address) {
      openWalletModal();
      return;
    }

    if (overrideQuery) setQueryInput(overrideQuery);
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/intelligence/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, address }),
      });
      const data = await res.json();
      if (data?.success && data?.replay) {
        setReplayData(data.replay);
      } else {
        setError(data?.error || 'Unable to execute live memory replay.');
      }
    } catch {
      setError('Network error while running live memory replay.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left">
      {/* Top Replay Control Plaque */}
      <div className="gold-glass-plaque rounded-3xl p-5 sm:p-6 space-y-4 relative overflow-hidden">
        <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
        {running && <div className="animate-laser-sweep pointer-events-none opacity-70" />}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-[#0C0B09]/90 border border-white/[0.09] focus-within:border-[#D4AF37]/60 rounded-2xl px-4 py-2.5 transition-colors">
            <MindLogo size="sm" showWordmark={false} />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunReplay()}
              placeholder="Enter any financial decision prompt to compare..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-[#6B7280] outline-none"
            />
          </div>

          <button
            onClick={() => handleRunReplay()}
            disabled={running || !queryInput.trim()}
            className="btn-gold-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold text-xs shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{running ? 'Running Controlled Replay...' : 'Run Replay'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[#8E939E] font-mono mr-1">Scenarios:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleRunReplay(p)}
              className="text-[11px] px-3 py-1 rounded-full bg-white/[0.03] hover:bg-[#1E190D] border border-white/[0.08] hover:border-[#D4AF37]/40 text-[#9CA3AF] hover:text-[#F8E296] transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mind-luxury-card rounded-2xl p-4 border border-red-500/35 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Disconnected / Ready Stage / Controlled Comparison */}
      {!connected ? (
        <div className="mind-luxury-card rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
          <div className="flex justify-center">
            <MindLogo size="md" framed showWordmark={false} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-sora font-semibold text-white">
              Connect Your Sui Wallet to Run Memory Replay
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Memory Replay freezes a single live Sui Mainnet snapshot and evaluates it twice under identical model settings: once with zero memories (Mode A) and once with your recalled Walrus memories (Mode B).
            </p>
          </div>
          <button
            onClick={openWalletModal}
            className="btn-gold-primary px-6 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect Sui Wallet</span>
          </button>
        </div>
      ) : !replayData ? (
        <div className="mind-luxury-card rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-[#211B0E] border border-[#D4AF37]/40 text-[#E7C45D] flex items-center justify-center mx-auto">
            <RefreshCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-lg font-sora font-semibold text-white">
              Ready to Compare Live Context Impact
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Click <strong className="text-[#F8E296]">Run Replay</strong> above to evaluate your connected Sui Mainnet snapshot ({address?.slice(0, 6)}...{address?.slice(-4)}) side by side: raw onchain data alone vs. your personal Walrus Memory ledger.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Frozen Snapshot Provenance Bar */}
          <div className="mind-luxury-card rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#F8E296]">
                Frozen Snapshot: ${replayData.snapshotTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[#8E939E]">
                · Source:{' '}
                {replayData.snapshot.rpcSource === 'tatum-mainnet'
                  ? 'Tatum Sui Mainnet gRPC'
                  : 'Sui Mainnet'}
              </span>
              <span className="text-[#8E939E]">
                · Captured {new Date(replayData.snapshot.fetchedAt).toLocaleTimeString()}
              </span>
            </div>
            <span className="text-[11px] text-[#9CA3AF]">
              Engine:{' '}
              {replayData.reasoningMeta.mode === 'llm'
                ? `${replayData.reasoningMeta.provider} (${replayData.reasoningMeta.model})`
                : 'Deterministic Grounded'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Side: Mode A — Without Remembered Context */}
            <div className="mind-luxury-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" />
                    <h3 className="text-sm font-semibold text-white font-sora">
                      {replayData.withoutContext.title}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-[#9CA3AF] font-mono">
                    {replayData.withoutContext.badge}
                  </span>
                </div>

                <p className="text-xs text-[#D1D5DB] leading-relaxed">
                  {replayData.withoutContext.text}
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                <span className="text-[11px] font-semibold text-[#8E939E] uppercase tracking-wider font-mono">
                  Stateless Inputs
                </span>
                <ul className="space-y-2 text-xs text-[#9CA3AF]">
                  {replayData.withoutContext.keyPoints.map((pt, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280] mt-1.5 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Side: Mode B — With Remembered Context */}
            <div className="gold-glass-plaque rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/80 to-transparent" />
              <div className="pointer-events-none absolute top-0 right-0 w-52 h-52 bg-[radial-gradient(circle,rgba(212,175,55,0.14)_0%,transparent_70%)]" />
              <div className="animate-laser-sweep pointer-events-none opacity-35" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.09]">
                  <div className="flex items-center gap-2.5">
                    <MindLogo size="sm" showWordmark={false} />
                    <h3 className="text-sm font-semibold text-white font-sora">
                      {replayData.withContext.title}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/45 text-[#F8E296] font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D] animate-pulse-ring inline-block" />
                    {replayData.withContext.badge}
                  </span>
                </div>

                <p className="text-xs text-[#F7F3E8] leading-relaxed font-medium">
                  {replayData.withContext.text}
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/[0.09] relative z-10">
                <div>
                  <span className="text-[11px] font-semibold text-[#E7C45D] uppercase tracking-wider font-mono">
                    Context-Grounded Factors
                  </span>
                  <ul className="space-y-2 text-xs text-[#F5F5F5] mt-2">
                    {replayData.withContext.keyPoints.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D] mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-[#8E939E] font-mono inline-flex items-center gap-1">
                    <History className="w-3 h-3 text-[#E7C45D]" />
                    <span>Memories recalled ({replayData.withContext.recalledMemories.length}):</span>
                  </span>
                  {replayData.withContext.recalledMemories.length === 0 ? (
                    <span className="text-[10px] text-[#8E939E] font-mono">
                      0 saved memories
                    </span>
                  ) : (
                    replayData.withContext.recalledMemories.map((m) => (
                      <span
                        key={m.id}
                        className="px-2.5 py-0.5 rounded-full bg-[#17140C] border border-[#D4AF37]/40 text-[10px] text-[#F8E296]"
                      >
                        {m.title}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Blueprint Section 8: What Changed, Why Context Matters & Uncertainties */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="mind-luxury-card rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#F8E296]">
                <GitCompare className="w-4 h-4 text-[#E7C45D]" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-sora">
                  What Changed
                </h4>
              </div>
              <ul className="space-y-2 text-xs text-[#D1D5DB] leading-relaxed">
                {replayData.whatChanged.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D] mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mind-luxury-card rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#F8E296]">
                <Sparkles className="w-4 h-4 text-[#E7C45D]" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-sora">
                  Why Remembered Context Matters
                </h4>
              </div>
              <p className="text-xs text-[#D1D5DB] leading-relaxed">
                {replayData.whyContextMatters}
              </p>
            </div>

            <div className="mind-luxury-card rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <ShieldAlert className="w-4 h-4 text-[#E7C45D]" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-sora text-white">
                  Remaining Uncertainties
                </h4>
              </div>
              <ul className="space-y-2 text-xs text-[#9CA3AF] leading-relaxed">
                {replayData.uncertainties.map((u, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280] mt-1.5 shrink-0" />
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

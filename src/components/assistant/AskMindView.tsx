'use client';

import React, { useState } from 'react';
import {
  Send,
  Wallet,
  Layers,
  History,
  AlertCircle,
  CheckCircle2,
  BookmarkCheck,
  Info,
} from 'lucide-react';
import { AnalysisResponse } from '@/lib/intelligence/engine';
import { WalrusMemory, MemoryCategory } from '@/lib/walrus/types';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';

interface AskMindViewProps {
  currentAddress: string | null;
  onSelectMemoryTag?: (tag: string) => void;
  onMemoryAutoSaved?: (memory: WalrusMemory) => void;
  onSaveFeedbackMemory?: (
    title: string,
    content: string,
    category: MemoryCategory
  ) => Promise<void>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content?: string;
  analysis?: AnalysisResponse;
  error?: string;
  time: string;
  feedbackSaved?: boolean;
}

export const AskMindView: React.FC<AskMindViewProps> = ({
  currentAddress,
  onSelectMemoryTag,
  onMemoryAutoSaved,
  onSaveFeedbackMemory,
}) => {
  const { connected, openWalletModal } = useWallet();
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async (overridePrompt?: string) => {
    const userQ = (overridePrompt ?? inputQuery).trim();
    if (!userQ || loading) return;

    if (!connected || !currentAddress) {
      openWalletModal();
      return;
    }

    if (!overridePrompt) setInputQuery('');
    setLoading(true);

    const timeLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userQ, time: timeLabel },
    ];
    setMessages(nextMessages);

    try {
      const res = await fetch('/api/intelligence/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQ, address: currentAddress }),
      });
      const data = await res.json();

      if (data?.success && data?.result) {
        const result: AnalysisResponse = data.result;
        if (result.autoSavedMemory && onMemoryAutoSaved) {
          onMemoryAutoSaved(result.autoSavedMemory);
        }
        setMessages([
          ...nextMessages,
          { role: 'assistant', analysis: result, time: timeLabel },
        ]);
      } else {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            error: data?.error || 'Unable to complete live Mainnet analysis.',
            time: timeLabel,
          },
        ]);
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          error: 'Network error while querying Sui Mainnet intelligence.',
          time: timeLabel,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordHelpfulFeedback = async (msgIndex: number, recommendationText: string) => {
    if (!onSaveFeedbackMemory) return;
    await onSaveFeedbackMemory(
      'Accepted strategic guidance',
      `Confirmed helpful recommendation: ${recommendationText.slice(0, 260)}`,
      'Feedback'
    );
    setMessages((prev) =>
      prev.map((m, idx) => (idx === msgIndex ? { ...m, feedbackSaved: true } : m))
    );
  };

  const suggestedPrompts = [
    'Analyze my live Sui portfolio concentration and stable reserve',
    'I want to keep at least $1,500 in liquid USDC reserve and alert me if SUI exceeds 70%',
    'Summarize my recent Mainnet transaction activity and what remains uncertain',
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-9.5rem)] max-w-4xl mx-auto justify-between space-y-5">
      {/* Chat Stream or Luxury Empty Stage */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {messages.length === 0 ? (
          <div className="gold-glass-plaque rounded-3xl p-8 sm:p-10 text-center space-y-6 my-4 relative overflow-hidden">
            <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.14)_0%,transparent_70%)]" />

            <div className="flex justify-center relative z-10">
              <MindLogo size="lg" framed showWordmark={false} />
            </div>

            <div className="space-y-2 max-w-xl mx-auto relative z-10">
              <h2 className="text-xl sm:text-2xl font-sora font-semibold text-white">
                Personal Financial Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                {connected && currentAddress
                  ? `Connected to ${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}. Ask about your live Sui Mainnet balances or state a personal goal or risk preference — Mind automatically remembers durable context in Walrus Memory.`
                  : 'Connect your Sui wallet first so Mind can inspect your real Mainnet balances, goals, and saved Walrus context.'}
              </p>
            </div>

            {!connected ? (
              <div className="relative z-10 pt-1">
                <button
                  onClick={openWalletModal}
                  className="btn-gold-primary px-6 py-3 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Sui Wallet</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2 relative z-10">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="mind-luxury-card rounded-2xl p-4 text-xs text-[#E5E7EB] hover:text-[#FFF0B3] leading-relaxed text-left cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === 'user') {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-lg bg-gradient-to-br from-[#231D10] to-[#12110E] text-[#F7F3E8] text-xs sm:text-sm px-5 py-3.5 rounded-2xl rounded-tr-sm border border-[#D4AF37]/35 shadow-lg">
                    <p>{msg.content}</p>
                    <span className="block text-[10px] text-[#8E939E] text-right mt-1.5 font-mono">
                      {msg.time}
                    </span>
                  </div>
                </div>
              );
            }

            if (msg.error) {
              return (
                <div key={idx} className="flex items-start gap-3.5">
                  <MindLogo size="sm" framed showWordmark={false} />
                  <div className="flex-1 mind-luxury-card rounded-2xl p-5 border border-red-500/30 text-xs text-red-300 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{msg.error}</span>
                  </div>
                </div>
              );
            }

            const analysis = msg.analysis!;
            return (
              <div key={idx} className="flex items-start gap-3.5">
                <MindLogo size="sm" framed showWordmark={false} className="mt-0.5" />

                <div className="flex-1 mind-luxury-card rounded-3xl p-6 space-y-4 text-left relative overflow-hidden">
                  <div className="absolute -top-px left-10 right-14 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/55 to-transparent" />

                  {/* Learning Loop Auto-Remembered Banner */}
                  {analysis.autoSavedMemory && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-[#2CCD9A]/10 border border-[#2CCD9A]/30 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-[#2CCD9A] min-w-0">
                        <BookmarkCheck className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          Remembered [{analysis.autoSavedMemory.category}]:{' '}
                          <strong className="text-white">{analysis.autoSavedMemory.title}</strong>
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#9CA3AF] shrink-0">
                        {analysis.autoSavedMemory.verifiedOnMainnet
                          ? 'Walrus Mainnet'
                          : 'Wallet Ledger'}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white font-sora flex-1">
                      {analysis.answer}
                    </p>
                    {analysis.reasoningMeta && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-[#9CA3AF] shrink-0">
                        {analysis.reasoningMeta.mode === 'llm'
                          ? `${analysis.reasoningMeta.provider} · ${analysis.reasoningMeta.model}`
                          : 'Grounded Synthesis'}
                      </span>
                    )}
                  </div>

                  {/* Live Onchain Evidence Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13110B] border border-[#D4AF37]/30 text-[11px] font-mono text-[#F8E296]">
                      <Layers className="w-3 h-3 text-[#E7C45D]" />
                      <span>Total: {analysis.evidence.portfolioTotalUsd}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13110B] border border-white/[0.08] text-[11px] font-mono text-[#D1D5DB]">
                      <span>Top: {analysis.evidence.topHolding}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13110B] border border-white/[0.08] text-[11px] font-mono text-[#9CA3AF]">
                      <span>{analysis.evidence.recentTxCount} Mainnet txs</span>
                    </span>
                  </div>

                  {/* Grounded Observations */}
                  <ul className="space-y-2 text-xs text-[#D1D5DB] leading-relaxed">
                    {analysis.observations.map((obs, oIdx) => (
                      <li key={oIdx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E7C45D] mt-1.5 shrink-0" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Highlighted Gold Recommendation Plaque */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#261E0D]/90 to-[#141109]/95 border border-[#D4AF37]/55 space-y-2 shadow-[0_0_24px_rgba(212,175,55,0.12)]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E7C45D] animate-pulse" />
                        <span className="text-[11px] font-bold text-[#F8E296] uppercase tracking-[0.16em] font-sora">
                          Strategic Recommendation
                        </span>
                      </div>

                      {onSaveFeedbackMemory && (
                        <button
                          onClick={() =>
                            void handleRecordHelpfulFeedback(idx, analysis.recommendation)
                          }
                          disabled={msg.feedbackSaved}
                          className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#14110A] hover:bg-[#1E190E] border border-[#D4AF37]/40 text-[#F8E296] inline-flex items-center gap-1 cursor-pointer disabled:opacity-70"
                        >
                          <CheckCircle2 className="w-3 h-3 text-[#2CCD9A]" />
                          <span>
                            {msg.feedbackSaved ? 'Saved to Memory' : 'Remember This Guidance'}
                          </span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#FFF4CC] font-medium leading-relaxed">
                      {analysis.recommendation}
                    </p>
                  </div>

                  {/* Honest Uncertainties (Blueprint Section 6.4) */}
                  {analysis.uncertainties && analysis.uncertainties.length > 0 && (
                    <div className="rounded-2xl bg-[#0D0C0A] border border-white/[0.07] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                        <Info className="w-3 h-3 text-[#E7C45D]" />
                        <span>Onchain Scope &amp; Uncertainty</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-[#8E939E] leading-relaxed">
                        {analysis.uncertainties.map((u, uIdx) => (
                          <li key={uIdx}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recalled Context Provenance */}
                  <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#8E939E] font-mono inline-flex items-center gap-1.5 mr-1">
                      <History className="w-3 h-3 text-[#E7C45D]" />
                      <span>Context recalled ({analysis.recalledMemories.length}):</span>
                    </span>
                    {analysis.recalledMemories.length === 0 ? (
                      <span className="text-[11px] text-[#6B7280] font-mono">
                        None saved yet — state a goal or preference to personalize
                      </span>
                    ) : (
                      analysis.recalledMemories.map((mem) => (
                        <button
                          key={mem.id}
                          onClick={() => onSelectMemoryTag?.(mem.title)}
                          className="px-2.5 py-1 rounded-full bg-[#17140C] hover:bg-[#241E10] border border-[#D4AF37]/40 text-[10px] text-[#F8E296] cursor-pointer transition-colors"
                        >
                          {mem.title}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-[#E7C45D] py-2 pl-1">
            <MindLogo size="sm" framed showWordmark={false} />
            <span className="font-mono">
              Observing Sui Mainnet state, recalling Walrus SEAL memories &amp; reasoning...
            </span>
          </div>
        )}
      </div>

      {/* Bottom Prompt Bar */}
      <div className="space-y-3 pt-2">
        {messages.length > 0 && connected && (
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                onClick={() => setInputQuery(prompt)}
                className="text-[11px] px-3.5 py-1.5 rounded-full bg-[#11100D] hover:bg-[#1C1810] border border-white/[0.08] hover:border-[#D4AF37]/40 text-[#9CA3AF] hover:text-[#F8E296] transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div className="gold-glass-plaque rounded-2xl p-2 flex items-center gap-2 focus-within:border-[#F5D76E]/70 transition-colors">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              connected
                ? 'Ask Mind about your live Sui balances, or state a goal/rule to remember...'
                : 'Connect your Sui wallet to ask Mind about your portfolio...'
            }
            className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#6B7280] outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || loading}
            className="btn-gold-primary p-3 rounded-xl disabled:opacity-40 shrink-0 cursor-pointer"
            aria-label="Send message to Mind"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

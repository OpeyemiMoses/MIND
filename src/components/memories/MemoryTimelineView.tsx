'use client';

import React, { useState } from 'react';
import {
  Plus,
  History,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Pencil,
  Wallet,
  X,
  Clock,
} from 'lucide-react';
import { WalrusMemory, MemoryCategory } from '@/lib/walrus/types';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';
import { Reveal } from '@/components/common/Reveal';

interface MemoryTimelineViewProps {
  memories: WalrusMemory[];
  onAddMemory: (title: string, content: string, category: MemoryCategory) => Promise<void>;
  onUpdateMemory: (
    id: string,
    title: string,
    content: string,
    category: MemoryCategory
  ) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

const CATEGORIES: ('All' | MemoryCategory)[] = [
  'All',
  'Goal',
  'Preference',
  'Pattern',
  'Outcome',
  'Feedback',
];

export const MemoryTimelineView: React.FC<MemoryTimelineViewProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const { connected, openWalletModal } = useWallet();
  const [selectedFilter, setSelectedFilter] = useState<'All' | MemoryCategory>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<MemoryCategory>('Preference');
  const [saving, setSaving] = useState(false);

  const filteredMemories =
    selectedFilter === 'All'
      ? memories
      : memories.filter((m) => m.category === selectedFilter);

  const verifiedMainnetCount = memories.filter((m) => m.verifiedOnMainnet).length;

  const handleOpenAdd = () => {
    if (!connected) {
      openWalletModal();
      return;
    }
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('Preference');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mem: WalrusMemory) => {
    setEditingId(mem.id);
    setFormTitle(mem.title);
    setFormContent(mem.content);
    setFormCategory(mem.category);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || saving) return;

    setSaving(true);
    try {
      if (editingId) {
        await onUpdateMemory(editingId, formTitle.trim(), formContent.trim(), formCategory);
      } else {
        await onAddMemory(formTitle.trim(), formContent.trim(), formCategory);
      }
      setFormTitle('');
      setFormContent('');
      setEditingId(null);
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const categoryColors: Record<MemoryCategory, string> = {
    Goal: 'bg-[#D4AF37]/15 text-[#F8E296] border-[#D4AF37]/35',
    Preference: 'bg-[#38BDF8]/12 text-[#7DD3FC] border-[#38BDF8]/30',
    Pattern: 'bg-[#A855F7]/12 text-[#D8B4FE] border-[#A855F7]/30',
    Outcome: 'bg-[#2CCD9A]/12 text-[#2CCD9A] border-[#2CCD9A]/30',
    Feedback: 'bg-[#F59E0B]/12 text-[#FCD34D] border-[#F59E0B]/30',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      {/* Top Filter & Action Bar */}
      <Reveal animation="fade-up" durationMs={450}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedFilter === cat
                    ? 'bg-gradient-to-r from-[#28200E] to-[#15120A] text-[#F8E296] border border-[#D4AF37]/50 shadow-[inset_0_1px_0_rgba(255,240,185,0.2)]'
                    : 'bg-white/[0.02] text-[#8E939E] hover:text-white border border-white/[0.07]'
                }`}
              >
                {cat === 'All' ? 'All Records' : `${cat}s`}
              </button>
            ))}
          </div>

          <button
            onClick={handleOpenAdd}
            className="btn-gold-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>
      </Reveal>

      {/* Ledger Status Plaque */}
      <Reveal animation="fade-up" delayMs={60} durationMs={450}>
        <div className="mind-luxury-card rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#2CCD9A] shrink-0" />
          <span className="text-[#9CA3AF]">
            Personal Memory Ledger:{' '}
            <strong className="text-white font-mono">
              {connected ? memories.length : 0} total
            </strong>{' '}
            ·{' '}
            <strong className="text-[#2CCD9A] font-mono">
              {connected ? verifiedMainnetCount : 0} verified on Walrus Mainnet
            </strong>
          </span>
        </div>
        <span className="text-[11px] text-[#E7C45D] font-mono">
          {connected ? 'Isolated Per-Wallet SEAL Namespace' : 'Wallet Disconnected'}
        </span>
      </div>
      </Reveal>

      {/* Disconnected / Empty / Timeline Feed */}
      {!connected ? (
        <Reveal animation="pop" durationMs={500}>
          <div className="gold-glass-plaque rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
            <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
            <div className="flex justify-center">
              <MindLogo size="md" framed showWordmark={false} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-sora font-semibold text-white">
                Connect Your Sui Wallet to Access Memory
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Your financial preferences, past decisions, and Walrus SEAL-encrypted memories are isolated exclusively to your Sui address.
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
        </Reveal>
      ) : filteredMemories.length === 0 ? (
        <Reveal animation="pop" durationMs={500}>
          <div className="gold-glass-plaque rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
            <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
            <div className="w-12 h-12 rounded-2xl bg-[#211B0E] border border-[#D4AF37]/40 text-[#E7C45D] flex items-center justify-center mx-auto">
              <History className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-sora font-semibold text-white">
                {memories.length === 0
                  ? 'Your Memory Timeline Is Empty'
                  : `No ${selectedFilter} Memories Recorded`}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Save your risk rules, profit-taking thresholds, or past decisions here so Mind recalls them across sessions whenever analyzing your wallet.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="btn-gold-primary px-6 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record First Memory</span>
            </button>
          </div>
        </Reveal>
      ) : (
        <div className="relative pl-7 space-y-4 before:absolute before:left-2.5 before:top-4 before:bottom-4 before:w-px before:bg-gradient-to-b before:from-[#E7C45D] before:via-[#D4AF37]/30 before:to-transparent">
          {filteredMemories.map((mem, idx) => (
            <Reveal key={mem.id} animation="slide-right" delayMs={idx * 60} durationMs={500}>
              <div className="relative group">
                {/* Gold Timeline Node */}
                <div className="absolute -left-[23px] top-6 w-3 h-3 rounded-full bg-[#E7C45D] ring-4 ring-[#080808] shadow-[0_0_12px_rgba(212,175,55,0.55)] group-hover:scale-125 transition-transform" />

                <div className="mind-luxury-card rounded-3xl p-5 sm:p-6 space-y-3 relative overflow-hidden transition-all duration-300 hover:border-[#D4AF37]/45 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(212,175,55,0.12)]">
                  <div className="absolute -top-px left-8 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/45 to-transparent" />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#211B0E] border border-[#D4AF37]/35 text-[#E7C45D] flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white font-sora truncate">
                        {mem.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          categoryColors[mem.category] || categoryColors.Goal
                        }`}
                      >
                        {mem.category}
                      </span>
                      <span className="text-[11px] text-[#8E939E] font-mono hidden sm:inline">
                        {mem.timestamp}
                      </span>
                      <button
                        onClick={() => handleOpenEdit(mem)}
                        title="Review or correct memory"
                        className="w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-[#D4AF37]/15 border border-white/[0.07] hover:border-[#D4AF37]/40 text-[#8E939E] hover:text-[#F8E296] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        title="Forget / remove memory"
                        className="w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-red-500/15 border border-white/[0.07] hover:border-red-500/35 text-[#8E939E] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#D1D5DB] leading-relaxed">{mem.content}</p>

                  {mem.usedCount && mem.usedCount > 0 ? (
                    <div className="text-[11px] font-mono text-[#9CA3AF] flex flex-wrap items-center gap-2">
                      <span className="text-[#F8E296]">
                        Used in {mem.usedCount} analys{mem.usedCount === 1 ? 'is' : 'es'}
                      </span>
                      {mem.lastUsedContext && (
                        <span className="text-[#6B7280] truncate max-w-[340px]">
                          · Last: {mem.lastUsedContext}
                        </span>
                      )}
                    </div>
                  ) : null}

                  <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-[#E7C45D] truncate max-w-[290px]">
                      {mem.blobId
                        ? `Blob: ${mem.blobId}`
                        : mem.jobId
                        ? `Job: ${mem.jobId}`
                        : mem.id}
                    </span>

                    {mem.verifiedOnMainnet ? (
                      <span className="text-[#2CCD9A] inline-flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2CCD9A] animate-pulse-ring inline-block" />
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified on Walrus Mainnet</span>
                      </span>
                    ) : mem.writeStatus === 'uploading' ? (
                      <span className="text-[#F8E296] inline-flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Uploading via Walrus Relayer</span>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF] inline-flex items-center gap-1 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#E7C45D]" />
                        <span>Local Wallet Ledger</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* Add / Edit Memory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="gold-glass-plaque rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 text-left relative overflow-hidden">
            <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/75 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <MindLogo size="sm" framed showWordmark={false} />
                <div>
                  <h3 className="text-base font-semibold text-white font-sora">
                    {editingId ? 'Review & Correct Memory' : 'Record Financial Memory'}
                  </h3>
                  <p className="text-[11px] text-[#8E939E]">
                    Encrypted &amp; isolated for your connected Sui wallet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                  className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#D4AF37]"
                >
                  <option value="Preference">Preference</option>
                  <option value="Goal">Goal</option>
                  <option value="Pattern">Pattern</option>
                  <option value="Outcome">Outcome</option>
                  <option value="Feedback">Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Memory Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Conservative profit-taking rule, Minimum USDC reserve"
                  required
                  className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Context Details
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={3}
                  placeholder="Describe the rule, preference, or past outcome Mind should recall when evaluating your portfolio..."
                  required
                  className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-gold-primary px-6 py-2.5 rounded-full font-semibold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Recording...' : editingId ? 'Save Correction' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

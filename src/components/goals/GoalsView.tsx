'use client';

import React, { useState } from 'react';
import {
  Target,
  Plus,
  Shield,
  Coins,
  TrendingUp,
  Trash2,
  Wallet,
  X,
  CheckCircle2,
} from 'lucide-react';
import { FinancialGoal, GoalIconKind } from '@/lib/goals/types';
import { MindLogo } from '@/components/common/MindLogo';
import { useWallet } from '@/context/WalletContext';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onAddGoal: (payload: {
    title: string;
    currentUsd: number;
    targetUsd: number;
    category: string;
    iconKind: GoalIconKind;
    deadline: string;
  }) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
}

const GOAL_TYPES: {
  kind: GoalIconKind;
  label: string;
  category: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { kind: 'reserve', label: 'Safety Reserve', category: 'Safety Reserve', Icon: Shield },
  { kind: 'yield', label: 'Yield & Staking', category: 'Yield & Staking', Icon: Coins },
  { kind: 'growth', label: 'Portfolio Growth', category: 'Portfolio Growth', Icon: TrendingUp },
  { kind: 'purchase', label: 'Milestone Target', category: 'Milestone Target', Icon: Target },
];

const ICON_BY_KIND: Record<GoalIconKind, React.FC<{ className?: string }>> = {
  reserve: Shield,
  yield: Coins,
  growth: TrendingUp,
  purchase: Target,
};

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  onAddGoal,
  onDeleteGoal,
}) => {
  const { connected, openWalletModal } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [targetUsd, setTargetUsd] = useState('');
  const [currentUsd, setCurrentUsd] = useState('');
  const [deadline, setDeadline] = useState('');
  const [iconKind, setIconKind] = useState<GoalIconKind>('reserve');
  const [saving, setSaving] = useState(false);

  const handleOpenNew = () => {
    if (!connected) {
      openWalletModal();
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetUsd || saving) return;

    const parsedTarget = parseFloat(targetUsd);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) return;

    const selectedType =
      GOAL_TYPES.find((t) => t.kind === iconKind) || GOAL_TYPES[0];

    setSaving(true);
    try {
      await onAddGoal({
        title: title.trim(),
        currentUsd: Math.max(0, parseFloat(currentUsd) || 0),
        targetUsd: parsedTarget,
        category: selectedType.category,
        iconKind,
        deadline: deadline.trim() || 'Ongoing',
      });
      setTitle('');
      setTargetUsd('');
      setCurrentUsd('');
      setDeadline('');
      setIconKind('reserve');
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-sora font-semibold text-white">Wallet Financial Goals</h2>
          <p className="text-xs text-[#8E939E] mt-0.5">
            Every goal is bound to your Sui wallet and automatically written into your Mind Memory ledger.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="btn-gold-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Disconnected or Empty States vs Live Goals Grid */}
      {!connected ? (
        <div className="gold-glass-plaque rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
          <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
          <div className="flex justify-center">
            <MindLogo size="md" framed showWordmark={false} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-sora font-semibold text-white">
              Connect Your Sui Wallet to Manage Goals
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Financial targets are isolated per Sui wallet address so your savings milestones and yield reserves stay private to your account.
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
      ) : goals.length === 0 ? (
        <div className="gold-glass-plaque rounded-3xl p-10 text-center space-y-5 relative overflow-hidden">
          <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/70 to-transparent" />
          <div className="w-12 h-12 rounded-2xl bg-[#211B0E] border border-[#D4AF37]/40 text-[#E7C45D] flex items-center justify-center mx-auto">
            <Target className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-sora font-semibold text-white">
              No Financial Goals Created Yet
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Add a reserve, yield, or milestone target. Mind will store it in your memory timeline and factor it into every portfolio analysis.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-gold-primary px-6 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((g) => {
            const Icon = ICON_BY_KIND[g.iconKind] || Target;
            const percent = Math.min(
              100,
              Math.max(0, Math.round((g.currentUsd / g.targetUsd) * 100))
            );
            return (
              <div
                key={g.id}
                className="mind-luxury-card rounded-3xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden hover:-translate-y-1 hover:border-[#D4AF37]/50 hover:shadow-[0_12px_32px_rgba(212,175,55,0.18)] transition-all duration-300"
              >
                <div className="absolute -top-px left-8 right-10 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/55 to-transparent" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#261E0E] to-[#12100B] border border-[#D4AF37]/40 text-[#E7C45D] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {percent >= 100 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/25 border border-[#D4AF37]/60 text-[#FFF0B3] font-mono font-bold animate-pulse-ring">
                          <CheckCircle2 className="w-3 h-3 text-[#2CCD9A]" />
                          <span>Goal Met</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-[#15120B] border border-[#D4AF37]/30 text-[#F8E296] font-mono">
                          <CheckCircle2 className="w-3 h-3 text-[#2CCD9A]" />
                          <span>Memory Linked</span>
                        </span>
                      )}
                      <button
                        onClick={() => onDeleteGoal(g.id)}
                        title="Remove goal"
                        className="w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-red-500/15 border border-white/[0.07] hover:border-red-500/35 text-[#8E939E] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white font-sora">{g.title}</h3>
                    <p className="text-xs text-[#8E939E] mt-0.5">{g.category}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-white font-bold text-sm">
                      ${g.currentUsd.toLocaleString()}
                    </span>
                    <span className="text-[#8E939E]">
                      Target: ${g.targetUsd.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[#191815] overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-[#C9A227] via-[#E7C45D] to-[#FFF0B3] rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                      style={{ width: `${percent}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#8E939E] pt-1">
                    <span>Horizon: {g.deadline}</span>
                    <span className="text-[#F8E296] font-semibold font-mono">{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="gold-glass-plaque rounded-3xl max-w-md w-full p-6 sm:p-7 text-left space-y-5 relative overflow-hidden">
            <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/75 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <MindLogo size="sm" framed showWordmark={false} />
                <div>
                  <h3 className="text-base font-semibold text-white font-sora">
                    Create Financial Goal
                  </h3>
                  <p className="text-[11px] text-[#8E939E]">
                    Saved to your wallet profile &amp; Memory timeline
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
                <label className="block text-xs font-medium text-[#D1D5DB] mb-2">
                  Goal Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_TYPES.map((item) => {
                    const TypeIcon = item.Icon;
                    const active = iconKind === item.kind;
                    return (
                      <button
                        type="button"
                        key={item.kind}
                        onClick={() => setIconKind(item.kind)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-[#261E0D] border-[#D4AF37]/60 text-[#F8E296]'
                            : 'bg-[#0E0D0A] border-white/[0.08] text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        <TypeIcon className="w-4 h-4 shrink-0 text-[#E7C45D]" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Liquid USDC Reserve, Validator Stake"
                  required
                  className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                    Current Allocated ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={currentUsd}
                    onChange={(e) => setCurrentUsd(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                    Target Amount ($)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={targetUsd}
                    onChange={(e) => setTargetUsd(e.target.value)}
                    placeholder="5000"
                    required
                    className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D1D5DB] mb-1.5">
                  Target Horizon
                </label>
                <input
                  type="text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="e.g. Q4 2026 or Ongoing"
                  className="w-full bg-[#0E0D0A] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-gold-primary px-5 py-2.5 rounded-full font-semibold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving Goal...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

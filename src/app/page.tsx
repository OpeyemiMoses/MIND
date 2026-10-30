'use client';

import React, { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { WalletModal } from '@/components/common/WalletModal';
import { AppSidebar, ScreenTab } from '@/components/common/AppSidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { LandingPage } from '@/components/landing/LandingPage';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { WalletIntelligenceView } from '@/components/wallet/WalletIntelligenceView';
import { AskMindView } from '@/components/assistant/AskMindView';
import { GoalsView } from '@/components/goals/GoalsView';
import { MemoryTimelineView } from '@/components/memories/MemoryTimelineView';
import { MemoryReplayView } from '@/components/replay/MemoryReplayView';
import { WalletOverview } from '@/lib/sui/types';
import { FinancialGoal, GoalIconKind } from '@/lib/goals/types';
import { WalrusMemory, MemoryCategory } from '@/lib/walrus/types';

const SIDEBAR_COLLAPSED_KEY = 'mind_sidebar_collapsed_v1';

function AppContent() {
  const { connected, address } = useWallet();
  const [currentView, setCurrentView] = useState<'landing' | ScreenTab>('landing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [walletData, setWalletData] = useState<WalletOverview | null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [memories, setMemories] = useState<WalrusMemory[]>([]);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Load 100% real Sui Mainnet data, wallet goals, and wallet memories strictly for the connected wallet
  useEffect(() => {
    if (!connected || !address) return;

    let cancelled = false;
    async function loadLiveWalletState(activeAddress: string) {
      try {
        const encoded = encodeURIComponent(activeAddress);
        const [walletRes, goalsRes, memoriesRes] = await Promise.all([
          fetch(`/api/sui/wallet?address=${encoded}`),
          fetch(`/api/goals?address=${encoded}`),
          fetch(`/api/walrus/memories?address=${encoded}`),
        ]);

        const [walletJson, goalsJson, memoriesJson] = await Promise.all([
          walletRes.json(),
          goalsRes.json(),
          memoriesRes.json(),
        ]);

        if (cancelled) return;

        if (walletJson?.success && walletJson?.data) {
          setWalletData(walletJson.data);
        } else {
          setWalletData(null);
        }

        setGoals(Array.isArray(goalsJson?.goals) ? goalsJson.goals : []);
        setMemories(Array.isArray(memoriesJson?.memories) ? memoriesJson.memories : []);
      } catch (err) {
        console.error('Failed to sync live wallet state:', err);
      } finally {
        if (!cancelled) setLoadedAddress(activeAddress);
      }
    }

    loadLiveWalletState(address);
    return () => {
      cancelled = true;
    };
  }, [connected, address]);

  const activeWalletData = connected && address && loadedAddress === address ? walletData : null;
  const activeGoals = connected && address && loadedAddress === address ? goals : [];
  const activeMemories = connected && address && loadedAddress === address ? memories : [];
  const isLoading = Boolean(connected && address && loadedAddress !== address);

  const handleAddGoal = async (payload: {
    title: string;
    currentUsd: number;
    targetUsd: number;
    category: string;
    iconKind: GoalIconKind;
    deadline: string;
  }) => {
    if (!address) return;
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, ...payload }),
      });
      const data = await res.json();
      if (data?.success && data?.goal) {
        setGoals((prev) => [data.goal, ...prev]);
        if (data?.memory) {
          setMemories((prev) => [data.memory, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to save financial goal:', err);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!address) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await fetch(
        `/api/goals?address=${encodeURIComponent(address)}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('Failed to delete financial goal:', err);
    }
  };

  const handleAddMemory = async (
    title: string,
    content: string,
    category: MemoryCategory
  ) => {
    if (!address) return;
    try {
      const res = await fetch('/api/walrus/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, title, content, category }),
      });
      const data = await res.json();
      if (data?.success && data?.memory) {
        setMemories((prev) => [data.memory, ...prev]);
      }
    } catch (err) {
      console.error('Failed to save wallet memory:', err);
    }
  };

  const handleUpdateMemory = async (
    id: string,
    title: string,
    content: string,
    category: MemoryCategory
  ) => {
    if (!address) return;
    try {
      const res = await fetch('/api/walrus/memories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, id, title, content, category }),
      });
      const data = await res.json();
      if (data?.success && data?.memory) {
        setMemories((prev) => [data.memory, ...prev.filter((m) => m.id !== id)]);
      }
    } catch (err) {
      console.error('Failed to update wallet memory:', err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!address) return;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(
        `/api/walrus/memories?address=${encodeURIComponent(address)}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('Failed to delete wallet memory:', err);
    }
  };

  const handleMemoryAutoSaved = (newMem: WalrusMemory) => {
    setMemories((prev) => [newMem, ...prev.filter((m) => m.id !== newMem.id)]);
  };

  const headerMeta: Record<Exclude<ScreenTab, 'dashboard'>, { title: string; subtitle: string }> = {
    wallet: {
      title: 'Wallet Intelligence',
      subtitle: 'Live Tatum Sui Mainnet balances, valuations, and verified transaction blocks.',
    },
    ask: {
      title: 'Ask Mind',
      subtitle:
        'Personalized financial intelligence grounded in your live Sui wallet and Walrus Memory.',
    },
    goals: {
      title: 'Financial Goals',
      subtitle: 'Define wallet-bound targets that guide Mind’s portfolio recommendations.',
    },
    memories: {
      title: 'Memory Timeline',
      subtitle: 'SEAL-encrypted Walrus memories, preferences, and outcomes scoped to this wallet.',
    },
    replay: {
      title: 'Memory Replay',
      subtitle: 'Controlled comparison of stateless chain analysis vs. Walrus memory-grounded intelligence.',
    },
  };

  // Landing Page does NOT include Connect Wallet or WalletModal
  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchApp={() => setCurrentView('dashboard')}
        onExploreFeatures={(tab) => setCurrentView(tab)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex text-[#F5F5F5] font-sans antialiased relative overflow-x-hidden">
      {/* Subtle Luxury Ambient Gold Glows Matching Landing Page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 right-1/4 w-[620px] h-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-[-180px] left-1/3 w-[560px] h-[380px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)]" />
      </div>

      {/* Collapsible Sidebar Navigation */}
      <AppSidebar
        currentTab={currentView}
        onTabChange={(tab) => setCurrentView(tab)}
        onGoToLanding={() => setCurrentView('landing')}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 relative z-10">
        <AppHeader
          isDashboard={currentView === 'dashboard'}
          title={currentView !== 'dashboard' ? headerMeta[currentView].title : undefined}
          subtitle={currentView !== 'dashboard' ? headerMeta[currentView].subtitle : undefined}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onGoToLanding={() => setCurrentView('landing')}
        />

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              walletData={activeWalletData}
              goals={activeGoals}
              memoriesCount={activeMemories.length}
              loading={isLoading}
              onNavigateTab={(tab) => setCurrentView(tab)}
            />
          )}

          {currentView === 'wallet' && (
            <WalletIntelligenceView
              walletData={activeWalletData}
              loading={isLoading}
            />
          )}

          {currentView === 'ask' && (
            <AskMindView
              key={address ?? 'disconnected'}
              currentAddress={address}
              onSelectMemoryTag={() => setCurrentView('memories')}
              onMemoryAutoSaved={handleMemoryAutoSaved}
              onSaveFeedbackMemory={handleAddMemory}
            />
          )}

          {currentView === 'goals' && (
            <GoalsView
              goals={activeGoals}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}

          {currentView === 'memories' && (
            <MemoryTimelineView
              memories={activeMemories}
              onAddMemory={handleAddMemory}
              onUpdateMemory={handleUpdateMemory}
              onDeleteMemory={handleDeleteMemory}
            />
          )}

          {currentView === 'replay' && (
            <MemoryReplayView key={address ?? 'disconnected'} />
          )}
        </main>
      </div>

      <WalletModal key={address ?? 'disconnected'} />
    </div>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

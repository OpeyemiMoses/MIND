'use client';

import React from 'react';
import {
  Home,
  Wallet,
  Sparkles,
  Target,
  History,
  RefreshCcw,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  X,
} from 'lucide-react';
import { MindLogo } from './MindLogo';
import { ThemeToggle } from './ThemeToggle';
import { useWallet } from '@/context/WalletContext';

export type ScreenTab = 'dashboard' | 'wallet' | 'ask' | 'goals' | 'memories' | 'replay';

interface AppSidebarProps {
  currentTab: ScreenTab;
  onTabChange: (tab: ScreenTab) => void;
  onGoToLanding: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onTabChange,
  onGoToLanding,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { connected, address, account, openWalletModal } = useWallet();

  const navItems = [
    { id: 'dashboard' as ScreenTab, label: 'Home', icon: Home },
    { id: 'wallet' as ScreenTab, label: 'Wallet', icon: Wallet },
    { id: 'ask' as ScreenTab, label: 'Insights', icon: Sparkles },
    { id: 'goals' as ScreenTab, label: 'Goals', icon: Target },
    { id: 'memories' as ScreenTab, label: 'Memory', icon: History },
    { id: 'replay' as ScreenTab, label: 'Replay', icon: RefreshCcw },
  ];

  const username = account?.username?.trim() || '';
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  const renderSidebarInner = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <div className="flex flex-col justify-between h-full p-4 select-none relative">
        <div>
          {/* Top Brand (Clicks to Landing Page) + Collapse Toggle */}
          <div
            className={`flex items-center mb-8 pt-1 ${
              isCompact ? 'justify-center' : 'justify-between px-2'
            }`}
          >
            <div
              onClick={onGoToLanding}
              title="Back to Mind Home"
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              <MindLogo size="md" showWordmark={!isCompact} />
            </div>

            {isMobileDrawer ? (
              <button
                onClick={onCloseMobile}
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-center text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            ) : !isCompact ? (
              <button
                onClick={onToggleCollapse}
                title="Collapse navigation"
                className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-[#1C1810] border border-white/[0.07] hover:border-[#D4AF37]/40 flex items-center justify-center text-[#8E939E] hover:text-[#E7C45D] transition-all cursor-pointer"
                aria-label="Collapse navigation"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {isCompact && (
            <div className="flex justify-center mb-5">
              <button
                onClick={onToggleCollapse}
                title="Expand navigation"
                className="w-10 h-9 rounded-xl bg-white/[0.03] hover:bg-[#1C1810] border border-white/[0.08] hover:border-[#D4AF37]/45 flex items-center justify-center text-[#8E939E] hover:text-[#E7C45D] transition-all cursor-pointer"
                aria-label="Expand navigation"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Primary Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => {
                      onTabChange(item.id);
                      if (isMobileDrawer) onCloseMobile();
                    }}
                    className={`w-full flex items-center rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer relative overflow-hidden ${
                      isCompact ? 'justify-center py-3 px-0' : 'gap-3.5 px-3.5 py-2.5'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-[#261F0E] to-[#141109] text-[#F8E296] border border-[#D4AF37]/45 shadow-[inset_0_1px_0_rgba(255,240,185,0.22),0_0_22px_rgba(212,175,55,0.14)]'
                        : 'text-[#8E939E] hover:text-[#F5F5F5] hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        isActive ? 'text-[#E7C45D]' : 'text-[#8E939E] group-hover:text-[#D1D5DB]'
                      }`}
                    />
                    {!isCompact && <span className="truncate">{item.label}</span>}
                  </button>

                  {isCompact && (
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#16140F] border border-[#D4AF37]/40 text-xs font-medium text-[#F8E296] whitespace-nowrap shadow-xl z-50">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Theme Toggle + User Profile Account Trigger */}
        <div className="pt-4 border-t border-white/[0.07]">
          <div className="mb-3 flex justify-center">
            <ThemeToggle
              variant={isCompact ? 'icon' : 'sidebar'}
              showLabel={!isCompact}
              className={isCompact ? 'mx-auto' : ''}
            />
          </div>

          <div className="relative group">
            <button
              onClick={() => {
                openWalletModal();
                if (isMobileDrawer) onCloseMobile();
              }}
              className={`w-full flex items-center rounded-2xl transition-all cursor-pointer border ${
                isCompact
                  ? 'justify-center p-2.5 bg-[#13110C] border-[#D4AF37]/30 hover:border-[#F5D76E]/60'
                  : 'gap-3 p-3 bg-gradient-to-br from-[#19160E] to-[#0E0E0E] border-[#D4AF37]/25 hover:border-[#F5D76E]/55 shadow-[inset_0_1px_0_rgba(255,240,185,0.15)]'
              }`}
            >
              {/* Profile Avatar / Icon */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2A220E] to-[#4A3B16] border border-[#E7C45D]/50 flex items-center justify-center font-sora font-bold text-xs text-[#F8E296]">
                  {connected && username ? (
                    username.charAt(0).toUpperCase()
                  ) : (
                    <User className="w-4 h-4 text-[#E7C45D]" />
                  )}
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ring-2 ring-[#0C0C0C] absolute -bottom-0.5 -right-0.5 ${
                    connected ? 'bg-[#2CCD9A]' : 'bg-[#6B7280]'
                  }`}
                />
              </div>

              {!isCompact && (
                <div className="min-w-0 text-left flex-1">
                  <p className="text-xs font-semibold text-white font-sora truncate">
                    {connected ? username || 'Set Username' : 'Account Profile'}
                  </p>
                  <p className="text-[11px] text-[#8E939E] font-mono truncate">
                    {connected ? shortAddr : 'Connect Sui Wallet'}
                  </p>
                </div>
              )}
            </button>

            {isCompact && (
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#16140F] border border-[#D4AF37]/40 text-xs font-medium text-[#F8E296] whitespace-nowrap shadow-xl z-50">
                {connected ? `${username || 'Profile'} (${shortAddr})` : 'Connect Wallet / Profile'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col border-r border-white/[0.07] bg-[#0A0A0A] min-h-screen shrink-0 sticky top-0 h-screen z-30 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? 'w-[82px]' : 'w-64'
        }`}
      >
        {renderSidebarInner(false)}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#0B0B0B] border-r border-[#D4AF37]/25 h-full z-10 shadow-2xl">
            {renderSidebarInner(true)}
          </aside>
        </div>
      )}
    </>
  );
};

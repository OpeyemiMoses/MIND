'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Menu, Sun, Sunrise, Moon } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { getTimeGreeting, TimeGreeting } from '@/lib/accounts/types';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  isDashboard?: boolean;
  title?: string;
  subtitle?: string;
  onOpenMobileNav?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isDashboard = false,
  title,
  subtitle,
  onOpenMobileNav,
}) => {
  const { connected, address, account, openWalletModal } = useWallet();
  const [greeting, setGreeting] = useState<TimeGreeting>(() => getTimeGreeting());

  useEffect(() => {
    const timer = setInterval(() => setGreeting(getTimeGreeting()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const chosenUsername = account?.username?.trim() || '';
  const dashboardHeadline = chosenUsername
    ? `${greeting.salutation}, ${chosenUsername}`
    : greeting.salutation;

  const dashboardSub = connected
    ? 'Live Sui Mainnet intelligence synced to your personal account.'
    : 'Connect your Sui wallet to load live Sui Mainnet balances and your personal account.';

  const GreetingIcon =
    greeting.period === 'morning'
      ? Sunrise
      : greeting.period === 'afternoon'
      ? Sun
      : Moon;

  return (
    <header className="h-20 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl px-5 sm:px-8 flex items-center justify-between sticky top-0 z-20 gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[#D1D5DB] hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="min-w-0">
          {isDashboard ? (
            <div>
              <h1 className="text-lg sm:text-xl font-sora font-semibold text-white tracking-tight flex items-center gap-2.5 truncate">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#231D10] to-[#110F0A] border border-[#D4AF37]/40 flex items-center justify-center text-[#E7C45D] shrink-0">
                  <GreetingIcon className="w-4 h-4" />
                </span>
                <span className="truncate">{dashboardHeadline}</span>
              </h1>
              <p className="text-xs text-[#8E939E] mt-0.5 truncate">{dashboardSub}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-lg sm:text-xl font-sora font-semibold text-white tracking-tight truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-[#8E939E] mt-0.5 truncate">{subtitle}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle variant="icon" />

        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#11100D] border border-[#D4AF37]/20 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#2CCD9A]" />
          <span className="text-[#8E939E]">Sui Mainnet</span>
        </div>

        {connected && truncatedAddress ? (
          <button
            onClick={openWalletModal}
            className="btn-gold-secondary flex items-center gap-2 px-4 py-2 rounded-full text-xs text-[#F5E6B8] font-mono cursor-pointer"
            title="Manage Sui wallet & account"
          >
            <Wallet className="w-3.5 h-3.5 text-[#E7C45D]" />
            <span>{truncatedAddress}</span>
            <span className="w-2 h-2 rounded-full bg-[#2CCD9A]" />
          </button>
        ) : (
          <button
            onClick={openWalletModal}
            className="btn-gold-primary flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  Shield,
  ExternalLink,
  ArrowRight,
  Sparkles,
  User,
  Check,
  Pencil,
  LogOut,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { getTimeGreeting } from '@/lib/accounts/types';
import { SuiWalletInfo } from '@/lib/wallet/suiWallet';
import { MindLogo } from './MindLogo';

export const WalletModal: React.FC = () => {
  const {
    isModalOpen,
    closeWalletModal,
    installedWallets,
    walletsScanned,
    refreshWallets,
    connectWallet,
    saveUsername,
    connected,
    address,
    walletName,
    account,
    needsUsernameSetup,
    disconnect,
    connecting,
  } = useWallet();

  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const usernameInput = usernameDraft ?? (account?.username || '');
  const shouldDisplay = isModalOpen || (connected && needsUsernameSetup);

  useEffect(() => {
    if (!shouldDisplay) return;
    const t = setTimeout(() => refreshWallets(), 0);
    return () => clearTimeout(t);
  }, [shouldDisplay, refreshWallets]);

  if (!shouldDisplay) return null;

  const greeting = getTimeGreeting().salutation;
  const previewName = usernameInput.trim() || 'your username';

  const handleExtensionConnect = async (w: SuiWalletInfo) => {
    setErrorMsg('');
    try {
      await connectWallet(w);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : `Could not connect to ${w.name}`);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = usernameInput.trim();
    if (cleaned.length < 2) {
      setErrorMsg('Please enter at least 2 characters for your username.');
      return;
    }
    if (cleaned.length > 32) {
      setErrorMsg('Username must be 32 characters or fewer.');
      return;
    }
    setErrorMsg('');
    setSavingName(true);
    try {
      await saveUsername(cleaned);
      setUsernameDraft(null);
      setIsEditingUsername(false);
      if (needsUsernameSetup) {
        closeWalletModal();
      }
    } finally {
      setSavingName(false);
    }
  };

  const formattedCreatedDate = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Today';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="gold-glass-plaque rounded-3xl max-w-md w-full p-6 sm:p-7 text-left space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FFF0B3]/80 to-transparent" />
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-[radial-gradient(circle,rgba(212,175,55,0.16)_0%,transparent_70%)] blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <MindLogo size="sm" framed showWordmark={false} />
            <div>
              <h3 className="text-base font-semibold text-white font-sora tracking-tight">
                {connected && needsUsernameSetup
                  ? 'Set Up Your Mind Account'
                  : connected
                  ? 'Your Mind Account'
                  : 'Connect Sui Wallet'}
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                {connected && needsUsernameSetup
                  ? 'Permanent account bound to your Sui wallet'
                  : 'Sui Network • Real Browser Wallet Detection'}
              </p>
            </div>
          </div>

          {!(connected && needsUsernameSetup) && (
            <button
              onClick={closeWalletModal}
              className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-center text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* STATE 1: FIRST-TIME WALLET SIGN-IN -> PICK USERNAME */}
        {connected && address && needsUsernameSetup ? (
          <form onSubmit={handleUsernameSubmit} className="space-y-5 relative z-10">
            <div className="p-3.5 rounded-2xl bg-[#14120C] border border-[#D4AF37]/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#E7C45D] block">
                  New Wallet Account Created
                </span>
                <p className="font-mono text-xs text-[#F5F5F5] truncate mt-0.5">{address}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#2CCD9A]/15 border border-[#2CCD9A]/30 text-[10px] font-semibold text-[#2CCD9A] shrink-0">
                Linked
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#E5E7EB] block">
                Choose your username
              </label>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                Saved permanently to this wallet&apos;s Mind account and recalled automatically whenever this wallet connects.
              </p>
              <div className="relative pt-1">
                <User className="w-4 h-4 text-[#E7C45D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  maxLength={32}
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameDraft(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter your preferred name..."
                  className="w-full bg-[#0D0D0D] border border-white/[0.12] focus:border-[#E7C45D] rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none transition-colors"
                />
              </div>
              {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#E7C45D] shrink-0" />
              <div className="text-xs text-[#9CA3AF] truncate">
                Greeting preview:{' '}
                <span className="text-white font-semibold font-sora">
                  {greeting}, {previewName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={disconnect}
                className="px-4 py-3 rounded-full border border-white/[0.1] hover:border-white/[0.22] text-xs font-medium text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
              >
                Disconnect
              </button>
              <button
                type="submit"
                disabled={savingName || usernameInput.trim().length < 2}
                className="btn-gold-primary flex-1 py-3 px-6 rounded-full font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
              >
                <span>{savingName ? 'Saving...' : 'Complete Setup'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : connected && address ? (
          /* STATE 2: ACTIVE CONNECTED ACCOUNT */
          <div className="space-y-4 relative z-10">
            <div className="p-4 rounded-2xl bg-[#13120E] border border-[#D4AF37]/30 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2B230F] to-[#4A3B16] border border-[#E7C45D]/50 flex items-center justify-center font-sora font-bold text-base text-[#F8E296] shrink-0">
                    {(account?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white font-sora truncate">
                      {account?.username || 'Unnamed Account'}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {walletName || 'Sui Wallet'} • Joined {formattedCreatedDate}
                    </p>
                  </div>
                </div>

                {!isEditingUsername && (
                  <button
                    onClick={() => {
                      setUsernameDraft(account?.username || '');
                      setIsEditingUsername(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-[11px] text-[#E7C45D] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {isEditingUsername && (
                <form
                  onSubmit={handleUsernameSubmit}
                  className="pt-2 border-t border-white/[0.08] space-y-2.5"
                >
                  <label className="text-[11px] font-medium text-[#D1D5DB] block">
                    Update username for this wallet
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      maxLength={32}
                      value={usernameInput}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      className="flex-1 bg-[#0B0B0B] border border-[#D4AF37]/45 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={savingName || usernameInput.trim().length < 2}
                      className="btn-gold-primary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                  {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}
                </form>
              )}

              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#6B7280]">
                  <span>Connected Sui Wallet</span>
                  <span className="text-[#2CCD9A] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2CCD9A]" />
                    Active
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#E7C45D] break-all bg-black/50 p-2.5 rounded-xl border border-white/[0.06]">
                  {address}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => disconnect()}
                className="flex-1 py-2.5 px-4 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
              <button
                onClick={closeWalletModal}
                className="btn-gold-primary flex-1 py-2.5 px-4 rounded-full font-semibold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* STATE 3: DISCONNECTED -> STRICT REAL SUI BROWSER WALLET DETECTION ONLY */
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.14em] font-mono">
                {!walletsScanned
                  ? 'Scanning Browser Extensions...'
                  : installedWallets.length > 0
                  ? `Detected Sui Wallets (${installedWallets.length})`
                  : 'No Sui Wallet Detected'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  refreshWallets();
                }}
                className="text-[11px] text-[#E7C45D] hover:text-[#FFF0B3] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Scan Again</span>
              </button>
            </div>

            {installedWallets.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {installedWallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => void handleExtensionConnect(w)}
                    disabled={connecting}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-[#1B1810] border border-white/[0.08] hover:border-[#D4AF37]/50 transition-all text-left group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      {w.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.icon}
                          alt={w.name}
                          className="w-8 h-8 rounded-xl object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-[#231D10] border border-[#D4AF37]/40 flex items-center justify-center text-[#E7C45D]">
                          <Wallet className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-[#F8E296]">
                          {w.name}
                        </p>
                        <p className="text-[10px] text-[#2CCD9A] font-mono">
                          Installed in browser • Click to connect
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#E7C45D] group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[#13110B] border border-[#D4AF37]/30 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#241C0C] border border-[#D4AF37]/40 text-[#E7C45D] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white font-sora">
                      No Sui Wallet Extension Detected
                    </h4>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">
                      Mind did not find an installed Sui wallet in this browser. Install an official Sui wallet extension below, unlock it, and click{' '}
                      <strong className="text-[#F8E296]">Scan Again</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <a
                    href="https://slush.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gold-secondary px-3.5 py-2.5 rounded-xl text-xs text-[#F8E296] font-medium flex items-center justify-between"
                  >
                    <span>Get Slush (Sui Wallet)</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                  <a
                    href="https://suiet.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-gold-secondary px-3.5 py-2.5 rounded-xl text-xs text-[#F8E296] font-medium flex items-center justify-between"
                  >
                    <span>Get Suiet Wallet</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-[#6B7280] relative z-10">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#2CCD9A]" />
            Non-custodial • Wallet Standard
          </span>
          <span className="font-mono text-[#E7C45D]">Sui Mainnet</span>
        </div>
      </div>
    </div>
  );
};

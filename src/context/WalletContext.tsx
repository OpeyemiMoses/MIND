'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getInstalledSuiWallets,
  subscribeToSuiWallets,
  connectStandardWallet,
  subscribeWalletAccountChanges,
  pickSuiAccount,
  SuiWalletInfo,
} from '@/lib/wallet/suiWallet';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { MindAccount, normalizeWalletAddress } from '@/lib/accounts/types';

export interface WalletContextType {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  walletName: string | null;
  account: MindAccount | null;
  needsUsernameSetup: boolean;
  installedWallets: SuiWalletInfo[];
  walletsScanned: boolean;
  refreshWallets: () => void;
  connectWallet: (walletInfo: SuiWalletInfo) => Promise<void>;
  saveUsername: (username: string) => Promise<void>;
  disconnect: () => void;
  isModalOpen: boolean;
  openWalletModal: () => void;
  closeWalletModal: () => void;
}

const STORAGE_ACTIVE_ADDR = 'mind_active_sui_wallet_v4';
const STORAGE_ACTIVE_PROVIDER = 'mind_active_sui_provider_v4';
const STORAGE_ACCOUNTS_CACHE = 'mind_wallet_accounts_v3';

function readCachedAccounts(): Record<string, MindAccount> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS_CACHE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCachedAccount(acc: MindAccount) {
  if (typeof window === 'undefined') return;
  try {
    const all = readCachedAccounts();
    all[normalizeWalletAddress(acc.address)] = acc;
    localStorage.setItem(STORAGE_ACCOUNTS_CACHE, JSON.stringify(all));
  } catch {
    // Ignore storage quota issues
  }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [account, setAccount] = useState<MindAccount | null>(null);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState<boolean>(false);
  const [installedWallets, setInstalledWallets] = useState<SuiWalletInfo[]>([]);
  const [walletsScanned, setWalletsScanned] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const walletEventsUnsubRef = useRef<(() => void) | null>(null);
  const autoReconnectAttemptedRef = useRef<boolean>(false);

  const refreshWallets = useCallback(() => {
    if (typeof window === 'undefined') return;
    setInstalledWallets(getInstalledSuiWallets());
    setWalletsScanned(true);
  }, []);

  const syncWalletAccount = useCallback(
    async (rawAddr: string, providerLabel: string, openIfNew: boolean) => {
      const key = normalizeWalletAddress(rawAddr);
      const cached = readCachedAccounts()[key] || null;

      if (cached) {
        setAccount(cached);
        const missingName = !cached.onboardingCompleted || !cached.username.trim();
        setNeedsUsernameSetup(missingName);
        if (missingName && openIfNew) {
          setIsModalOpen(true);
        }
      }

      try {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: rawAddr, walletProvider: providerLabel }),
        });
        const data = await res.json();

        if (data?.success && data?.account) {
          let resolvedAccount: MindAccount = data.account;

          if (
            (!resolvedAccount.onboardingCompleted || !resolvedAccount.username.trim()) &&
            cached?.onboardingCompleted &&
            cached.username.trim()
          ) {
            const patchRes = await fetch('/api/accounts', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: rawAddr, username: cached.username }),
            });
            const patchData = await patchRes.json();
            if (patchData?.success && patchData?.account) {
              resolvedAccount = patchData.account;
            }
          }

          writeCachedAccount(resolvedAccount);
          setAccount(resolvedAccount);

          const requiresSetup =
            !resolvedAccount.onboardingCompleted || !resolvedAccount.username.trim();
          setNeedsUsernameSetup(requiresSetup);
          if (requiresSetup && openIfNew) {
            setIsModalOpen(true);
          } else if (!requiresSetup && openIfNew) {
            setIsModalOpen(false);
          }
        }
      } catch (err) {
        console.error('Failed to sync wallet account:', err);
        if (!cached) {
          const fallback: MindAccount = {
            address: key,
            displayAddress: rawAddr,
            username: '',
            walletProvider: providerLabel,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            onboardingCompleted: false,
          };
          writeCachedAccount(fallback);
          setAccount(fallback);
          setNeedsUsernameSetup(true);
          if (openIfNew) setIsModalOpen(true);
        }
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    if (walletEventsUnsubRef.current) {
      walletEventsUnsubRef.current();
      walletEventsUnsubRef.current = null;
    }
    setAddress(null);
    setConnected(false);
    setWalletName(null);
    setAccount(null);
    setNeedsUsernameSetup(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_ACTIVE_ADDR);
      localStorage.removeItem(STORAGE_ACTIVE_PROVIDER);
      // Clean legacy v3 keys so ghost wallets never reappear
      localStorage.removeItem('mind_active_wallet_v3');
      localStorage.removeItem('mind_active_wallet_provider_v3');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Purge any legacy v3 manual/ghost session keys
      localStorage.removeItem('mind_active_wallet_v3');
      localStorage.removeItem('mind_active_wallet_provider_v3');
    }

    const scanDoneTimer = setTimeout(() => {
      setWalletsScanned(true);
    }, 450);

    const unsubscribe = subscribeToSuiWallets((detected) => {
      setInstalledWallets(detected);

      // Only restore a saved session if the actual Sui wallet extension is installed
      // AND currently exposes the authorized Sui account in the browser!
      if (!autoReconnectAttemptedRef.current && detected.length > 0 && typeof window !== 'undefined') {
        const savedAddr = localStorage.getItem(STORAGE_ACTIVE_ADDR);
        const savedProvider = localStorage.getItem(STORAGE_ACTIVE_PROVIDER);
        if (savedAddr && savedProvider) {
          const matchedWallet = detected.find((w) => w.name === savedProvider);
          if (matchedWallet) {
            const activeAcc = pickSuiAccount(matchedWallet.wallet.accounts);
            if (activeAcc && normalizeSuiAddress(activeAcc.address) === normalizeSuiAddress(savedAddr)) {
              autoReconnectAttemptedRef.current = true;
              const normalized = normalizeSuiAddress(activeAcc.address);
              setAddress(normalized);
              setConnected(true);
              setWalletName(matchedWallet.name);
              void syncWalletAccount(normalized, matchedWallet.name, false);

              if (walletEventsUnsubRef.current) walletEventsUnsubRef.current();
              walletEventsUnsubRef.current = subscribeWalletAccountChanges(
                matchedWallet.wallet,
                (nextAddr) => {
                  if (!nextAddr) {
                    disconnect();
                  } else {
                    setAddress(nextAddr);
                    setConnected(true);
                    localStorage.setItem(STORAGE_ACTIVE_ADDR, nextAddr);
                    void syncWalletAccount(nextAddr, matchedWallet.name, true);
                  }
                }
              );
            }
          }
        }
      }
    });

    // After extensions finish injecting (~1.5s), if no Sui wallet was detected at all,
    // clear any stale saved session so we never pretend a missing wallet is connected.
    const verifyTimer = setTimeout(() => {
      const currentDetected = getInstalledSuiWallets();
      if (currentDetected.length === 0 && typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_ACTIVE_ADDR);
        localStorage.removeItem(STORAGE_ACTIVE_PROVIDER);
      }
    }, 1500);

    return () => {
      unsubscribe();
      clearTimeout(scanDoneTimer);
      clearTimeout(verifyTimer);
      if (walletEventsUnsubRef.current) {
        walletEventsUnsubRef.current();
      }
    };
  }, [syncWalletAccount, disconnect]);

  const connectWallet = async (walletInfo: SuiWalletInfo) => {
    setConnecting(true);
    try {
      const realAddress = await connectStandardWallet(walletInfo.wallet);

      if (walletEventsUnsubRef.current) {
        walletEventsUnsubRef.current();
      }
      walletEventsUnsubRef.current = subscribeWalletAccountChanges(
        walletInfo.wallet,
        (nextAddr) => {
          if (!nextAddr) {
            disconnect();
          } else {
            setAddress(nextAddr);
            setConnected(true);
            localStorage.setItem(STORAGE_ACTIVE_ADDR, nextAddr);
            void syncWalletAccount(nextAddr, walletInfo.name, true);
          }
        }
      );

      setAddress(realAddress);
      setConnected(true);
      setWalletName(walletInfo.name);
      localStorage.setItem(STORAGE_ACTIVE_ADDR, realAddress);
      localStorage.setItem(STORAGE_ACTIVE_PROVIDER, walletInfo.name);
      await syncWalletAccount(realAddress, walletInfo.name, true);
    } catch (err: unknown) {
      console.error('Wallet connection failed:', err);
      const message = err instanceof Error ? err.message : 'Connection rejected';
      throw new Error(message);
    } finally {
      setConnecting(false);
    }
  };

  const saveUsername = async (rawUsername: string) => {
    const trimmed = rawUsername.trim();
    if (!address || trimmed.length < 2) return;

    const now = new Date().toISOString();
    const optimistic: MindAccount = {
      address: normalizeWalletAddress(address),
      displayAddress: address,
      username: trimmed,
      walletProvider: walletName || 'Sui Wallet',
      createdAt: account?.createdAt || now,
      lastLoginAt: now,
      onboardingCompleted: true,
    };

    setAccount(optimistic);
    setNeedsUsernameSetup(false);
    writeCachedAccount(optimistic);

    try {
      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, username: trimmed }),
      });
      const data = await res.json();
      if (data?.success && data?.account) {
        setAccount(data.account);
        writeCachedAccount(data.account);
      }
    } catch (err) {
      console.error('Failed to persist username:', err);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        connecting,
        walletName,
        account,
        needsUsernameSetup,
        installedWallets,
        walletsScanned,
        refreshWallets,
        connectWallet,
        saveUsername,
        disconnect,
        isModalOpen,
        openWalletModal: () => {
          refreshWallets();
          setIsModalOpen(true);
        },
        closeWalletModal: () => setIsModalOpen(false),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

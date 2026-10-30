import { getWallets } from '@wallet-standard/app';
import { isSuiChain } from '@mysten/wallet-standard';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import type { Wallet as StandardWallet, WalletAccount } from '@wallet-standard/base';

export interface SuiWalletInfo {
  id: string;
  name: string;
  icon?: string;
  wallet: StandardWallet;
}

const SUI_SIGNING_FEATURES = [
  'sui:signTransaction',
  'sui:signTransactionBlock',
  'sui:signPersonalMessage',
  'sui:signAndExecuteTransaction',
  'sui:signAndExecuteTransactionBlock',
];

export function isGenuineSuiAddress(raw: string | undefined | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  // Explicitly reject 20-byte Ethereum/EVM addresses (0x + 40 hex chars)
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return false;
  // Require 0x prefix + 60..64 hex chars (standard 32-byte Sui address)
  if (!/^0x[0-9a-fA-F]{60,64}$/.test(trimmed)) return false;
  try {
    const normalized = normalizeSuiAddress(trimmed);
    return isValidSuiAddress(normalized);
  } catch {
    return false;
  }
}

function isSuiCompatibleWallet(wallet: StandardWallet): boolean {
  if (!wallet || !wallet.features) return false;

  const hasConnect = 'standard:connect' in wallet.features;
  if (!hasConnect) return false;

  const featureKeys = Object.keys(wallet.features);
  const hasSuiSigningFeature = SUI_SIGNING_FEATURES.some((feat) =>
    featureKeys.includes(feat)
  );
  if (!hasSuiSigningFeature) return false;

  const supportsSuiChain =
    Array.isArray(wallet.chains) &&
    wallet.chains.some(
      (chain) => isSuiChain(chain) || String(chain).toLowerCase().startsWith('sui:')
    );

  return supportsSuiChain;
}

export function getInstalledSuiWallets(): SuiWalletInfo[] {
  if (typeof window === 'undefined') return [];

  try {
    const walletsApi = getWallets();
    const registered = walletsApi.get();
    const seen = new Set<string>();
    const results: SuiWalletInfo[] = [];

    for (const w of registered) {
      if (!isSuiCompatibleWallet(w)) continue;
      const uniqueKey = (w as { id?: string }).id || w.name;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      results.push({
        id: uniqueKey,
        name: w.name,
        icon: w.icon,
        wallet: w,
      });
    }

    // Prioritize dedicated Sui wallets (Slush, Sui Wallet, Suiet, Nightly)
    results.sort((a, b) => {
      const score = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('slush') || n === 'sui wallet') return 0;
        if (n.includes('suiet') || n.includes('sui')) return 1;
        if (n.includes('nightly') || n.includes('surf')) return 2;
        return 3;
      };
      return score(a.name) - score(b.name);
    });

    return results;
  } catch (err) {
    console.warn('Error reading installed Wallet Standard extensions:', err);
    return [];
  }
}

export function subscribeToSuiWallets(onUpdate: (wallets: SuiWalletInfo[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const emit = () => onUpdate(getInstalledSuiWallets());

  try {
    const walletsApi = getWallets();
    const offRegister = walletsApi.on('register', emit);
    const offUnregister = walletsApi.on('unregister', emit);

    const timers = [100, 350, 900, 2000].map((ms) => window.setTimeout(emit, ms));
    const onFocus = () => emit();
    window.addEventListener('focus', onFocus);

    emit();

    return () => {
      offRegister();
      offUnregister();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('focus', onFocus);
    };
  } catch {
    return () => {};
  }
}

export function pickSuiAccount(accounts: readonly WalletAccount[] | undefined): WalletAccount | null {
  if (!accounts || accounts.length === 0) return null;

  // 1. Account explicitly tagged with a sui:* chain AND valid 32-byte Sui address
  const suiTagged = accounts.find(
    (acc) =>
      Array.isArray(acc.chains) &&
      acc.chains.some((c) => isSuiChain(c) || String(c).toLowerCase().startsWith('sui:')) &&
      isGenuineSuiAddress(acc.address)
  );
  if (suiTagged) return suiTagged;

  // 2. Sui-only wallets that omit per-account chains array but expose a valid 32-byte Sui address
  const validSuiAddrAccount = accounts.find(
    (acc) =>
      (!acc.chains || acc.chains.length === 0) && isGenuineSuiAddress(acc.address)
  );
  if (validSuiAddrAccount) return validSuiAddrAccount;

  return null;
}

export async function connectStandardWallet(wallet: StandardWallet): Promise<string> {
  const connectFeature = wallet.features['standard:connect'] as
    | { connect: () => Promise<{ accounts?: readonly WalletAccount[] }> }
    | undefined;

  if (!connectFeature || typeof connectFeature.connect !== 'function') {
    throw new Error(`${wallet.name} does not support Sui Wallet Standard connection.`);
  }

  const result = await connectFeature.connect();
  const candidateAccounts =
    result?.accounts && result.accounts.length > 0 ? result.accounts : wallet.accounts;

  const chosen = pickSuiAccount(candidateAccounts);
  if (!chosen || !chosen.address) {
    throw new Error(
      `No active Sui account was detected in ${wallet.name}. Unlock your wallet and ensure a Sui Mainnet account is enabled.`
    );
  }

  return normalizeSuiAddress(chosen.address);
}

export function subscribeWalletAccountChanges(
  wallet: StandardWallet,
  onAddressChange: (newAddress: string | null) => void
): () => void {
  const eventsFeature = wallet.features['standard:events'] as
    | {
        on: (
          event: 'change',
          cb: (props: { accounts?: readonly WalletAccount[] }) => void
        ) => () => void;
      }
    | undefined;

  if (!eventsFeature || typeof eventsFeature.on !== 'function') {
    return () => {};
  }

  try {
    return eventsFeature.on('change', ({ accounts }) => {
      if (!accounts) return;
      if (accounts.length === 0) {
        onAddressChange(null);
        return;
      }
      const nextAcc = pickSuiAccount(accounts);
      onAddressChange(nextAcc?.address ? normalizeSuiAddress(nextAcc.address) : null);
    });
  } catch {
    return () => {};
  }
}

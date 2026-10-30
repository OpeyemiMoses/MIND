export interface MindAccount {
  /** Normalized lowercase Sui address (unique 1:1 primary key per wallet) */
  address: string;
  /** Original formatted address as connected */
  displayAddress: string;
  /** User-chosen display name associated permanently with this wallet */
  username: string;
  /** Name of the wallet extension or explorer mode used */
  walletProvider: string;
  /** ISO timestamp when this wallet account was first created */
  createdAt: string;
  /** ISO timestamp of the latest sign-in */
  lastLoginAt: string;
  /** True once the user has chosen & confirmed their username */
  onboardingCompleted: boolean;
}

export type TimePeriod = 'morning' | 'afternoon' | 'evening';

export interface TimeGreeting {
  period: TimePeriod;
  salutation: 'Good Morning' | 'Good Afternoon' | 'Good Evening';
}

export function getTimeGreeting(date: Date = new Date()): TimeGreeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return { period: 'morning', salutation: 'Good Morning' };
  }
  if (hour >= 12 && hour < 17) {
    return { period: 'afternoon', salutation: 'Good Afternoon' };
  }
  return { period: 'evening', salutation: 'Good Evening' };
}

export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}


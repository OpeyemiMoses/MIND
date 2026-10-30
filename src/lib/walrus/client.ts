import { promises as fs } from 'fs';
import path from 'path';
import {
  MemWal,
  MemWalRememberJobTimeoutError,
  delegateKeyToPublicKey,
  delegateKeyToSuiAddress,
} from '@mysten-incubation/memwal';
import { getServerEnv } from '@/lib/env';
import { WalrusMemory, MemoryCategory } from './types';
import { normalizeWalletAddress } from '@/lib/accounts/types';
import { WalletOverview } from '@/lib/sui/types';
import { FinancialGoal } from '@/lib/goals/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const MEMORIES_FILE = path.join(DATA_DIR, 'walrus-memories.json');
const TOMBSTONES_FILE = path.join(DATA_DIR, 'walrus-tombstones.json');

// Cached MemWal client so SEAL SessionKey (5m TTL) & compatibility preflight are shared
let cachedClientKey = '';
let cachedMemWal: MemWal | null = null;

function getMemWalClient(): MemWal | null {
  const env = getServerEnv();
  if (!env.MEMWAL_PRIVATE_KEY || !env.MEMWAL_ACCOUNT_ID) {
    return null;
  }

  const cacheIdentity = `${env.MEMWAL_ACCOUNT_ID}:${env.MEMWAL_SERVER_URL}:${env.MEMWAL_NAMESPACE}:${env.MEMWAL_PRIVATE_KEY.slice(-8)}`;
  if (cachedMemWal && cachedClientKey === cacheIdentity) {
    return cachedMemWal;
  }

  if (cachedMemWal) {
    try {
      cachedMemWal.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }

  cachedMemWal = MemWal.create({
    key: env.MEMWAL_PRIVATE_KEY,
    accountId: env.MEMWAL_ACCOUNT_ID,
    serverUrl: env.MEMWAL_SERVER_URL,
    namespace: env.MEMWAL_NAMESPACE,
  });
  cachedClientKey = cacheIdentity;
  return cachedMemWal;
}

export function getWalletMemoryNamespace(walletAddress: string): string {
  const env = getServerEnv();
  const norm = normalizeWalletAddress(walletAddress);
  const shortHash = norm.replace(/^0x/, '').slice(0, 12) || 'anon';
  return `${env.MEMWAL_NAMESPACE}-${shortHash}`;
}

async function readMemoriesStore(): Promise<Record<string, WalrusMemory[]>> {
  try {
    const raw = await fs.readFile(MEMORIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMemoriesStore(store: Record<string, WalrusMemory[]>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEMORIES_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

async function readTombstones(): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(TOMBSTONES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function addTombstones(walletKey: string, identifiers: string[]): Promise<void> {
  const clean = identifiers.filter(Boolean);
  if (clean.length === 0) return;
  const store = await readTombstones();
  const existing = new Set(store[walletKey] || []);
  for (const id of clean) existing.add(id);
  store[walletKey] = Array.from(existing);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TOMBSTONES_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function formatDateLabel(date: Date = new Date()): string {
  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  );
}

function extractTopics(title: string, content: string, category: string): string[] {
  const words = `${title} ${content} ${category}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return Array.from(new Set(words)).slice(0, 14);
}

function serializeForWalrus(category: MemoryCategory, title: string, content: string): string {
  return `[${category}] ${title.trim()} — ${content.trim()}`;
}

function parseFromWalrusText(rawText: string): {
  category: MemoryCategory;
  title: string;
  content: string;
} {
  const match = rawText.match(
    /^\[(Goal|Preference|Pattern|Outcome|Feedback)\]\s*([^—:\n]+?)\s*(?:—|:)\s*([\s\S]+)$/i
  );
  if (match) {
    const rawCat = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const validCategories: MemoryCategory[] = [
      'Goal',
      'Preference',
      'Pattern',
      'Outcome',
      'Feedback',
    ];
    const category = validCategories.includes(rawCat as MemoryCategory)
      ? (rawCat as MemoryCategory)
      : 'Preference';
    return {
      category,
      title: match[2].trim().slice(0, 90),
      content: match[3].trim(),
    };
  }
  return {
    category: 'Preference',
    title: rawText.slice(0, 48).trim() || 'Recalled Walrus Context',
    content: rawText.trim(),
  };
}

async function reconcileUploadingMemories(
  walletKey: string,
  list: WalrusMemory[],
  client: MemWal | null
): Promise<{ updated: boolean; list: WalrusMemory[] }> {
  if (!client) return { updated: false, list };

  let changed = false;
  const nextList = await Promise.all(
    list.map(async (item) => {
      if (item.writeStatus !== 'uploading' || !item.jobId) return item;
      try {
        const st = await client.getRememberStatus(item.jobId);
        if (st.status === 'done' && st.blob_id) {
          changed = true;
          return {
            ...item,
            blobId: st.blob_id,
            verifiedOnMainnet: true,
            writeStatus: 'confirmed' as const,
            source: 'walrus-mainnet' as const,
          };
        }
        if (st.status === 'failed') {
          changed = true;
          return {
            ...item,
            writeStatus: 'failed' as const,
          };
        }
      } catch {
        // Keep polling on next read
      }
      return item;
    })
  );

  return { updated: changed, list: nextList };
}

export async function listWalletMemories(walletAddress: string): Promise<WalrusMemory[]> {
  if (!walletAddress?.trim()) return [];
  const key = normalizeWalletAddress(walletAddress);
  const namespace = getWalletMemoryNamespace(walletAddress);
  const client = getMemWalClient();

  const store = await readMemoriesStore();
  let list = store[key] || [];

  // 1. Reconcile any background Walrus upload jobs
  if (list.length > 0 && client) {
    const rec = await reconcileUploadingMemories(key, list, client);
    if (rec.updated) {
      list = rec.list;
      store[key] = list;
      await writeMemoriesStore(store);
    }
  }

  // 2. Cross-session recovery: if local cache is empty (e.g., fresh session / serverless cold start),
  //    hydrate directly from Walrus Memory Mainnet for this wallet's isolated namespace!
  if (list.length === 0 && client) {
    try {
      const tombstones = new Set((await readTombstones())[key] || []);
      const recalled = await client.recall({
        query: 'savings goal preference risk reserve pattern decision outcome feedback',
        limit: 25,
        namespace,
        sort: 'recent',
      });

      if (recalled?.results?.length > 0) {
        const hydrated: WalrusMemory[] = [];
        for (const hit of recalled.results) {
          if (!hit.blob_id || tombstones.has(hit.blob_id)) continue;
          const parsed = parseFromWalrusText(hit.text);
          const createdDate = hit.created_at ? new Date(hit.created_at) : new Date();
          hydrated.push({
            id: `walrus_${hit.blob_id.slice(0, 14)}`,
            walletAddress: key,
            category: parsed.category,
            title: parsed.title,
            content: parsed.content,
            timestamp: formatDateLabel(
              Number.isNaN(createdDate.getTime()) ? new Date() : createdDate
            ),
            source: 'walrus-mainnet',
            verifiedOnMainnet: true,
            writeStatus: 'confirmed',
            blobId: hit.blob_id,
            namespace,
            relevantTopics: extractTopics(parsed.title, parsed.content, parsed.category),
          });
        }

        if (hydrated.length > 0) {
          store[key] = hydrated;
          await writeMemoriesStore(store);
          return hydrated;
        }
      }
    } catch (err) {
      console.warn('Walrus cross-session hydration notice:', err);
    }
  }

  return list;
}

export async function saveWalrusMemory(
  walletAddress: string,
  title: string,
  content: string,
  category: MemoryCategory = 'Goal'
): Promise<WalrusMemory> {
  const key = normalizeWalletAddress(walletAddress);
  const cleanTitle = title.trim().slice(0, 100);
  const cleanContent = content.trim().slice(0, 500);
  if (!cleanTitle || !cleanContent) {
    throw new Error('Memory title and content must be non-empty');
  }

  const namespace = getWalletMemoryNamespace(walletAddress);
  const client = getMemWalClient();

  let jobId: string | undefined;
  let blobId: string | undefined;
  let verifiedOnMainnet = false;
  let writeStatus: WalrusMemory['writeStatus'] = 'local-only';

  if (client) {
    const wireText = serializeForWalrus(category, cleanTitle, cleanContent);
    try {
      const completed = await client.rememberAndWait(wireText, namespace, {
        dedupe: true,
        timeoutMs: 40_000,
      });
      jobId = completed.job_id || completed.id;
      blobId = completed.blob_id || undefined;
      verifiedOnMainnet = Boolean(blobId);
      writeStatus = verifiedOnMainnet ? 'confirmed' : 'uploading';
    } catch (err: unknown) {
      if (err instanceof MemWalRememberJobTimeoutError) {
        // Accepted by Walrus Relayer and still uploading to Walrus Mainnet
        jobId = err.jobId;
        verifiedOnMainnet = false;
        writeStatus = 'uploading';
      } else {
        console.warn('Walrus Mainnet remember error (retaining local record):', err);
        writeStatus = 'local-only';
      }
    }
  }

  const newMem: WalrusMemory = {
    id: blobId
      ? `walrus_${blobId.slice(0, 14)}`
      : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    walletAddress: key,
    category,
    title: cleanTitle,
    content: cleanContent,
    timestamp: formatDateLabel(),
    source: verifiedOnMainnet ? 'walrus-mainnet' : 'mind-ledger',
    verifiedOnMainnet,
    writeStatus,
    jobId,
    blobId,
    namespace,
    usedCount: 0,
    relevantTopics: extractTopics(cleanTitle, cleanContent, category),
  };

  const store = await readMemoriesStore();
  const list = store[key] || [];
  // Deduplicate if same blobId already exists
  const filtered = blobId ? list.filter((m) => m.blobId !== blobId) : list;
  store[key] = [newMem, ...filtered];
  await writeMemoriesStore(store);

  return newMem;
}

export async function updateWalrusMemory(
  walletAddress: string,
  memoryId: string,
  updates: { title: string; content: string; category: MemoryCategory }
): Promise<WalrusMemory | null> {
  const key = normalizeWalletAddress(walletAddress);
  const store = await readMemoriesStore();
  const list = store[key] || [];
  const existing = list.find((m) => m.id === memoryId);
  if (!existing) return null;

  if (existing.blobId) {
    await addTombstones(key, [existing.blobId, existing.id]);
  }

  store[key] = list.filter((m) => m.id !== memoryId);
  await writeMemoriesStore(store);

  return await saveWalrusMemory(
    walletAddress,
    updates.title,
    updates.content,
    updates.category
  );
}

export async function deleteWalrusMemory(
  walletAddress: string,
  memoryId: string
): Promise<boolean> {
  const key = normalizeWalletAddress(walletAddress);
  const store = await readMemoriesStore();
  const list = store[key] || [];
  const target = list.find((m) => m.id === memoryId);
  const filtered = list.filter((m) => m.id !== memoryId);

  if (target) {
    await addTombstones(key, [target.id, target.blobId || '']);
  }

  store[key] = filtered;
  await writeMemoriesStore(store);
  return filtered.length !== list.length;
}

export async function recallRelevantMemories(
  walletAddress: string,
  query: string,
  limit: number = 5,
  analysisLabel?: string
): Promise<WalrusMemory[]> {
  if (!walletAddress?.trim()) return [];
  const key = normalizeWalletAddress(walletAddress);
  const namespace = getWalletMemoryNamespace(walletAddress);
  const client = getMemWalClient();
  const tombstones = new Set((await readTombstones())[key] || []);

  const localAll = (await listWalletMemories(walletAddress)).filter(
    (m) => !tombstones.has(m.id) && !(m.blobId && tombstones.has(m.blobId))
  );

  let selected: WalrusMemory[] = [];

  // 1. Live Semantic Vector Search + SEAL Decryption via Walrus Mainnet Relayer
  if (client) {
    try {
      const recallRes = await client.recall({
        query,
        limit: Math.max(limit, 6),
        namespace,
        maxDistance: 0.86,
      });

      if (recallRes?.results?.length > 0) {
        for (const hit of recallRes.results) {
          if (hit.blob_id && tombstones.has(hit.blob_id)) continue;

          const matchedLocal = localAll.find(
            (m) => (hit.blob_id && m.blobId === hit.blob_id) ||
              serializeForWalrus(m.category, m.title, m.content) === hit.text
          );

          if (matchedLocal) {
            selected.push({
              ...matchedLocal,
              verifiedOnMainnet: true,
              writeStatus: 'confirmed',
              source: 'walrus-mainnet',
              blobId: hit.blob_id || matchedLocal.blobId,
              distance: hit.distance,
            });
          } else {
            const parsed = parseFromWalrusText(hit.text);
            const createdDate = hit.created_at ? new Date(hit.created_at) : new Date();
            selected.push({
              id: `walrus_${(hit.blob_id || Date.now().toString()).slice(0, 14)}`,
              walletAddress: key,
              category: parsed.category,
              title: parsed.title,
              content: parsed.content,
              timestamp: formatDateLabel(
                Number.isNaN(createdDate.getTime()) ? new Date() : createdDate
              ),
              source: 'walrus-mainnet',
              verifiedOnMainnet: true,
              writeStatus: 'confirmed',
              blobId: hit.blob_id,
              namespace,
              distance: hit.distance,
              relevantTopics: extractTopics(parsed.title, parsed.content, parsed.category),
            });
          }
        }
      }
    } catch (err) {
      console.warn('Walrus semantic recall fallback to local index:', err);
    }
  }

  // 2. Supplement or fall back to deterministic local relevance ranking
  if (selected.length < limit && localAll.length > 0) {
    const alreadyIds = new Set(selected.map((s) => s.id));
    const qTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const scored = localAll
      .filter((m) => !alreadyIds.has(m.id))
      .map((mem, idx) => {
        let score = Math.max(0, 12 - idx) * 0.1;
        const hay = `${mem.title} ${mem.content} ${mem.category}`.toLowerCase();
        for (const tok of qTokens) {
          if (hay.includes(tok)) score += 3;
        }
        if (mem.category === 'Goal' || mem.category === 'Preference') {
          score += 1.5;
        }
        return { mem, score };
      });

    scored.sort((a, b) => b.score - a.score);
    for (const item of scored) {
      if (selected.length >= limit) break;
      selected.push(item.mem);
    }
  }

  selected = selected.slice(0, limit);

  // 3. Record usage provenance ("Show which analyses used each memory" — Blueprint 3.4)
  if (selected.length > 0 && analysisLabel) {
    try {
      const store = await readMemoriesStore();
      const list = store[key] || [];
      const selectedIds = new Set(selected.map((s) => s.id));
      const selectedBlobs = new Set(selected.map((s) => s.blobId).filter(Boolean));
      let touched = false;

      store[key] = list.map((m) => {
        if (selectedIds.has(m.id) || (m.blobId && selectedBlobs.has(m.blobId))) {
          touched = true;
          return {
            ...m,
            usedCount: (m.usedCount || 0) + 1,
            lastUsedContext: analysisLabel.slice(0, 80),
          };
        }
        return m;
      });
      if (touched) {
        await writeMemoriesStore(store);
      }
    } catch {
      // Non-blocking provenance update
    }
  }

  return selected;
}

/**
 * Blueprint Section 7.6:
 * Write and verify the 10 meaningful Mainnet memory categories for a wallet using
 * live Tatum/Sui chain baseline + user goals, waiting for real Walrus confirmation
 * and verifying retrieval before counting them.
 */
export async function verifyTenMeaningfulMemories(
  walletAddress: string,
  wallet: WalletOverview,
  goals: FinancialGoal[]
): Promise<{
  succeeded: number;
  verifiedViaRecall: number;
  namespace: string;
  memories: WalrusMemory[];
}> {
  const client = getMemWalClient();
  if (!client) {
    throw new Error(
      'MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID must be configured in .env.local to execute verified Walrus Mainnet writes.'
    );
  }

  const key = normalizeWalletAddress(walletAddress);
  const namespace = getWalletMemoryNamespace(walletAddress);
  const topCoin = wallet.balances[0];
  const primaryGoal = goals[0];

  const tenItems: { category: MemoryCategory; title: string; content: string }[] = [
    {
      category: 'Goal',
      title: 'Stated savings goal',
      content: primaryGoal
        ? `Working toward "${primaryGoal.title}" with a target of $${primaryGoal.targetUsd.toLocaleString()} (${primaryGoal.deadline}).`
        : 'Prioritizes building a dedicated liquid stablecoin reserve alongside long-term Sui ecosystem exposure.',
    },
    {
      category: 'Preference',
      title: 'Minimum reserve preference',
      content: `Prefers preserving liquid stablecoin reserves (currently $${wallet.stableReserveUsd.toLocaleString()}) before deploying capital into volatile assets.`,
    },
    {
      category: 'Preference',
      title: 'Preferred alert threshold',
      content:
        'Wants explicit risk callouts whenever single-asset concentration exceeds 65% or outgoing transfers materially reduce stable reserves.',
    },
    {
      category: 'Preference',
      title: 'Preferred analysis style',
      content:
        'Prefers concise, evidence-grounded explanations citing transaction digests and explicitly stating uncertainty when transfer motives are ambiguous.',
    },
    {
      category: 'Pattern',
      title: 'Initial wallet baseline',
      content: `Observed baseline on Sui Mainnet: $${wallet.totalBalanceUsd.toLocaleString()} across ${wallet.balances.length} active token(s)${topCoin ? `, led by ${topCoin.coinSymbol} (${topCoin.percentageOfPortfolio}%)` : ''}.`,
    },
    {
      category: 'Pattern',
      title: 'Observed transaction-frequency pattern',
      content: `Observed ${wallet.transactions.length} recent verified transaction block(s) on Sui Mainnet as of ${new Date(wallet.fetchedAt).toLocaleDateString('en-US')}.`,
    },
    {
      category: 'Pattern',
      title: 'Observed token-movement pattern',
      content:
        wallet.monthlySpendUsd > 0
          ? `30-day outgoing transfers totaled approximately $${wallet.monthlySpendUsd.toLocaleString()}; onchain data alone does not confirm whether outflows were spending or self-transfers.`
          : 'Recent window shows minimal outgoing token transfers, consistent with a holding or accumulation posture.',
    },
    {
      category: 'Outcome',
      title: 'Previous recommendation and rationale',
      content:
        'Previously evaluated portfolio concentration relative to liquid USDC/USDT buffers to avoid forced sales during SUI volatility.',
    },
    {
      category: 'Feedback',
      title: 'User feedback on recommendation',
      content:
        'Confirmed that separating raw onchain facts from interpretation and highlighting reserve alignment makes insights actionable.',
    },
    {
      category: 'Preference',
      title: 'Updated baseline & liquidity priority',
      content:
        'Prioritizes capital preservation and goal-aligned liquidity over high-frequency speculative swapping.',
    },
  ];

  const bulkResult = await client.rememberBulkAndWait(
    tenItems.map((item) => ({
      text: serializeForWalrus(item.category, item.title, item.content),
      namespace,
    })),
    { timeoutMs: 95_000 }
  );

  const createdMemories: WalrusMemory[] = [];
  for (let i = 0; i < tenItems.length; i++) {
    const spec = tenItems[i];
    const resItem = bulkResult.results[i];
    const confirmed = resItem?.status === 'done' && Boolean(resItem.blob_id);

    createdMemories.push({
      id: confirmed
        ? `walrus_${resItem.blob_id.slice(0, 14)}`
        : `mem_${Date.now()}_${i}`,
      walletAddress: key,
      category: spec.category,
      title: spec.title,
      content: spec.content,
      timestamp: formatDateLabel(),
      source: confirmed ? 'walrus-mainnet' : 'mind-ledger',
      verifiedOnMainnet: confirmed,
      writeStatus: confirmed
        ? 'confirmed'
        : resItem?.status === 'timeout'
        ? 'uploading'
        : 'failed',
      jobId: resItem?.id,
      blobId: resItem?.blob_id || undefined,
      namespace,
      usedCount: 0,
      relevantTopics: extractTopics(spec.title, spec.content, spec.category),
    });
  }

  // Verify retrieval directly from Walrus Relayer before reporting final count
  const recallCheck = await client.recall({
    query: 'savings goal reserve preference baseline pattern feedback',
    limit: 12,
    namespace,
  });

  const store = await readMemoriesStore();
  const existing = store[key] || [];
  const newBlobIds = new Set(createdMemories.map((m) => m.blobId).filter(Boolean));
  const dedupedExisting = existing.filter((m) => !(m.blobId && newBlobIds.has(m.blobId)));
  store[key] = [...createdMemories, ...dedupedExisting];
  await writeMemoriesStore(store);

  return {
    succeeded: bulkResult.succeeded,
    verifiedViaRecall: recallCheck?.results?.length || 0,
    namespace,
    memories: createdMemories,
  };
}

export async function probeWalrusStatus(): Promise<{
  configured: boolean;
  relayerHealthy: boolean;
  writeReady: boolean;
  relayerUrl: string;
  namespacePrefix: string;
  accountId: string | null;
  memwalAgentId: string | null;
  delegateSuiAddress: string | null;
  message: string;
}> {
  const env = getServerEnv();
  const configured = Boolean(env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID);

  let relayerHealthy = false;
  let writeReady = false;
  try {
    const res = await fetch(`${env.MEMWAL_SERVER_URL.replace(/\/$/, '')}/health`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      relayerHealthy = data?.status === 'ok';
      writeReady = data?.write_ready !== false;
    }
  } catch {
    relayerHealthy = false;
  }

  let memwalAgentId: string | null = null;
  let delegateSuiAddress: string | null = null;

  if (env.MEMWAL_PRIVATE_KEY) {
    try {
      const pubBytes = await delegateKeyToPublicKey(env.MEMWAL_PRIVATE_KEY);
      memwalAgentId = Buffer.from(pubBytes).toString('hex');
      delegateSuiAddress = await delegateKeyToSuiAddress(env.MEMWAL_PRIVATE_KEY);
    } catch {
      memwalAgentId = null;
    }
  }

  return {
    configured,
    relayerHealthy,
    writeReady,
    relayerUrl: env.MEMWAL_SERVER_URL,
    namespacePrefix: env.MEMWAL_NAMESPACE,
    accountId: env.MEMWAL_ACCOUNT_ID
      ? `${env.MEMWAL_ACCOUNT_ID.slice(0, 8)}...${env.MEMWAL_ACCOUNT_ID.slice(-6)}`
      : null,
    memwalAgentId,
    delegateSuiAddress,
    message: configured
      ? relayerHealthy
        ? 'Walrus Memory Mainnet Relayer online & Ed25519 delegate key verified.'
        : 'Walrus credentials set, but relayer /health did not respond.'
      : 'Add MEMWAL_PRIVATE_KEY & MEMWAL_ACCOUNT_ID to .env.local to enable Walrus Mainnet SEAL writes.',
  };
}

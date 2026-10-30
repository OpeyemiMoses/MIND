import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { getServerEnv } from '@/lib/env';
import { CoinBalance, SuiTransaction, WalletOverview } from './types';
import { canonicalizeSuiCoinType, getLiveTokenPrices } from './price';

interface CoinMeta {
  decimals: number;
  symbol: string;
  name: string;
  iconUrl?: string;
}

interface NormalizedBalance {
  coinType: string;
  totalBalance: string;
  meta?: CoinMeta;
}

interface NormalizedTxBlock {
  digest: string;
  checkpoint?: string;
  sender: string;
  timestampMs: number;
  status: 'success' | 'failure';
  balanceChanges: {
    ownerAddress: string;
    coinType: string;
    amount: string;
  }[];
}

const metadataCache = new Map<string, CoinMeta>();

function inferFallbackMeta(coinType: string): CoinMeta {
  const lower = coinType.toLowerCase();
  if (lower.endsWith('::sui::sui')) {
    return { decimals: 9, symbol: 'SUI', name: 'Sui' };
  }
  const fallbackSymbol = (coinType.split('::').pop() || 'TOKEN').toUpperCase();
  const fallbackDecimals = lower.includes('usd') ? 6 : 9;
  return { decimals: fallbackDecimals, symbol: fallbackSymbol, name: fallbackSymbol };
}

let cachedTatumKey = '';
let cachedTatumClient: SuiGrpcClient | null = null;

function createTatumGrpcClient(apiKey: string, baseUrl: string): SuiGrpcClient {
  const cacheKey = `${baseUrl}::${apiKey.slice(-8)}`;
  if (cachedTatumClient && cachedTatumKey === cacheKey) {
    return cachedTatumClient;
  }

  const parsed = new URL(baseUrl);
  const isPlaintext = parsed.protocol === 'http:';
  const defaultPort = isPlaintext ? '80' : '443';
  const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : `${parsed.hostname}:${defaultPort}`;

  const transport = new GrpcTransport({
    host,
    channelCredentials: isPlaintext
      ? ChannelCredentials.createInsecure()
      : ChannelCredentials.createSsl(),
    meta: {
      'x-api-key': apiKey,
    },
  });

  cachedTatumClient = new SuiGrpcClient({
    network: 'mainnet',
    transport,
  });
  cachedTatumKey = cacheKey;
  return cachedTatumClient;
}

async function resolveCoinMetadata(
  coinType: string,
  grpcClient?: SuiGrpcClient,
  graphqlUrl?: string
): Promise<CoinMeta> {
  const lower = coinType.toLowerCase();
  if (lower.endsWith('::sui::sui')) {
    return { decimals: 9, symbol: 'SUI', name: 'Sui' };
  }

  const cached = metadataCache.get(coinType);
  if (cached) return cached;

  if (grpcClient) {
    try {
      const res = await grpcClient.getCoinMetadata({ coinType });
      const meta = res?.coinMetadata;
      if (meta && typeof meta.decimals === 'number') {
        const resolved: CoinMeta = {
          decimals: meta.decimals,
          symbol: (meta.symbol || coinType.split('::').pop() || 'TOKEN').toUpperCase(),
          name: meta.name || meta.symbol || 'Sui Token',
          iconUrl: meta.iconUrl || undefined,
        };
        metadataCache.set(coinType, resolved);
        return resolved;
      }
    } catch {
      // Fall through to GraphQL / deterministic fallback
    }
  }

  if (graphqlUrl) {
    try {
      const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetMeta($ct: String!) { coinMetadata(coinType: $ct) { decimals symbol name iconUrl } }`,
          variables: { ct: coinType },
        }),
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const meta = json?.data?.coinMetadata;
        if (meta && typeof meta.decimals === 'number') {
          const resolved: CoinMeta = {
            decimals: meta.decimals,
            symbol: (meta.symbol || coinType.split('::').pop() || 'TOKEN').toUpperCase(),
            name: meta.name || meta.symbol || 'Sui Token',
            iconUrl: typeof meta.iconUrl === 'string' && meta.iconUrl ? meta.iconUrl : undefined,
          };
          metadataCache.set(coinType, resolved);
          return resolved;
        }
      }
    } catch {
      // Fall through
    }
  }

  const fallback = inferFallbackMeta(coinType);
  metadataCache.set(coinType, fallback);
  return fallback;
}

async function fetchIncomingDigestsGraphQL(
  address: string,
  graphqlUrl: string
): Promise<string[]> {
  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query AffectedDigests($addr: SuiAddress!) {
          transactions(last: 25, filter: { affectedAddress: $addr }) {
            nodes { digest }
          }
        }`,
        variables: { addr: address },
      }),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const payload = await res.json();
    const nodes = payload?.data?.transactions?.nodes || [];
    return nodes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((n: any) => (typeof n?.digest === 'string' ? n.digest : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGrpcTxItem(rawItem: any): NormalizedTxBlock | null {
  const tx = rawItem?.Transaction || rawItem;
  if (!tx?.digest) return null;

  const tsNum = Number(tx.timestampMs);
  return {
    digest: String(tx.digest),
    checkpoint: tx.checkpoint ? String(tx.checkpoint) : undefined,
    sender: tx.transaction?.sender || '',
    timestampMs: Number.isFinite(tsNum) && tsNum > 0 ? tsNum : Date.now(),
    status: tx.status?.success === false ? 'failure' : 'success',
    balanceChanges: Array.isArray(tx.balanceChanges)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx.balanceChanges.map((bc: any) => ({
          ownerAddress: bc?.address || bc?.owner?.AddressOwner || '',
          coinType: bc?.coinType || '',
          amount: String(bc?.amount || '0'),
        }))
      : [],
  };
}

async function fetchAllGrpcBalances(
  client: SuiGrpcClient,
  address: string
): Promise<NormalizedBalance[]> {
  const collected: NormalizedBalance[] = [];
  let cursor: string | null | undefined = undefined;

  for (let page = 0; page < 4; page++) {
    const res = await client.listBalances({
      owner: address,
      cursor: cursor || undefined,
    });
    for (const b of res?.balances || []) {
      collected.push({
        coinType: b.coinType,
        totalBalance: String(b.balance || '0'),
      });
    }
    if (!res?.hasNextPage || !res?.cursor) break;
    cursor = res.cursor;
  }

  return collected;
}

async function fetchViaTatumMainnetGrpc(
  address: string,
  apiKey: string,
  grpcUrl: string,
  graphqlUrl: string
): Promise<{
  balances: NormalizedBalance[];
  txBlocks: NormalizedTxBlock[];
  grpcClient: SuiGrpcClient;
}> {
  const client = createTatumGrpcClient(apiKey, grpcUrl);

  const [balances, senderTxRes, affectedDigests] = await Promise.all([
    fetchAllGrpcBalances(client, address),
    client
      .listTransactions({
        filter: { sender: address },
        limit: 25,
        include: { balanceChanges: true, transaction: true },
      })
      .catch(() => ({ transactions: [] })),
    fetchIncomingDigestsGraphQL(address, graphqlUrl),
  ]);

  const txMap = new Map<string, NormalizedTxBlock>();
  for (const item of senderTxRes?.transactions || []) {
    const parsed = parseGrpcTxItem(item);
    if (parsed) txMap.set(parsed.digest, parsed);
  }

  const missingDigests = affectedDigests.filter((d) => !txMap.has(d)).slice(0, 15);

  if (missingDigests.length > 0) {
    const fetched = await Promise.all(
      missingDigests.map((digest) =>
        client
          .getTransaction({
            digest,
            include: { balanceChanges: true, transaction: true },
          })
          .catch(() => null)
      )
    );
    for (const item of fetched) {
      if (!item) continue;
      const parsed = parseGrpcTxItem(item);
      if (parsed) txMap.set(parsed.digest, parsed);
    }
  }

  return {
    balances,
    txBlocks: Array.from(txMap.values()),
    grpcClient: client,
  };
}

async function fetchViaSuiMainnetGraphQL(
  address: string,
  graphqlUrl: string
): Promise<{
  balances: NormalizedBalance[];
  txBlocks: NormalizedTxBlock[];
}> {
  const balances: NormalizedBalance[] = [];
  let txBlocks: NormalizedTxBlock[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 4; page++) {
    const includeTxs = page === 0;
    const query = `
      query GetWalletIntelligence($addr: SuiAddress!, $after: String) {
        address(address: $addr) {
          balances(first: 50, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              coinType { repr }
              totalBalance
              coinMetadata {
                decimals
                symbol
                name
                iconUrl
              }
            }
          }
        }
        ${
          includeTxs
            ? `transactions(last: 35, filter: { affectedAddress: $addr }) {
          nodes {
            digest
            sender { address }
            effects {
              status
              timestamp
              checkpoint { sequenceNumber }
              balanceChanges(first: 25) {
                nodes {
                  owner { address }
                  coinType { repr }
                  amount
                }
              }
            }
          }
        }`
            : ''
        }
      }
    `;

    const res: Response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addr: address, after: cursor } }),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (page === 0) throw new Error(`Sui Mainnet GraphQL HTTP ${res.status}`);
      break;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = await res.json();
    if (payload?.errors?.length && !payload?.data && page === 0) {
      throw new Error(payload.errors[0]?.message || 'Sui Mainnet GraphQL query failed');
    }

    const balConn = payload?.data?.address?.balances;
    const rawBalNodes = balConn?.nodes || [];

    for (const node of rawBalNodes) {
      const coinType: string = node?.coinType?.repr || '';
      const totalBalance: string = String(node?.totalBalance || '0');
      if (!coinType) continue;

      let meta: CoinMeta | undefined;
      if (node?.coinMetadata && typeof node.coinMetadata.decimals === 'number') {
        meta = {
          decimals: node.coinMetadata.decimals,
          symbol: (node.coinMetadata.symbol || coinType.split('::').pop() || 'TOKEN').toUpperCase(),
          name: node.coinMetadata.name || node.coinMetadata.symbol || 'Sui Token',
          iconUrl:
            typeof node.coinMetadata.iconUrl === 'string' && node.coinMetadata.iconUrl
              ? node.coinMetadata.iconUrl
              : undefined,
        };
        metadataCache.set(coinType, meta);
      }

      balances.push({ coinType, totalBalance, meta });
    }

    if (includeTxs) {
      const rawTxNodes = payload?.data?.transactions?.nodes || [];
      txBlocks = [];
      for (const node of rawTxNodes) {
        if (!node?.digest) continue;
        const isoTs: string | undefined = node?.effects?.timestamp;
        const parsedTs = isoTs ? Date.parse(isoTs) : Date.now();
        const statusStr = String(node?.effects?.status || 'SUCCESS').toUpperCase();
        const bcNodes = node?.effects?.balanceChanges?.nodes || [];
        const seq = node?.effects?.checkpoint?.sequenceNumber;

        txBlocks.push({
          digest: node.digest,
          checkpoint: seq !== undefined && seq !== null ? String(seq) : undefined,
          sender: node?.sender?.address || '',
          timestampMs: Number.isFinite(parsedTs) ? parsedTs : Date.now(),
          status: statusStr === 'FAILURE' ? 'failure' : 'success',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          balanceChanges: bcNodes.map((bc: any) => ({
            ownerAddress: bc?.owner?.address || '',
            coinType: bc?.coinType?.repr || '',
            amount: String(bc?.amount || '0'),
          })),
        });
      }
    }

    if (!balConn?.pageInfo?.hasNextPage || !balConn?.pageInfo?.endCursor) {
      break;
    }
    cursor = balConn.pageInfo.endCursor;
  }

  return { balances, txBlocks };
}

function formatTimeAgo(timestampMs: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSmartAmount(val: number): string {
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return abs.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export async function probeTatumSuiStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  endpoint: string;
  mode: 'tatum-grpc' | 'sui-public-fallback';
  chainIdentifier?: string;
  message: string;
}> {
  const env = getServerEnv();
  if (!env.TATUM_API_KEY) {
    return {
      configured: false,
      connected: false,
      endpoint: env.SUI_MAINNET_GRAPHQL,
      mode: 'sui-public-fallback',
      message:
        'TATUM_API_KEY not set in .env.local — currently reading live Sui Mainnet via public GraphQL.',
    };
  }

  try {
    const client = createTatumGrpcClient(env.TATUM_API_KEY, env.TATUM_SUI_GRPC_URL);
    const chain = await client.getChainIdentifier();
    return {
      configured: true,
      connected: true,
      endpoint: env.TATUM_SUI_GRPC_URL,
      mode: 'tatum-grpc',
      chainIdentifier: chain.chainIdentifier,
      message: 'Authenticated with Tatum Sui Mainnet gRPC gateway.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tatum gRPC handshake failed';
    return {
      configured: true,
      connected: false,
      endpoint: env.TATUM_SUI_GRPC_URL,
      mode: 'sui-public-fallback',
      message: `Tatum gateway error (${msg}) — falling back to public Sui Mainnet.`,
    };
  }
}

export async function fetchWalletData(walletAddress: string): Promise<WalletOverview> {
  const address = walletAddress.trim();
  if (!/^0x[0-9a-fA-F]{40,66}$/.test(address)) {
    throw new Error('Invalid Sui wallet address');
  }

  const env = getServerEnv();
  const fetchedAt = new Date().toISOString();
  let rpcSource: 'tatum-mainnet' | 'sui-mainnet-rpc' = 'sui-mainnet-rpc';
  let rpcMethodSummary = 'Sui Mainnet GraphQL (address.balances + affectedAddress transactions)';
  let rawBalances: NormalizedBalance[] = [];
  let txBlocks: NormalizedTxBlock[] = [];
  let activeGrpcClient: SuiGrpcClient | undefined;

  if (env.TATUM_API_KEY) {
    try {
      const res = await fetchViaTatumMainnetGrpc(
        address,
        env.TATUM_API_KEY,
        env.TATUM_SUI_GRPC_URL,
        env.SUI_MAINNET_GRAPHQL
      );
      rawBalances = res.balances;
      txBlocks = res.txBlocks;
      activeGrpcClient = res.grpcClient;
      rpcSource = 'tatum-mainnet';
      rpcMethodSummary =
        'Tatum Sui Mainnet gRPC (StateService/ListBalances + LedgerService/GetTransaction)';
    } catch (err) {
      console.warn('Tatum Sui Mainnet gRPC unavailable, falling back to Sui Mainnet GraphQL:', err);
      const res = await fetchViaSuiMainnetGraphQL(address, env.SUI_MAINNET_GRAPHQL);
      rawBalances = res.balances;
      txBlocks = res.txBlocks;
      rpcSource = 'sui-mainnet-rpc';
    }
  } else {
    const res = await fetchViaSuiMainnetGraphQL(address, env.SUI_MAINNET_GRAPHQL);
    rawBalances = res.balances;
    txBlocks = res.txBlocks;
    rpcSource = 'sui-mainnet-rpc';
  }

  txBlocks.sort((a, b) => b.timestampMs - a.timestampMs);
  txBlocks = txBlocks.slice(0, 35);

  const nonZeroRaw = rawBalances.filter((b) => BigInt(b.totalBalance || '0') > BigInt(0));

  const allObservedCoinTypes = new Set<string>();
  const uncachedTypes = new Set<string>();
  for (const b of nonZeroRaw) {
    allObservedCoinTypes.add(b.coinType);
    if (!b.meta && !metadataCache.has(b.coinType)) uncachedTypes.add(b.coinType);
  }
  for (const tx of txBlocks) {
    for (const bc of tx.balanceChanges) {
      if (bc.coinType) {
        allObservedCoinTypes.add(bc.coinType);
        if (!metadataCache.has(bc.coinType)) {
          uncachedTypes.add(bc.coinType);
        }
      }
    }
  }

  const [market] = await Promise.all([
    getLiveTokenPrices(Array.from(allObservedCoinTypes)),
    Promise.all(
      Array.from(uncachedTypes).map((ct) =>
        resolveCoinMetadata(ct, activeGrpcClient, env.SUI_MAINNET_GRAPHQL)
      )
    ),
  ]);

  let totalBalanceUsd = 0;
  let stableReserveUsd = 0;

  const balances: CoinBalance[] = [];
  for (const b of nonZeroRaw) {
    const meta =
      b.meta || (await resolveCoinMetadata(b.coinType, activeGrpcClient, env.SUI_MAINNET_GRAPHQL));
    const canonicalType = canonicalizeSuiCoinType(b.coinType);
    const llamaQuote = market.byCoinType[canonicalType];

    const decimals = meta.decimals ?? llamaQuote?.decimals ?? 9;
    const symbol = (llamaQuote?.symbol || meta.symbol || 'TOKEN').toUpperCase();
    const formatted = Number(b.totalBalance) / Math.pow(10, decimals);

    const usdPrice =
      llamaQuote?.price ??
      market.bySymbol[symbol] ??
      (symbol === 'USDC' ||
      symbol === 'USDT' ||
      symbol === 'AUSD' ||
      symbol === 'FDUSD' ||
      symbol === 'BUCK'
        ? 1.0
        : 0);

    const usdVal = formatted * usdPrice;
    totalBalanceUsd += usdVal;

    if (
      symbol === 'USDC' ||
      symbol === 'USDT' ||
      symbol === 'AUSD' ||
      symbol === 'FDUSD' ||
      symbol === 'BUCK' ||
      symbol === 'USDY'
    ) {
      stableReserveUsd += usdVal;
    }

    balances.push({
      coinType: b.coinType,
      coinSymbol: symbol,
      coinName: meta.name,
      iconUrl: meta.iconUrl,
      decimals,
      totalBalanceRaw: b.totalBalance,
      formattedBalance: Number(formatted.toFixed(6)),
      usdPrice,
      usdValue: Math.round(usdVal * 100) / 100,
      percentageOfPortfolio: 0,
    });
  }

  balances.sort((a, b) => b.usdValue - a.usdValue || b.formattedBalance - a.formattedBalance);
  for (const b of balances) {
    b.percentageOfPortfolio =
      totalBalanceUsd > 0 ? Math.round((b.usdValue / totalBalanceUsd) * 100) : 0;
  }

  const normAddr = address.toLowerCase();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  let monthlySpendUsd = 0;
  const netUsdDeltasByTx: { timestamp: number; deltaUsd: number }[] = [];

  const transactions: SuiTransaction[] = [];
  for (const tx of txBlocks) {
    const ts = tx.timestampMs;
    const sender = tx.sender;

    const userChanges: { symbol: string; amount: number; usd: number }[] = [];
    let counterparty = sender && sender.toLowerCase() !== normAddr ? sender : '';

    for (const bc of tx.balanceChanges) {
      const ownerAddr = bc.ownerAddress;
      if (ownerAddr && ownerAddr.toLowerCase() === normAddr) {
        const meta = metadataCache.get(bc.coinType) || inferFallbackMeta(bc.coinType);
        const canonicalType = canonicalizeSuiCoinType(bc.coinType);
        const llamaQuote = market.byCoinType[canonicalType];
        const decimals = meta.decimals ?? llamaQuote?.decimals ?? 9;
        const symbol = (llamaQuote?.symbol || meta.symbol || 'TOKEN').toUpperCase();
        const amt = Number(bc.amount || 0) / Math.pow(10, decimals);
        const price =
          llamaQuote?.price ??
          market.bySymbol[symbol] ??
          (symbol.includes('USD') ? 1.0 : 0);
        userChanges.push({ symbol, amount: amt, usd: amt * price });
      } else if (ownerAddr && !counterparty) {
        counterparty = ownerAddr;
      }
    }

    const positives = userChanges.filter((c) => c.amount > 0);
    const negatives = userChanges.filter((c) => c.amount < 0);
    const meaningfulNegatives = negatives.filter(
      (c) => !(c.symbol === 'SUI' && Math.abs(c.amount) < 0.025 && positives.length > 0)
    );

    let type: SuiTransaction['type'] = 'Contract';
    let asset = 'SUI';
    let amountStr = '0 SUI';
    let usdAmount = 0;
    let semanticNote =
      'Programmatic Move call — gas or object state transition without net token transfer.';

    if (positives.length > 0 && meaningfulNegatives.length > 0) {
      type = 'Swap';
      const sold = meaningfulNegatives.sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd))[0];
      const bought = positives.sort((a, b) => b.usd - a.usd)[0];
      asset = `${sold.symbol} → ${bought.symbol}`;
      amountStr = `+${formatSmartAmount(bought.amount)} ${bought.symbol}`;
      usdAmount = Math.round(Math.max(bought.usd, Math.abs(sold.usd)) * 100) / 100;
      semanticNote = 'Atomic multi-asset balance change consistent with an onchain swap or LP action.';
    } else if (positives.length > 0) {
      type = 'Received';
      const mainIn = positives.sort((a, b) => b.usd - a.usd || b.amount - a.amount)[0];
      asset = mainIn.symbol;
      amountStr = `+${formatSmartAmount(mainIn.amount)} ${mainIn.symbol}`;
      usdAmount = Math.round(mainIn.usd * 100) / 100;
      semanticNote =
        'Incoming balance credit — could represent external income, self-transfer, or protocol withdrawal.';
    } else if (negatives.length > 0) {
      const mainOut = negatives.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
      if (mainOut.symbol === 'SUI' && Math.abs(mainOut.amount) < 0.02 && !counterparty) {
        type = 'Contract';
      } else {
        type = 'Sent';
        semanticNote =
          'Outgoing transfer — onchain evidence alone cannot distinguish spending, self-custody transfer, or DeFi deposit.';
      }
      asset = mainOut.symbol;
      amountStr = `-${formatSmartAmount(mainOut.amount)} ${mainOut.symbol}`;
      usdAmount = Math.round(Math.abs(mainOut.usd) * 100) / 100;

      if (type === 'Sent' && ts >= thirtyDaysAgo) {
        monthlySpendUsd += Math.abs(mainOut.usd);
      }
    }

    const netDeltaUsd = userChanges.reduce((acc, c) => acc + c.usd, 0);
    netUsdDeltasByTx.push({ timestamp: ts, deltaUsd: netDeltaUsd });

    const shortCounterparty = counterparty
      ? `${counterparty.slice(0, 6)}...${counterparty.slice(-4)}`
      : sender
      ? `${sender.slice(0, 6)}...${sender.slice(-4)}`
      : 'Onchain Program';

    transactions.push({
      digest: tx.digest,
      checkpoint: tx.checkpoint,
      type,
      asset,
      amount: amountStr,
      usdAmount,
      fromOrTo: shortCounterparty,
      timestamp: ts,
      timeAgo: formatTimeAgo(ts),
      status: tx.status,
      semanticNote,
      explorerUrl: `https://suivision.xyz/txblock/${tx.digest}`,
    });
  }

  const sparkline: { date: string; value: number }[] = [];
  if (transactions.length > 0) {
    let runningUsd = totalBalanceUsd;
    const points: { ts: number; val: number }[] = [
      { ts: Date.now(), val: Math.max(0, runningUsd) },
    ];
    for (const item of netUsdDeltasByTx.slice(0, 14)) {
      runningUsd = Math.max(0, runningUsd - item.deltaUsd);
      points.push({ ts: item.timestamp, val: runningUsd });
    }
    points.reverse();
    for (const pt of points) {
      sparkline.push({
        date: new Date(pt.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(pt.val * 100) / 100,
      });
    }
  }

  return {
    address,
    rpcSource,
    rpcMethodSummary,
    fetchedAt,
    totalBalanceUsd: Math.round(totalBalanceUsd * 100) / 100,
    suiChange24hPercent: market.suiChange24h,
    monthlySpendUsd: Math.round(monthlySpendUsd * 100) / 100,
    stableReserveUsd: Math.round(stableReserveUsd * 100) / 100,
    balances,
    transactions,
    sparkline,
  };
}

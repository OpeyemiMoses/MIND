export interface DefiLlamaTokenQuote {
  price: number;
  decimals?: number;
  symbol?: string;
}

export interface LiveMarketPrices {
  bySymbol: Record<string, number>;
  byCoinType: Record<string, DefiLlamaTokenQuote>;
  suiChange24h: number;
}

let cachedCoreMarket: {
  bySymbol: Record<string, number>;
  suiChange24h: number;
  timestamp: number;
} | null = null;
const CORE_TTL_MS = 60 * 1000;

const coinTypeQuoteCache = new Map<
  string,
  { quote: DefiLlamaTokenQuote; timestamp: number }
>();

export function canonicalizeSuiCoinType(coinType: string): string {
  const trimmed = coinType.trim();
  if (/^0x0*2::sui::SUI$/i.test(trimmed)) {
    return '0x2::sui::SUI';
  }
  return trimmed;
}

export async function getLiveTokenPrices(
  walletCoinTypes: string[] = []
): Promise<LiveMarketPrices> {
  const now = Date.now();
  let bySymbol: Record<string, number> = {
    SUI: 0,
    USDC: 1.0,
    USDT: 1.0,
    AUSD: 1.0,
    FDUSD: 1.0,
    BUCK: 1.0,
    USDY: 1.0,
  };
  let suiChange24h = 0;

  if (cachedCoreMarket && now - cachedCoreMarket.timestamp < CORE_TTL_MS) {
    bySymbol = { ...bySymbol, ...cachedCoreMarket.bySymbol };
    suiChange24h = cachedCoreMarket.suiChange24h;
  } else {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=sui,usd-coin,tether,cetus-protocol,deep,walrus-2,scallop-2,navi-protocol&vs_currencies=usd&include_24hr_change=true',
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        const fetchedSymbols: Record<string, number> = {
          SUI: typeof json?.sui?.usd === 'number' ? json.sui.usd : 0,
          USDC: typeof json?.['usd-coin']?.usd === 'number' ? json['usd-coin'].usd : 1.0,
          USDT: typeof json?.tether?.usd === 'number' ? json.tether.usd : 1.0,
          CETUS:
            typeof json?.['cetus-protocol']?.usd === 'number'
              ? json['cetus-protocol'].usd
              : 0,
          DEEP: typeof json?.deep?.usd === 'number' ? json.deep.usd : 0,
          WAL: typeof json?.['walrus-2']?.usd === 'number' ? json['walrus-2'].usd : 0,
          SCA: typeof json?.['scallop-2']?.usd === 'number' ? json['scallop-2'].usd : 0,
          NAVX:
            typeof json?.['navi-protocol']?.usd === 'number'
              ? json['navi-protocol'].usd
              : 0,
        };
        suiChange24h =
          typeof json?.sui?.usd_24h_change === 'number'
            ? Math.round(json.sui.usd_24h_change * 100) / 100
            : 0;
        bySymbol = { ...bySymbol, ...fetchedSymbols };
        cachedCoreMarket = {
          bySymbol: fetchedSymbols,
          suiChange24h,
          timestamp: now,
        };
      }
    } catch {
      if (cachedCoreMarket) {
        bySymbol = { ...bySymbol, ...cachedCoreMarket.bySymbol };
        suiChange24h = cachedCoreMarket.suiChange24h;
      }
    }
  }

  // Resolve exact onchain Sui coinType quotes from DefiLlama for ANY token in the connected wallet
  const canonicalTypes = Array.from(
    new Set(['0x2::sui::SUI', ...walletCoinTypes.map(canonicalizeSuiCoinType)])
  ).filter(Boolean);

  const byCoinType: Record<string, DefiLlamaTokenQuote> = {};
  const uncachedTypes: string[] = [];

  for (const ct of canonicalTypes) {
    const hit = coinTypeQuoteCache.get(ct);
    if (hit && now - hit.timestamp < CORE_TTL_MS) {
      byCoinType[ct] = hit.quote;
    } else {
      uncachedTypes.push(ct);
    }
  }

  // Batch up to 35 coinTypes per DefiLlama request
  for (let i = 0; i < uncachedTypes.length; i += 35) {
    const chunk = uncachedTypes.slice(i, i + 35);
    const llamaKeys = chunk.map((ct) => `sui:${ct}`).join(',');
    try {
      const res = await fetch(
        `https://coins.llama.fi/prices/current/${llamaKeys}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const payload = await res.json();
        const coinsObj = payload?.coins || {};
        for (const ct of chunk) {
          const entry = coinsObj[`sui:${ct}`];
          if (entry && typeof entry.price === 'number') {
            const quote: DefiLlamaTokenQuote = {
              price: entry.price,
              decimals: typeof entry.decimals === 'number' ? entry.decimals : undefined,
              symbol: typeof entry.symbol === 'string' ? entry.symbol : undefined,
            };
            byCoinType[ct] = quote;
            coinTypeQuoteCache.set(ct, { quote, timestamp: now });
            if (quote.symbol) {
              bySymbol[quote.symbol.toUpperCase()] = quote.price;
            }
          }
        }
      }
    } catch {
      // Non-fatal: fall back to symbol dictionary
    }
  }

  if (byCoinType['0x2::sui::SUI']?.price && !bySymbol.SUI) {
    bySymbol.SUI = byCoinType['0x2::sui::SUI'].price;
  }

  return {
    bySymbol,
    byCoinType,
    suiChange24h,
  };
}

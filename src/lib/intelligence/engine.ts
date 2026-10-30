import { z } from 'zod';
import {
  listWalletMemories,
  recallRelevantMemories,
  saveWalrusMemory,
} from '../walrus/client';
import { evaluateUserMessageForMemory } from '../walrus/policy';
import { WalrusMemory } from '../walrus/types';
import { fetchWalletData } from '../sui/client';
import { WalletOverview } from '../sui/types';
import { listGoalsForWallet } from '../goals/store';
import { generateStructuredJson } from './llm';

export interface ReasoningMeta {
  provider: string;
  model: string;
  mode: 'llm' | 'deterministic-fallback';
  rpcSource: 'tatum-mainnet' | 'sui-mainnet-rpc';
  fetchedAt: string;
}

export interface AnalysisResponse {
  answer: string;
  observations: string[];
  recommendation: string;
  uncertainties: string[];
  recalledMemories: WalrusMemory[];
  autoSavedMemory?: WalrusMemory;
  reasoningMeta: ReasoningMeta;
  evidence: {
    portfolioTotalUsd: string;
    stableReserveUsd: string;
    topHolding: string;
    recentTxCount: number;
    sampleDigests: string[];
  };
}

export interface FrozenEvidenceSnapshot {
  address: string;
  fetchedAt: string;
  rpcSource: 'tatum-mainnet' | 'sui-mainnet-rpc';
  rpcMethodSummary: string;
  totalBalanceUsd: number;
  stableReserveUsd: number;
  monthlySpendUsd: number;
  suiChange24hPercent: number;
  topHoldings: {
    symbol: string;
    balance: number;
    usdValue: number;
    weightPct: number;
  }[];
  recentTransactions: {
    digest: string;
    type: string;
    asset: string;
    amount: string;
    usdAmount: number;
    timeAgo: string;
    semanticNote?: string;
  }[];
}

export interface ReplayComparison {
  query: string;
  snapshotAddress: string;
  snapshotTotalUsd: number;
  snapshot: FrozenEvidenceSnapshot;
  withoutContext: {
    title: string;
    badge: string;
    text: string;
    keyPoints: string[];
  };
  withContext: {
    title: string;
    badge: string;
    text: string;
    keyPoints: string[];
    recalledMemories: WalrusMemory[];
  };
  whatChanged: string[];
  whyContextMatters: string;
  uncertainties: string[];
  reasoningMeta: ReasoningMeta;
}

const AskMindLlmSchema = z.object({
  answer: z.string().min(4).max(1200),
  observations: z.array(z.string().min(4)).min(1).max(10),
  recommendation: z.string().min(6).max(1500),
  uncertainties: z.array(z.string().min(4)).min(0).max(6),
});

const ReplayModeOutputSchema = z.object({
  text: z.string().min(8).max(2500),
  keyPoints: z.array(z.string().min(4)).min(1).max(8),
});

const ReplaySynthesisSchema = z.object({
  whatChanged: z.array(z.string().min(4)).min(1).max(8),
  whyContextMatters: z.string().min(8).max(1800),
  uncertainties: z.array(z.string().min(4)).min(0).max(6),
});

function buildFrozenSnapshot(wallet: WalletOverview): FrozenEvidenceSnapshot {
  return {
    address: wallet.address,
    fetchedAt: wallet.fetchedAt,
    rpcSource: wallet.rpcSource,
    rpcMethodSummary: wallet.rpcMethodSummary,
    totalBalanceUsd: wallet.totalBalanceUsd,
    stableReserveUsd: wallet.stableReserveUsd,
    monthlySpendUsd: wallet.monthlySpendUsd,
    suiChange24hPercent: wallet.suiChange24hPercent,
    topHoldings: wallet.balances.slice(0, 6).map((b) => ({
      symbol: b.coinSymbol,
      balance: Number(b.formattedBalance.toFixed(4)),
      usdValue: Number(b.usdValue.toFixed(2)),
      weightPct: b.percentageOfPortfolio,
    })),
    recentTransactions: wallet.transactions.slice(0, 8).map((tx) => ({
      digest: tx.digest,
      type: tx.type,
      asset: tx.asset,
      amount: tx.amount,
      usdAmount: tx.usdAmount,
      timeAgo: tx.timeAgo,
      semanticNote: tx.semanticNote,
    })),
  };
}

function buildDefaultUncertainties(wallet: WalletOverview): string[] {
  const list: string[] = [];
  const hasSent = wallet.transactions.some((tx) => tx.type === 'Sent');
  if (hasSent) {
    list.push(
      'Outgoing transfers on Sui Mainnet cannot distinguish consumer spending from self-custody transfers or DeFi deposits without user context.'
    );
  } else {
    list.push(
      'Onchain balances reflect this single connected Sui address and do not capture external bank accounts, centralized exchanges, or secondary wallets.'
    );
  }
  if (wallet.balances.some((b) => b.usdPrice === 0 && b.formattedBalance > 0)) {
    list.push(
      'One or more ecosystem tokens currently lack a verified USD spot quote and are valued at $0.00 rather than guessed.'
    );
  }
  return list;
}

export async function generateMindAnswer(
  query: string,
  walletAddress: string
): Promise<AnalysisResponse> {
  // 1. OBSERVE + RECALL
  const [wallet, existingAllMemories, goals] = await Promise.all([
    fetchWalletData(walletAddress),
    listWalletMemories(walletAddress),
    listGoalsForWallet(walletAddress),
  ]);

  // 2. LEARNING LOOP (Remember Policy): if user explicitly states a new durable goal,
  //    preference, threshold, decision, or feedback, persist it to Walrus Memory first!
  let autoSavedMemory: WalrusMemory | undefined;
  const candidate = evaluateUserMessageForMemory(query, existingAllMemories);
  if (candidate && candidate.shouldRemember) {
    try {
      autoSavedMemory = await saveWalrusMemory(
        walletAddress,
        candidate.title,
        candidate.content,
        candidate.category
      );
    } catch (err) {
      console.warn('Learning loop auto-remember warning:', err);
    }
  }

  // Recall relevant memories (including any newly persisted statement) and record usage provenance
  const recalledMemories = await recallRelevantMemories(
    walletAddress,
    query,
    5,
    `Ask Mind: ${query}`
  );

  const snapshot = buildFrozenSnapshot(wallet);
  const totalFmt = `$${wallet.totalBalanceUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const stableFmt = `$${wallet.stableReserveUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const topCoin = wallet.balances[0];
  const topHoldingStr = topCoin
    ? `${topCoin.formattedBalance.toLocaleString()} ${topCoin.coinSymbol} ($${topCoin.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : '0 tokens';

  // 3. REASON via Structured-Output LLM (with grounded deterministic fallback)
  const systemPrompt = [
    'You are Mind, a luxury personal financial intelligence companion built on Tatum Sui Mainnet and Walrus Memory.',
    'STRICT GROUNDING RULES:',
    '1. Separate verified onchain facts from interpretation. Never invent balances, prices, or transaction digests.',
    '2. Never falsely classify raw outgoing crypto transfers as "Shopping", "Food", or "Transport" — explicitly acknowledge when transfer intent is ambiguous.',
    '3. Directly incorporate recalled Walrus memories and active user goals when forming your recommendation.',
    '4. Return ONLY a JSON object matching the exact schema: { "answer": string, "observations": string[], "recommendation": string, "uncertainties": string[] }.',
    '5. Do NOT use emojis anywhere.',
  ].join('\n');

  const userPrompt = JSON.stringify(
    {
      userQuestion: query,
      liveSuiMainnetSnapshot: snapshot,
      activeFinancialGoals: goals.map((g) => ({
        title: g.title,
        category: g.category,
        currentUsd: g.currentUsd,
        targetUsd: g.targetUsd,
        deadline: g.deadline,
      })),
      recalledWalrusMemories: recalledMemories.map((m) => ({
        category: m.category,
        title: m.title,
        content: m.content,
        verifiedOnMainnet: m.verifiedOnMainnet,
        blobId: m.blobId,
      })),
      newlyRememberedFromCurrentTurn: autoSavedMemory
        ? {
            category: autoSavedMemory.category,
            title: autoSavedMemory.title,
            content: autoSavedMemory.content,
          }
        : null,
    },
    null,
    2
  );

  const llmRes = await generateStructuredJson({
    systemPrompt,
    userPrompt,
    schema: AskMindLlmSchema,
    temperature: 0.2,
  });

  if (llmRes) {
    return {
      answer: llmRes.data.answer,
      observations: llmRes.data.observations,
      recommendation: llmRes.data.recommendation,
      uncertainties: llmRes.data.uncertainties,
      recalledMemories,
      autoSavedMemory,
      reasoningMeta: {
        provider: llmRes.provider,
        model: llmRes.model,
        mode: 'llm',
        rpcSource: wallet.rpcSource,
        fetchedAt: wallet.fetchedAt,
      },
      evidence: {
        portfolioTotalUsd: totalFmt,
        stableReserveUsd: stableFmt,
        topHolding: topHoldingStr,
        recentTxCount: wallet.transactions.length,
        sampleDigests: wallet.transactions.slice(0, 3).map((t) => t.digest),
      },
    };
  }

  // Grounded deterministic synthesis fallback (when no LLM API key is configured yet)
  const observations: string[] = [];

  if (wallet.balances.length === 0) {
    observations.push(
      `Connected Sui wallet (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}) currently holds $0.00 across 0 active token balances on Mainnet.`
    );
  } else {
    observations.push(
      `Live portfolio value is ${totalFmt} across ${wallet.balances.length} token${wallet.balances.length === 1 ? '' : 's'}, led by ${topHoldingStr} (${topCoin.percentageOfPortfolio}% weight).`
    );
    observations.push(
      `Liquid stablecoin reserve stands at ${stableFmt}, with ${wallet.transactions.length} recent verified transaction block${wallet.transactions.length === 1 ? '' : 's'} on Sui Mainnet.`
    );
  }

  if (goals.length > 0) {
    const primaryGoal = goals[0];
    const pct = Math.min(100, Math.round((primaryGoal.currentUsd / primaryGoal.targetUsd) * 100));
    observations.push(
      `Active goal "${primaryGoal.title}" is at $${primaryGoal.currentUsd.toLocaleString()} of $${primaryGoal.targetUsd.toLocaleString()} (${pct}% funded, target: ${primaryGoal.deadline}).`
    );
  }

  if (recalledMemories.length > 0) {
    observations.push(
      `Recalled ${recalledMemories.length} Walrus memory record${recalledMemories.length === 1 ? '' : 's'}, including [${recalledMemories[0].category}] "${recalledMemories[0].title}": ${recalledMemories[0].content}`
    );
  } else {
    observations.push(
      'No personal memories have been recorded for this wallet yet — state a goal or risk preference in chat or Memory to personalize future guidance.'
    );
  }

  let recommendation = '';
  if (wallet.balances.length === 0) {
    recommendation =
      'Fund your Sui Mainnet wallet or record your financial targets and minimum reserve rules in Goals & Memory so Mind can measure real progress as onchain activity begins.';
  } else if (goals.length > 0 || recalledMemories.length > 0) {
    const contextRef = goals[0]
      ? `your "${goals[0].title}" target ($${goals[0].targetUsd.toLocaleString()})`
      : `your saved "${recalledMemories[0].title}" rule`;
    if (topCoin && topCoin.percentageOfPortfolio >= 70 && !topCoin.coinSymbol.includes('USD')) {
      recommendation = `With ${topCoin.percentageOfPortfolio}% concentrated in ${topCoin.coinSymbol} and ${contextRef} active, consider routing incremental gains into liquid stablecoins to protect your target from spot drawdowns.`;
    } else {
      recommendation = `Maintain alignment with ${contextRef}. Your liquid stable reserve (${stableFmt}) provides an explicit buffer alongside ${totalFmt} total onchain value.`;
    }
  } else {
    recommendation = `Your live portfolio (${totalFmt}) is currently evaluated from raw chain state alone. Add a target in Goals or state a reserve rule here so Mind can tailor recommendations to your personal plan.`;
  }

  return {
    answer: autoSavedMemory
      ? `Recorded "${autoSavedMemory.title}" into your wallet memory ledger and evaluated ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}:`
      : `Live Mainnet intelligence for ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} regarding "${query}":`,
    observations,
    recommendation,
    uncertainties: buildDefaultUncertainties(wallet),
    recalledMemories,
    autoSavedMemory,
    reasoningMeta: {
      provider: 'mind-grounded-engine',
      model: 'deterministic-v2',
      mode: 'deterministic-fallback',
      rpcSource: wallet.rpcSource,
      fetchedAt: wallet.fetchedAt,
    },
    evidence: {
      portfolioTotalUsd: totalFmt,
      stableReserveUsd: stableFmt,
      topHolding: topHoldingStr,
      recentTxCount: wallet.transactions.length,
      sampleDigests: wallet.transactions.slice(0, 3).map((t) => t.digest),
    },
  };
}

/**
 * Controlled Memory Replay (Blueprint Section 3.5 & Section 8):
 * Runs Mode A (Stateless: Frozen Chain Snapshot ONLY, memories = []) and
 * Mode B (Stateful: Identical Frozen Chain Snapshot + Recalled Walrus Memories + Goals)
 * under identical LLM model & temperature (0.2) to prove measurable behavioral delta.
 */
export async function generateMemoryReplay(
  query: string,
  walletAddress: string
): Promise<ReplayComparison> {
  // Single frozen chain fetch so Mode A and Mode B inspect the EXACT same snapshot
  const [wallet, recalledMemories, goals] = await Promise.all([
    fetchWalletData(walletAddress),
    recallRelevantMemories(walletAddress, query, 5, `Memory Replay: ${query}`),
    listGoalsForWallet(walletAddress),
  ]);

  const snapshot = buildFrozenSnapshot(wallet);
  const hasContext = recalledMemories.length > 0 || goals.length > 0;
  const totalFmt = `$${wallet.totalBalanceUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const topCoin = wallet.balances[0];

  const baseSystemRules = [
    'You are Mind evaluating a frozen Sui Mainnet wallet snapshot.',
    'Never invent transactions, prices, or offchain context not present in the input.',
    'Never use emojis.',
    'Return ONLY valid JSON matching { "text": string, "keyPoints": string[] }.',
  ].join('\n');

  // Execute Mode A (memories = []) and Mode B (memories = recalledMemories) with identical temperature
  const [modeALlm, modeBLlm] = await Promise.all([
    generateStructuredJson({
      systemPrompt: `${baseSystemRules}\nMODE A (STATELESS): You have ZERO access to user goals, preferences, or history. Base your answer strictly on the raw Sui Mainnet snapshot.`,
      userPrompt: JSON.stringify(
        {
          question: query,
          frozenSuiSnapshot: snapshot,
          rememberedContext: [],
        },
        null,
        2
      ),
      schema: ReplayModeOutputSchema,
      temperature: 0.2,
    }),
    hasContext
      ? generateStructuredJson({
          systemPrompt: `${baseSystemRules}\nMODE B (CONTEXT-GROUNDED): Evaluate the EXACT same frozen Sui Mainnet snapshot, explicitly adapting your guidance to the user's recalled Walrus memories and financial goals.`,
          userPrompt: JSON.stringify(
            {
              question: query,
              frozenSuiSnapshot: snapshot,
              recalledWalrusMemories: recalledMemories.map((m) => ({
                category: m.category,
                title: m.title,
                content: m.content,
                verifiedOnMainnet: m.verifiedOnMainnet,
              })),
              activeFinancialGoals: goals.map((g) => ({
                title: g.title,
                currentUsd: g.currentUsd,
                targetUsd: g.targetUsd,
                deadline: g.deadline,
              })),
            },
            null,
            2
          ),
          schema: ReplayModeOutputSchema,
          temperature: 0.2,
        })
      : Promise.resolve(null),
  ]);

  const synthLlm =
    modeALlm && modeBLlm
      ? await generateStructuredJson({
          systemPrompt: [
            'Compare Mode A (stateless chain-only analysis) against Mode B (Walrus memory-grounded analysis) on the identical Sui Mainnet snapshot.',
            'Summarize concretely what changed, why remembered context mattered, and remaining onchain uncertainties.',
            'Never use emojis. Return ONLY valid JSON matching { "whatChanged": string[], "whyContextMatters": string, "uncertainties": string[] }.',
          ].join('\n'),
          userPrompt: JSON.stringify(
            {
              question: query,
              modeAStateless: modeALlm.data,
              modeBWithMemory: modeBLlm.data,
              recalledMemoriesCount: recalledMemories.length,
              goalsCount: goals.length,
            },
            null,
            2
          ),
          schema: ReplaySynthesisSchema,
          temperature: 0.2,
        })
      : null;

  const genericFallbackText =
    wallet.balances.length === 0
      ? `Wallet ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} holds $0.00 across 0 active token balances and ${wallet.transactions.length} recent transactions on Sui Mainnet. Without personal context or balances, stateless analysis can only offer generic diversification rules.`
      : `Wallet holds ${totalFmt} on Sui Mainnet (${topCoin.formattedBalance.toLocaleString()} ${topCoin.coinSymbol} at ${topCoin.percentageOfPortfolio}% weight, 24h SUI change ${wallet.suiChange24hPercent >= 0 ? '+' : ''}${wallet.suiChange24hPercent}%). Evaluating raw chain state with zero personal memory produces generic volatility and concentration observations across ${wallet.transactions.length} recent transactions.`;

  const contextualFallbackText = hasContext
    ? `Inspecting the identical ${totalFmt} frozen Sui Mainnet snapshot (${snapshot.fetchedAt}) alongside ${recalledMemories.length} recalled Walrus memor${recalledMemories.length === 1 ? 'y' : 'ies'}${goals[0] ? ` and "${goals[0].title}" ($${goals[0].currentUsd.toLocaleString()} / $${goals[0].targetUsd.toLocaleString()})` : ''}: ${
        recalledMemories[0]
          ? `because your ledger specifies [${recalledMemories[0].category}] "${recalledMemories[0].title}" (${recalledMemories[0].content}), Mind shifts from generic rebalancing advice to protecting your stated rule and $${wallet.stableReserveUsd.toLocaleString()} liquid reserve.`
          : `Mind anchors its allocation guidance directly to closing the remaining $${Math.max(0, goals[0].targetUsd - goals[0].currentUsd).toLocaleString()} gap on "${goals[0].title}".`
      }`
    : `This wallet currently has 0 saved memories and 0 goals. Save a goal or risk preference first, then re-run Replay to observe measurable divergence on your ${totalFmt} Mainnet snapshot.`;

  const whatChangedDefault = hasContext
    ? [
        `Shifted from generic portfolio commentary on ${totalFmt} to constraint-aware guidance anchored in ${recalledMemories.length} recalled memor${recalledMemories.length === 1 ? 'y' : 'ies'} and ${goals.length} active goal${goals.length === 1 ? '' : 's'}.`,
        recalledMemories[0]
          ? `Explicitly honored "${recalledMemories[0].title}" instead of assuming an average market risk tolerance.`
          : `Prioritized funding "${goals[0].title}" ($${goals[0].targetUsd.toLocaleString()}) over generic asset allocation.`,
        `Evaluated $${wallet.stableReserveUsd.toLocaleString()} stablecoin liquidity relative to personal reserve rules rather than market averages.`,
      ]
    : [
        'Both modes received zero personal memories because none have been saved for this wallet yet.',
        'Save a financial goal or state a reserve rule in Ask Mind to unlock context-driven divergence.',
      ];

  const whyContextMattersDefault = hasContext
    ? 'Raw blockchain state shows balances and transaction digests, but never reveals why funds are held, what reserve floor must remain untouched, or which past recommendations the user accepted. Persistent Walrus memory turns a stateless wallet viewer into an accountable financial companion.'
    : 'Once you save goals or preferences to Walrus Memory, Mind preserves your intent across sessions so you never have to re-explain your risk rules.';

  return {
    query,
    snapshotAddress: wallet.address,
    snapshotTotalUsd: wallet.totalBalanceUsd,
    snapshot,
    withoutContext: {
      title: 'Mode A — Without Remembered Context',
      badge: 'Frozen Chain Only',
      text: modeALlm ? modeALlm.data.text : genericFallbackText,
      keyPoints: modeALlm
        ? modeALlm.data.keyPoints
        : [
            `Frozen balance snapshot: ${totalFmt} (${wallet.balances.length} token${wallet.balances.length === 1 ? '' : 's'})`,
            `${wallet.transactions.length} Mainnet transaction${wallet.transactions.length === 1 ? '' : 's'} inspected`,
            'Zero goals, risk thresholds, or past decisions available',
          ],
    },
    withContext: {
      title: 'Mode B — With Walrus Memory Context',
      badge: hasContext ? 'Walrus Context Grounded' : 'Awaiting Memories',
      text: modeBLlm ? modeBLlm.data.text : contextualFallbackText,
      keyPoints: modeBLlm
        ? modeBLlm.data.keyPoints
        : hasContext
        ? [
            `Identical ${totalFmt} frozen Sui Mainnet snapshot`,
            `Recalled ${recalledMemories.length} Walrus memor${recalledMemories.length === 1 ? 'y' : 'ies'} & ${goals.length} saved goal${goals.length === 1 ? '' : 's'}`,
            'Aligns allocation trade-offs directly with stated user constraints',
          ]
        : [
            `Identical ${totalFmt} frozen Sui Mainnet snapshot`,
            '0 memories saved for this wallet so far',
            'Add a Goal or Memory to demonstrate longitudinal adaptation',
          ],
      recalledMemories,
    },
    whatChanged: synthLlm ? synthLlm.data.whatChanged : whatChangedDefault,
    whyContextMatters: synthLlm
      ? synthLlm.data.whyContextMatters
      : whyContextMattersDefault,
    uncertainties: synthLlm
      ? synthLlm.data.uncertainties
      : buildDefaultUncertainties(wallet),
    reasoningMeta: {
      provider: modeALlm ? modeALlm.provider : 'mind-grounded-engine',
      model: modeALlm ? modeALlm.model : 'deterministic-v2',
      mode: modeALlm ? 'llm' : 'deterministic-fallback',
      rpcSource: wallet.rpcSource,
      fetchedAt: wallet.fetchedAt,
    },
  };
}

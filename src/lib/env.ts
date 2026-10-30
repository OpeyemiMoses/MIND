import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

interface MemWalCliCredentials {
  delegatePrivateKey?: string;
  accountId?: string;
  relayerUrl?: string;
}

function readMemWalCliCredentials(): MemWalCliCredentials | null {
  try {
    const credsFile = path.join(os.homedir(), '.memwal', 'credentials.json');
    if (!fs.existsSync(credsFile)) return null;
    const raw = JSON.parse(fs.readFileSync(credsFile, 'utf8')) as Record<string, unknown>;
    const delegatePrivateKey =
      typeof raw.delegatePrivateKey === 'string' ? raw.delegatePrivateKey.trim() : undefined;
    const accountId = typeof raw.accountId === 'string' ? raw.accountId.trim() : undefined;
    const relayerUrl = typeof raw.relayerUrl === 'string' ? raw.relayerUrl.trim() : undefined;
    if (!delegatePrivateKey || !accountId) return null;
    return { delegatePrivateKey, accountId, relayerUrl };
  } catch {
    return null;
  }
}

const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^replace_me/i,
  /^insert_/i,
  /^0x\.\.\.$/i,
  /^<.*>$/,
];

function cleanSecret(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_PATTERNS.some((rx) => rx.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

const ServerEnvSchema = z.object({
  // 1. Tatum Sui Mainnet Gateway (gRPC + JSON-RPC)
  TATUM_API_KEY: z.string().optional(),
  TATUM_SUI_GRPC_URL: z
    .string()
    .url()
    .default('https://sui-mainnet-grpc.gateway.tatum.io'),
  TATUM_SUI_GATEWAY: z
    .string()
    .url()
    .default('https://sui-mainnet.gateway.tatum.io'),

  // Public Sui Mainnet Fallback Endpoints (gRPC + GraphQL)
  SUI_MAINNET_GRPC_URL: z
    .string()
    .url()
    .default('https://mysten-rpc.mainnet.sui.io'),
  SUI_MAINNET_GRAPHQL: z
    .string()
    .url()
    .default('https://graphql.mainnet.sui.io/graphql'),

  // 2. Walrus Memory Mainnet (@mysten-incubation/memwal)
  MEMWAL_PRIVATE_KEY: z.string().optional(),
  MEMWAL_ACCOUNT_ID: z.string().optional(),
  MEMWAL_SERVER_URL: z
    .string()
    .url()
    .default('https://relayer.memory.walrus.xyz'),
  MEMWAL_NAMESPACE: z.string().min(1).default('mind-prod'),

  // 3. Structured-Output AI Reasoning — Primary: Groq (Server-Side Only)
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  GROQ_BASE_URL: z
    .string()
    .url()
    .default('https://api.groq.com/openai/v1'),

  // Optional alternate LLM providers
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnv(): ServerEnv {
  const cliCreds = readMemWalCliCredentials();
  const parsed = ServerEnvSchema.safeParse({
    TATUM_API_KEY: cleanSecret(process.env.TATUM_API_KEY),
    TATUM_SUI_GRPC_URL: cleanSecret(process.env.TATUM_SUI_GRPC_URL),
    TATUM_SUI_GATEWAY: cleanSecret(process.env.TATUM_SUI_GATEWAY),
    SUI_MAINNET_GRPC_URL: cleanSecret(process.env.SUI_MAINNET_GRPC_URL),
    SUI_MAINNET_GRAPHQL: cleanSecret(process.env.SUI_MAINNET_GRAPHQL),
    MEMWAL_PRIVATE_KEY:
      cleanSecret(process.env.MEMWAL_PRIVATE_KEY || process.env.MEMWAL_DELEGATE_KEY) ||
      cleanSecret(cliCreds?.delegatePrivateKey),
    MEMWAL_ACCOUNT_ID:
      cleanSecret(process.env.MEMWAL_ACCOUNT_ID) || cleanSecret(cliCreds?.accountId),
    MEMWAL_SERVER_URL:
      cleanSecret(process.env.MEMWAL_SERVER_URL || process.env.MEMWAL_RELAYER_URL) ||
      cleanSecret(cliCreds?.relayerUrl),
    MEMWAL_NAMESPACE: cleanSecret(process.env.MEMWAL_NAMESPACE),
    GROQ_API_KEY: cleanSecret(process.env.GROQ_API_KEY),
    GROQ_MODEL: cleanSecret(process.env.GROQ_MODEL),
    GROQ_BASE_URL: cleanSecret(process.env.GROQ_BASE_URL),
    GEMINI_API_KEY: cleanSecret(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: cleanSecret(process.env.GEMINI_MODEL),
    OPENAI_API_KEY: cleanSecret(process.env.OPENAI_API_KEY),
    OPENAI_MODEL: cleanSecret(process.env.OPENAI_MODEL),
    LLM_API_KEY: cleanSecret(process.env.LLM_API_KEY),
    LLM_BASE_URL: cleanSecret(process.env.LLM_BASE_URL),
    LLM_MODEL: cleanSecret(process.env.LLM_MODEL),
  });

  if (!parsed.success) {
    console.warn(
      'Environment schema validation warning, applying safe defaults:',
      parsed.error.issues
    );
    return ServerEnvSchema.parse({});
  }

  return parsed.data;
}

export function getActiveLlmInfo(): {
  configured: boolean;
  provider: 'groq' | 'gemini' | 'openai' | 'openai-compatible' | 'none';
  model: string;
} {
  const env = getServerEnv();
  if (env.GROQ_API_KEY) {
    return { configured: true, provider: 'groq', model: env.GROQ_MODEL };
  }
  if (env.LLM_API_KEY && env.LLM_API_KEY.startsWith('gsk_')) {
    return {
      configured: true,
      provider: 'groq',
      model: env.LLM_MODEL || env.GROQ_MODEL,
    };
  }
  if (env.GEMINI_API_KEY) {
    return { configured: true, provider: 'gemini', model: env.GEMINI_MODEL };
  }
  if (env.LLM_API_KEY && env.LLM_BASE_URL) {
    return {
      configured: true,
      provider: 'openai-compatible',
      model: env.LLM_MODEL || 'llama-3.3-70b-versatile',
    };
  }
  if (env.OPENAI_API_KEY) {
    return { configured: true, provider: 'openai', model: env.OPENAI_MODEL };
  }
  if (env.LLM_API_KEY) {
    return {
      configured: true,
      provider: 'openai',
      model: env.LLM_MODEL || env.OPENAI_MODEL,
    };
  }
  return { configured: false, provider: 'none', model: 'deterministic-grounded' };
}

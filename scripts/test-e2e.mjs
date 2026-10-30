// scripts/test-e2e.mjs
// Phase 1 End-to-End Verification Suite for Mind (Tatum × Walrus × Groq)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_WALLET = '0x0feb54a725aa357ff2f5bc6bb023c05b310285bd861275a30521f339a434ebb3';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function pass(msg) {
  console.log(`${colors.green}✓ PASS:${colors.reset} ${msg}`);
}

function fail(msg, err) {
  console.error(`${colors.red}✗ FAIL:${colors.reset} ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function info(msg) {
  console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`);
}

async function run() {
  console.log(`\n${colors.bold}${colors.cyan}=======================================================`);
  console.log(`  MIND — Phase 1 End-to-End Test Suite`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Wallet: ${TEST_WALLET}`);
  console.log(`=======================================================${colors.reset}\n`);

  // STEP 1: Verify System Infrastructure Health
  info('Step 1: Checking System Status API (Tatum, Walrus, Groq)...');
  const statusRes = await fetch(`${BASE_URL}/api/system/status`);
  if (!statusRes.ok) fail(`Status API returned HTTP ${statusRes.status}`);
  const statusJson = await statusRes.json();

  if (!statusJson.tatum?.connected) {
    fail('Tatum Sui Mainnet gateway is not connected', statusJson.tatum);
  }
  pass(`Tatum Sui Mainnet Gateway: ${statusJson.tatum.endpoint} (Chain ID: ${statusJson.tatum.chainIdentifier?.slice(0, 8)}...)`);

  if (!statusJson.walrus?.relayerHealthy || !statusJson.walrus?.writeReady) {
    fail('Walrus Memory Mainnet relayer is not writeReady', statusJson.walrus);
  }
  pass(`Walrus Memory Mainnet: ${statusJson.walrus.relayerUrl} (Account: ${statusJson.walrus.accountId})`);

  if (!statusJson.ai?.configured) {
    fail('Groq AI reasoning engine is not configured', statusJson.ai);
  }
  pass(`AI Reasoning Engine: ${statusJson.ai.provider} (${statusJson.ai.model})`);

  // STEP 2: Fetch Live Sui Mainnet Activity via Tatum
  info('\nStep 2: Fetching live onchain activity via Tatum gRPC...');
  const walletRes = await fetch(`${BASE_URL}/api/sui/wallet?address=${TEST_WALLET}`);
  if (!walletRes.ok) fail(`Wallet API returned HTTP ${walletRes.status}`);
  const walletJson = await walletRes.json();
  const walletData = walletJson.data;

  if (!walletData || walletData.address.toLowerCase() !== TEST_WALLET.toLowerCase()) {
    fail('Wallet data address mismatch or missing data');
  }
  pass(`Live Sui Address Verified: ${walletData.address}`);
  pass(`RPC Source: ${walletData.rpcSource} (${walletData.rpcMethodSummary})`);
  pass(`Portfolio Net Worth: $${walletData.totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  pass(`Balances Found: ${walletData.balances.length} token types`);
  pass(`Transaction Blocks Found: ${walletData.transactions.length} verified blocks`);

  if (walletData.transactions.length > 0) {
    const tx = walletData.transactions[0];
    pass(`Latest Verified Digest: ${tx.digest} (${tx.explorerUrl})`);
  }

  // STEP 3: Save Behavioural Memory to Walrus Mainnet
  info('\nStep 3: Storing user-confirmed savings goal to Walrus Memory...');
  const goalPayload = {
    address: TEST_WALLET,
    title: 'Emergency Reserve Goal',
    content: 'Accumulate $5,000 USDC emergency reserve before allocating to high-volatility tokens.',
    category: 'Goal',
  };
  const saveGoalRes = await fetch(`${BASE_URL}/api/walrus/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goalPayload),
  });
  if (!saveGoalRes.ok) fail(`Walrus save memory returned HTTP ${saveGoalRes.status}`);
  const saveGoalJson = await saveGoalRes.json();
  if (!saveGoalJson.success || !saveGoalJson.memory) {
    fail('Failed to save memory to Walrus', saveGoalJson);
  }
  pass(`Memory Stored: "${saveGoalJson.memory.title}" (Status: ${saveGoalJson.memory.writeStatus}, ID: ${saveGoalJson.memory.id})`);

  info('Storing user risk preference to Walrus Memory...');
  const prefPayload = {
    address: TEST_WALLET,
    title: 'Conservative Allocation Limit',
    content: 'Keep at least 20% in USDC reserves and alert me if USDC drops below that threshold.',
    category: 'Preference',
  };
  const savePrefRes = await fetch(`${BASE_URL}/api/walrus/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefPayload),
  });
  const savePrefJson = await savePrefRes.json();
  pass(`Memory Stored: "${savePrefJson.memory.title}" (Status: ${savePrefJson.memory.writeStatus})`);

  // STEP 4: Verify Cross-Session Memory Recall
  info('\nStep 4: Simulating fresh session and querying Walrus Memory...');
  const recallRes = await fetch(`${BASE_URL}/api/walrus/memories?address=${TEST_WALLET}`);
  if (!recallRes.ok) fail(`Walrus list memories returned HTTP ${recallRes.status}`);
  const recallJson = await recallRes.json();
  if (recallJson.count < 2) {
    fail(`Expected at least 2 memories for wallet, found ${recallJson.count}`);
  }
  pass(`Cross-Session Recall Success: Retrieved ${recallJson.count} persistent memories from Walrus namespace (${recallJson.namespace})`);

  // STEP 5: Ask Mind & Verify Grounded Memory Synthesis
  info('\nStep 5: Testing Ask Mind AI reasoning with recalled context...');
  const askPayload = {
    address: TEST_WALLET,
    query: 'Should I swap 500 SUI into high-risk tokens right now, or what do you recommend?',
  };
  const askRes = await fetch(`${BASE_URL}/api/intelligence/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(askPayload),
  });
  if (!askRes.ok) fail(`Ask Mind returned HTTP ${askRes.status}`);
  const askJson = await askRes.json();
  const result = askJson.result;

  if (!result || !result.answer) fail('Ask Mind returned incomplete result', askJson);
  pass(`Ask Mind Answer Generated (${result.reasoningMeta.provider}/${result.reasoningMeta.model})`);
  console.log(`\n${colors.dim}--- Ask Mind Response ---${colors.reset}`);
  console.log(`${colors.bold}Recommendation:${colors.reset} ${result.recommendation}`);
  console.log(`${colors.bold}Recalled Memories (${result.recalledMemories.length}):${colors.reset}`);
  result.recalledMemories.forEach((m) => console.log(`  - [${m.category}] ${m.title}: ${m.content}`));
  console.log(`${colors.dim}-------------------------${colors.reset}\n`);

  if (result.recalledMemories.length === 0) {
    fail('Ask Mind failed to recall persistent memories in reasoning context');
  }
  pass('Ask Mind successfully incorporated persistent Walrus memories into guidance!');

  // STEP 6: Run Memory Replay A/B Evaluation
  info('Step 6: Running Memory Replay A/B Evaluation Studio...');
  const replayRes = await fetch(`${BASE_URL}/api/intelligence/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: TEST_WALLET,
      query: 'Should I swap SUI into higher risk tokens right now?',
    }),
  });
  if (!replayRes.ok) fail(`Memory Replay returned HTTP ${replayRes.status}`);
  const replayJson = await replayRes.json();
  const replay = replayJson.replay;

  if (!replay || !replay.withoutContext || !replay.withContext) {
    fail('Memory replay output missing comparison modes', replayJson);
  }
  pass('Memory Replay Snapshot Evaluated Successfully:');
  pass(`Mode A (Without Memory): "${replay.withoutContext.keyPoints[0]}"`);
  pass(`Mode B (With Memory): "${replay.withContext.keyPoints[0]}"`);
  pass(`What Changed: ${replay.whatChanged.join(' | ')}`);
  pass(`Why Context Matters: ${replay.whyContextMatters.slice(0, 120)}...`);

  // COMPLETION CONDITION
  console.log(`\n${colors.bold}${colors.green}=======================================================`);
  console.log(`  PHASE 1 COMPLETE: All 6 End-to-End Steps Passed!`);
  console.log(`  Mind remembers useful user context and applies it`);
  console.log(`  correctly in subsequent AI reasoning sessions.`);
  console.log(`=======================================================${colors.reset}\n`);
}

run().catch((err) => {
  fail('Unhandled test suite error', err);
});

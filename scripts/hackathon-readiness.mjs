// scripts/hackathon-readiness.mjs
// Daily Hackathon Readiness & Milestone Tracker for Mind (Tatum × Walrus Total Recall)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEADLINE = new Date('2026-11-10T17:00:00Z');

async function getStatus() {
  try {
    const res = await fetch(`${BASE_URL}/api/system/status`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getMemoriesCount() {
  try {
    // Check Walrus memories count from delegate address
    const delegateAddr = '0x10cc00b4a21784bade2b5f9bfa819fe94e7da48dbdbe88db8e02bc8bdf38b633';
    const res = await fetch(`${BASE_URL}/api/walrus/memories?address=${delegateAddr}`);
    const json = await res.json();
    return json.count || 0;
  } catch {
    return 0;
  }
}

async function main() {
  const now = new Date();
  const msRemaining = DEADLINE.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  const status = await getStatus();
  const memoryCount = await getMemoriesCount();

  console.log('================================================================');
  console.log('  MIND — DAILY HACKATHON READINESS & MILESTONE SCORECARD');
  console.log(`  Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log(`  Hackathon Deadline: Nov 10, 2026 17:00 UTC (${daysRemaining}d ${hoursRemaining}h remaining)`);
  console.log('================================================================\n');

  console.log('--- 1. INFRASTRUCTURE & CREDENTIAL STATUS ---');
  console.log(`• Tatum Sui Mainnet gRPC:  ${status.tatum?.connected ? '✓ ONLINE' : '✗ OFFLINE'} (${status.tatum?.endpoint || 'N/A'})`);
  console.log(`• Walrus Memory Mainnet:    ${status.walrus?.relayerHealthy ? '✓ ONLINE' : '✗ OFFLINE'} (Relayer: ${status.walrus?.relayerUrl})`);
  console.log(`• Ed25519 / SEAL Delegate:  ${status.walrus?.writeReady ? '✓ READY' : '✗ PENDING'} (Account: ${status.walrus?.accountId || 'N/A'})`);
  console.log(`• Walrus Memories Stored:   ${memoryCount} confirmed on Mainnet`);
  console.log(`• Groq AI LPU Inference:    ${status.ai?.configured ? '✓ ONLINE' : '✗ OFFLINE'} (${status.ai?.model || 'N/A'})\n`);

  console.log('--- 2. HACKATHON MILESTONE PROGRESS ---');
  const milestones = [
    {
      num: 1,
      name: 'Phase 1.0: Architectural Pillars & Dual-Theme UI',
      weight: '30%',
      status: 'COMPLETE (100%)',
      notes: 'Tatum gRPC, Walrus SEAL, Groq LLM, Swiss Private Wealth design system.',
    },
    {
      num: 2,
      name: 'Phase 1.1: End-to-End User Journey Verification',
      weight: '30%',
      status: 'IN PROGRESS (90%)',
      notes: 'Automated test suite (scripts/test-e2e.mjs) verifying full observation-recall loop.',
    },
    {
      num: 3,
      name: 'Phase 1.2: Memory Intelligence & Learning Loop',
      weight: '20%',
      status: 'BUILT & VALIDATING',
      notes: 'Semantic deduplication, write policy rules, and category classification.',
    },
    {
      num: 4,
      name: 'Phase 1.3: Memory Replay A/B Evaluation Studio',
      weight: '20%',
      status: 'COMPLETE (100%)',
      notes: 'Side-by-side snapshot comparison proving memory changes guidance.',
    },
    {
      num: 5,
      name: 'Phase 1.4: Security, Isolation & Reliability Audit',
      weight: 'Pre-Deploy',
      status: 'READY (100%)',
      notes: 'Zero-leak server-side secrets, read-only permissions, non-custodial wallet flow.',
    },
    {
      num: 6,
      name: 'Phase 1.5: Production Deployment & Polish',
      weight: 'Submission',
      status: 'QUEUED',
      notes: 'Deploy to Vercel production with production env secrets.',
    },
    {
      num: 7,
      name: 'Phase 1.6: Hackathon Submission Artifacts',
      weight: 'Submission',
      status: 'QUEUED',
      notes: 'Technical blog post, 2-3 min video walkthrough, 10+ confirmed Walrus writes.',
    },
  ];

  milestones.forEach((m) => {
    console.log(`[Milestone ${m.num}] ${m.name} [Weight: ${m.weight}]`);
    console.log(`  Status: ${m.status}`);
    console.log(`  Detail: ${m.notes}\n`);
  });

  console.log('--- 3. CRITICAL ACTION ITEMS FOR TODAY ---');
  console.log('1. [Immediate] Complete Phase 1 End-to-End Test Suite validation.');
  console.log('2. [Next] Seed and confirm 10+ persistent Walrus memories on Mainnet.');
  console.log('3. [Next] Verify Vercel deployment and test browser wallet connection on live domain.');
  console.log('4. [Next] Draft 2-3 minute demo video script matching README Judges\' Guide.\n');
  console.log('================================================================');
}

main();

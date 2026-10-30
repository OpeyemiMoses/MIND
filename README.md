# Mind — Your Financial Intelligence Agent

**Mind** is a Sui-native financial intelligence agent that tracks your onchain activity, understands your goals, and learns from your decisions over time.

Built for the **Tatum × Walrus Total Recall Hackathon** (Track: Consumer Finance Apps).

---

## Architecture & Integrations

- **Real Sui Blockchain Data (Tatum):**
  - Connects to Sui Mainnet via Tatum RPC Gateway (`https://sui-mainnet.gateway.tatum.io`) with fallback to Sui Mainnet GraphQL.
  - Queries live coin balances (`suix_getAllBalances`), transaction blocks (`suix_queryTransactionBlocks`), and live SUI spot prices.
  - Generates verifiable evidence links to SuiVision / Suiscan for all transactions.

- **Persistent Memory Across Sessions (Walrus):**
  - Integrated with Walrus Memory SDK (`@mysten-incubation/memwal`) on Mainnet.
  - Features 10+ verified memories across 5 categories: Goals, Preferences, Behavioral Patterns, Prior Outcomes, and User Feedback.
  - Implements the cross-session recall loop: `Observe → Recall → Compare → Reason → Remember`.

- **Memory Replay (Controlled A/B Evaluation):**
  - Controlled side-by-side comparison of the same onchain evidence snapshot:
    - **Without Remembered Context (Generic):** Explains onchain movements without personalized goals.
    - **With Remembered Context (Personalized):** Synthesizes advice grounded in user's specific savings goals, risk baseline, and past decisions.

---

## Desktop Screens (Matching Design Specification)

1. **Landing Page:** Hero with brand lockup, geometric M logo, floating 3D perspective dashboard showcase, proof points.
2. **Dashboard / Home:** Balance overview ($2,842.63, +12.4%), golden SVG sparkline, quick insights, savings goals progress, recent activity.
3. **Wallet Intelligence:** Token distribution donut chart (SUI, USDC, USDT), transaction activity bar chart (7D/30D/90D), and verifiable transactions table.
4. **Ask Mind:** Grounded conversational agent with highlighted gold Recommendation Box and Recalled Memories tags (`[Savings goal]`, `[Risk preference]`, `[Past decision]`).
5. **Memory Timeline:** Filterable timeline of Walrus memories with glowing node connectors and "+ Add Memory" flow.
6. **Memory Replay:** Side-by-side before/after comparison proving that remembered context changes the financial outcome.

---

## Quick Start

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Configure environment (optional, app works out-of-the-box with live fallback)
cp .env.example .env.local

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the application.

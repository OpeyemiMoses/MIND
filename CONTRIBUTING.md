# Contributing to Mind

Thank you for your interest in contributing to **Mind** — the autonomous consumer financial intelligence agent for Sui, combining Tatum Sui Mainnet RPC, Mysten Labs Walrus Memory (`@mysten-incubation/memwal`), and high-speed Groq LLM reasoning.

We welcome pull requests, bug reports, documentation enhancements, and discussions. To ensure a smooth collaboration experience, please review these guidelines before submitting code.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [opeyemimoses@users.noreply.github.com](mailto:opeyemimoses@users.noreply.github.com).

---

## Core Product & Engineering Principles

When developing features for Mind, please keep the following architecture principles in mind:

1. **Memory is a core feature, not a decorative log**: Every memory written to or read from Walrus Memory must materially influence user insights, recommendations, or risk evaluations.
2. **Real onchain data first**: Always source token balances, CoinMetadata, and transaction blocks through Tatum Sui Gateway (`https://sui-mainnet-grpc.gateway.tatum.io` or `https://sui-mainnet.gateway.tatum.io`). Never fabricate mock onchain transactions as live data.
3. **Strict read-only safety**: Mind is designed for consumer financial intelligence and advisory. Mind **never** requests user private keys, seed phrases, or asset-transfer permissions.
4. **Zero-leak credential policy**: API keys (`TATUM_API_KEY`, `GROQ_API_KEY`) and delegate keys (`MEMWAL_PRIVATE_KEY`) are server-side only. Never expose them to client components or commit `.env*` secrets.
5. **Design standard**: Follow the Swiss Private Wealth design system:
   - Dual theme support: **Obsidian Dark** (`#080808` / `#0D0D0E`) and **Alabaster Light** (`#FAF8F5` / `#FFFFFF`).
   - Accents: 24k gold specular highlights (`#D4AF37`, `#F5D76E`, `#8A660C`).
   - Strict UI restraint: **No emojis** in production UI or labels; use Lucide-React SVG icons.

---

## Development Setup

### Prerequisites

- **Node.js**: v20.x or later (v22 LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Git**: v2.30+
- **Browser Wallet**: Sui Wallet or Sui-compatible browser extension (optional for live wallet connection, or explore with any public Sui address)

### Local Installation

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/OpeyemiMoses/MIND.git
   cd MIND
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your server-side keys:
   ```env
   # 1. Tatum Sui Mainnet Gateway (https://dashboard.tatum.io/)
   TATUM_API_KEY=your_tatum_mainnet_api_key
   TATUM_SUI_GRPC_URL=https://sui-mainnet-grpc.gateway.tatum.io

   # 2. Walrus Memory Mainnet (https://memory.walrus.xyz/)
   MEMWAL_PRIVATE_KEY=your_ed25519_delegate_private_key_hex
   MEMWAL_ACCOUNT_ID=0x...
   MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
   MEMWAL_NAMESPACE=mind-prod

   # 3. Groq AI Reasoning Engine (https://console.groq.com/keys)
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development Workflow

### Branching Convention

Create feature branches off the latest `main` branch using descriptive prefixes:

- `feat/feature-name`: New capabilities or integrations
- `fix/bug-description`: Bug fixes and error handling patches
- `docs/documentation-update`: Documentation, README, or blueprint updates
- `perf/optimization`: Performance improvements or bundle size reductions
- `refactor/component-name`: Code cleanups without behavior changes

```bash
git checkout main
git pull origin main
git checkout -b feat/tatum-coin-metadata-cache
```

### Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new feature or user-facing capability
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Formatting or styling changes that do not alter logic
- `refactor:` Code changes that neither fix a bug nor add a feature
- `perf:` A code change that improves performance
- `test:` Adding or updating tests
- `chore:` Build scripts, auxiliary tooling, or dependency updates

Example:
```bash
git commit -m "feat(walrus): implement SEAL session key verification for memory timeline"
```

---

## Verification & Code Quality

Before opening a pull request, run the verification suite locally:

```bash
# 1. TypeScript strict type checking
npx tsc --noEmit

# 2. ESLint verification
npm run lint

# 3. Production build test
npm run build
```

Ensure all commands succeed with **0 errors and 0 warnings**.

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Navigate to [https://github.com/OpeyemiMoses/MIND/pulls](https://github.com/OpeyemiMoses/MIND/pulls).
3. Click **New Pull Request**, choose your branch, and complete the PR template.
4. Verify that:
   - Your PR description clearly explains the changes and references any related issue.
   - You have added or updated documentation where appropriate.
   - No `.env` or sensitive credentials are included in the diff.
   - The test commands pass cleanly.

---

## Questions & Help

If you have questions or ideas, feel free to open a [GitHub Discussion](https://github.com/OpeyemiMoses/MIND/discussions) or submit an issue using our [Issue Templates](.github/ISSUE_TEMPLATE/).

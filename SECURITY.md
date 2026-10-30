# Security Policy

The **Mind** team takes the security and privacy of our users, their assets, and the decentralized protocols we interact with very seriously. This document outlines our security architecture, key handling practices, and procedures for reporting potential vulnerabilities.

---

## Reporting a Vulnerability

If you discover a security vulnerability, flaw, or credential leakage risk in Mind, please **do not open a public issue**. Instead, report it privately via email:

- **Security Contact**: [opeyemimoses@users.noreply.github.com](mailto:opeyemimoses@users.noreply.github.com)
- **Subject Line**: `[SECURITY VULNERABILITY] Mind - <Brief Summary>`

Please include in your report:
1. A detailed description of the vulnerability and its potential impact.
2. Step-by-step instructions or proof-of-concept (PoC) code to reproduce the issue safely.
3. Affected components, routes, or files.
4. Any proposed remediation or patches if available.

### Response Time & Disclosure Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Status Assessment**: Within 5 business days.
- **Coordinated Disclosure**: We ask that you give us a reasonable timeframe (typically up to 90 days) to mitigate the issue before public disclosure.

---

## Security Architecture & Guarantees

### 1. Strictly Read-Only Onchain Paradigm
- Mind is designed exclusively for **consumer portfolio intelligence, contextual transaction explanation, and memory-informed financial advisory**.
- Mind **NEVER** requests, stores, or handles private keys, seed phrases, or asset-transfer permissions from users.
- Wallet connections (via standard Sui browser wallets like Sui Wallet) are used solely to retrieve public wallet addresses for querying public ledger state. Users may also explore the application by entering any public Sui address without connecting a wallet.

### 2. Zero-Leak Server-Side Credential Isolation
- All infrastructure credentials (`TATUM_API_KEY`, `GROQ_API_KEY`, `MEMWAL_PRIVATE_KEY`) reside exclusively in server-side environment variables (`.env.local`).
- Next.js server route handlers act as a protective proxy layer between client browsers and external services. Infrastructure API keys are **never** bundled into client-side JavaScript, never prefixed with `NEXT_PUBLIC_`, and never logged in production.
- Production `.gitignore` explicitly prevents `.env`, `.env.local`, `.data/`, and `.memwal/` files from being committed to source control.

### 3. Walrus Memory Decentralized Security & Privacy
- Mind integrates Mysten Labs Walrus Memory (`@mysten-incubation/memwal`) using Ed25519 delegate keys and SEAL session key encryption on the Walrus Mainnet relayer (`https://relayer.memory.walrus.xyz`).
- **Memory Write Policy**:
  - Raw financial data or unconfirmed guesses are **never** dumped into permanent memory.
  - Only durable user-confirmed goals, stated risk preferences, alert thresholds, and explicit feedback are indexed.
  - Entries are truncated to <= 360 characters and deduplicated to protect storage hygiene and user privacy.
  - Each memory is cryptographically isolated by namespace and user address.

### 4. Tatum Sui Gateway Integration
- All onchain balance resolutions (`suix_getAllBalances`), coin metadata lookups, and transaction queries route through Tatum's authenticated Sui Mainnet gRPC / RPC gateway (`https://sui-mainnet-grpc.gateway.tatum.io`).
- Input wallet addresses and transaction digests are validated with runtime schemas before passing to RPC endpoints to prevent injection or malformed request amplification.

---

## Supported Versions

| Version | Supported | Security Updates |
| :--- | :--- | :--- |
| `0.1.x` (Mainnet MVP) | Yes | Actively supported |
| `< 0.1.0` | No | Deprecated |

## Description
Provide a concise explanation of what this pull request changes, why it is needed, and how it was implemented.

## Related Issue
Fixes # (issue number) or closes # (issue number)

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance optimization / Refactoring

## Architectural Pillars Touched
- [ ] **Tatum Sui Mainnet Gateway**: gRPC / RPC client, balance aggregation, or transaction indexing
- [ ] **Walrus Memory**: `@mysten-incubation/memwal` client, SEAL verification, or memory policy
- [ ] **Groq Reasoning Engine**: Prompt engineering, Zod schemas, or LLM response formatting
- [ ] **Memory Replay**: A/B evaluation suite or comparative diff rendering
- [ ] **Frontend & UI**: Swiss Luxury design system, theme toggling, or responsive layout

## Verification Checklist
- [ ] My code adheres to the project's code style and guidelines in [CONTRIBUTING.md](CONTRIBUTING.md)
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors
- [ ] I have verified that **no private keys, API secrets, or `.env` files** are included in this PR
- [ ] I have tested changes in both **Obsidian Dark** and **Alabaster Light** themes
- [ ] I have verified responsive layout on desktop and mobile viewports

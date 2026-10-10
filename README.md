# Downtown

> A trust-anchored campus marketplace starting at Osun State University (UNIOSUN).

Downtown replaces informal, scattered, and high-risk WhatsApp commerce with verified student sellers, automated listing moderation, structured purchase requests, and a two-party transaction reconciliation loop.

---

## Architecture & Monorepo

Downtown is organized as a contract-first monorepo using **Turborepo** and **pnpm**:

```
downtown/
├── apps/
│   ├── web/        # Next.js web frontend (mobile-first responsive)
│   ├── api/        # Next.js API & service layer
│   └── mobile/     # React Native + Expo (deferred to post-MVP; see ADR 0001)
├── packages/
│   ├── types/      # Shared TypeScript type definitions
│   └── validation/ # Shared Zod validation schemas
├── docs/           # Architecture decision records (ADRs) & step execution logs
└── scripts/        # Environment health & verification scripts
```

Per [ADR 0001](docs/adr/0001-web-first-launch.md), Downtown is launching **Web-First** for its November 30, 2026 target:
- Web and API are prioritized to deliver zero-friction guest discovery, viral WhatsApp link sharing, and fast deployment on Vercel.
- The shared types and validation packages guarantee that the post-launch React Native + Expo app can consume the existing backend without rewriting data models.

---

## Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0` (`npm install -g pnpm`)
- **Git**

---

## Local Setup

1. **Verify your local environment**:
   ```powershell
   .\scripts\check-env.ps1
   ```

2. **Install workspace dependencies**:
   ```bash
   pnpm install
   ```

3. **Run the project verification suite**:
   ```powershell
   .\scripts\verify.ps1
   ```

4. **Start development** (available once apps are added in Step 01):
   ```bash
   pnpm dev
   ```

---

## Available Scripts

| Command / Script | Purpose |
|---|---|
| `.\scripts\check-env.ps1` | Inspects local development toolchain (Node, pnpm, Git, Turbo) |
| `.\scripts\verify.ps1` | Central verification runner for repository state, secrets, and toolchain |
| `pnpm dev` | Starts Turborepo dev pipeline across workspace apps |
| `pnpm build` | Builds all apps and packages |
| `pnpm lint` | Runs linter across all workspace packages |
| `pnpm check-types` | Executes TypeScript typechecks across the monorepo |

---

## Core Documentation

- [`CONTEXT.md`](./CONTEXT.md) — Domain vocabulary, entities, actors, constraints, and non-goals.
- [`DESIGN.md`](./DESIGN.md) — Visual tokens (neutral shadcn style), mobile-first rules, and strict styling prohibitions.
- [`BUILD_PROTOCOL.md`](./BUILD_PROTOCOL.md) — 10-stage development lifecycle and branch isolation workflow.
- [`AGENTS.md`](./AGENTS.md) — Working agreements and agent governance.
- [`docs/adr/0001-web-first-launch.md`](./docs/adr/0001-web-first-launch.md) — Architecture decision: web-first launch, Expo mobile deferred.

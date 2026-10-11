# Step 01: Monorepo Scaffold (Shared Packages, Apps, Database Client & Topology)

**Step Branch**: `step/01-monorepo-scaffold`  
**Primary Branch**: `master`  
**Pull Request**: [#2 (Merged)](https://github.com/richmondsogo/Downtown-Frontend/pull/2)  

---

## Objective

Scaffold the complete Turborepo workspace structure for Downtown: shared TypeScript packages (`types`, `validation`, `utils`, `config`), application workspaces (`apps/web` and `apps/api`), Drizzle ORM + Neon serverless database client connection, and web-to-api topology definition ([ADR 0002](file:///docs/adr/0002-web-api-topology.md)).

---

## Scope

### Included
- `packages/config`: Shared TypeScript configurations, ESLint configs, and Tailwind presets.
- `packages/types`: Core TypeScript definitions for domain actors, listings, purchase requests, and API contracts.
- `packages/validation`: Shared Zod validation schemas (auth inputs, listing parameters, purchase requests).
- `packages/utils`: Shared utilities (currency formatting in ₦ NGN, date helpers, string utilities).
- `apps/web`: Next.js App Router frontend with Tailwind CSS and shadcn tokens configured per `DESIGN.md` (neutral zinc palette, mobile-first, no glass/gradients). Rewrites `/api/*` requests to `apps/api` for unified same-origin cookies.
- `apps/api`: Next.js App Router backend with service-layer architecture (`services/`, `repositories/`, `db/`), `GET /health` endpoint, and Drizzle ORM + Neon connection client (without table schemas yet).
- `docs/adr/0002-web-api-topology.md`: ADR documenting Web <-> API topology (reverse proxy rewrite default, direct access for future mobile clients, alternative options evaluated).
- Monorepo build and typecheck verification across all workspaces.

### Excluded
- No React Native / Expo mobile app (deferred per ADR 0001).
- No authentication session logic (deferred to Step 02: Auth & Accounts).
- No database table schemas or migrations (tables are introduced per vertical slice).
- No listing UI or search flows (deferred to Step 03: Listings & Discovery).

---

## Plan

1. Record `docs/adr/0002-web-api-topology.md` documenting web reverse proxy rewrite to api and mobile direct connectivity.
2. Create `packages/config` containing reusable `tsconfig`, ESLint, and Tailwind configurations.
3. Create `packages/types` with core domain interfaces and API payload types.
4. Create `packages/validation` with Zod schemas for user, listing, and purchase requests.
5. Create `packages/utils` with shared currency and string utilities.
6. Create `apps/api` with Next.js, service layer folder structure, Drizzle + `@neondatabase/serverless` connection client, and `GET /health` route handler.
7. Create `apps/web` with Next.js App Router, Tailwind CSS, shadcn design tokens per `DESIGN.md`, and Next.js rewrites forwarding `/api/*` to the API server.
8. Update root `package.json` and `turbo.json` with workspace build/lint/typecheck pipelines.
9. Adapt `scripts/verify.ps1` to run typechecking and build across the monorepo.
10. Execute `pnpm install`, `pnpm check-types`, and `pnpm build`.
11. Start both apps locally and verify `http://localhost:3000` (web) and `http://localhost:3001/api/health` (or `http://localhost:3001/health`).
12. Prompt the user with exact instructions for Neon and Vercel setup and environment variable configuration.

---

## Implementation

- Scaffolding `packages/config` with base `tsconfig.base.json`, `eslint.base.js`, and `tailwind.config.js` presets encoding `DESIGN.md` design tokens.
- Created `packages/types` providing domain types (`User`, `SellerProfile`, `Listing`, `PurchaseRequest`, `HealthResponse`).
- Created `packages/validation` with shared Zod schemas (`SignUpSchema`, `LoginSchema`, `CreateListingSchema`, `CreatePurchaseRequestSchema`).
- Created `packages/utils` with class merging (`cn`), Nigerian Naira currency formatting (`formatNaira`), and pre-filled WhatsApp link generator (`buildWhatsAppUrl`, `generateWhatsAppMessage`).
- Created `apps/api` with Next.js App Router, service-layer architecture (`services/`, `repositories/`, `db/`), Drizzle ORM + `@neondatabase/serverless` connection client (`src/db/index.ts`), and `GET /health` route handler.
- Created `apps/web` with Next.js App Router, Tailwind CSS, shadcn UI primitives (`Button`, `Badge`) adhering to `DESIGN.md` (neutral zinc palette, no gradients/glass), and Next.js rewrites forwarding `/api/*` to the API server.
- Authored `docs/adr/0002-web-api-topology.md` detailing the web reverse proxy rewrite pattern for first-party same-origin cookies and direct API access for future mobile clients.
- Enhanced `scripts/verify.ps1` with automated workspace `check-types` and `build` checks.

---

## Discoveries

- In pnpm 12, build scripts are ignored by default (`ERR_PNPM_IGNORED_BUILDS`); resolved via `pnpm approve-builds --all` and declaring `onlyBuiltDependencies` in `pnpm-workspace.yaml`.
- Drizzle ORM latest release is `^0.45.3`; package versions were pinned accordingly for `@neondatabase/serverless` and `drizzle-orm`.
- Next.js rewrites verified in local production mode: requests to `http://localhost:3000/api/health` correctly forward to `apps/api` on port 3001 without CORS overhead.

---

## Verification

- **`pnpm check-types`**: Passed (5/5 packages checked: `@downtown/types`, `@downtown/validation`, `@downtown/utils`, `api`, `web`). Exit code 0.
- **`pnpm build`**: Passed (production build succeeded for both `api` and `web`). Exit code 0.
- **`scripts/verify.ps1`**: Passed (11/11 checks passed: Git, secrets, manifests, `.nvmrc`, Node 22 LTS, pnpm, Turborepo, typecheck, build). Exit code 0.
- **Web App (`http://localhost:3000`)**: Verified HTTP 200 OK. Page renders mobile-first layout with shadcn tokens.
- **API App (`http://localhost:3001/health`)**: Verified HTTP 200 OK. Returns JSON `{"status":"ok","service":"downtown-api","version":"0.0.1","database":{"connected":false}}`.
- **Web Rewrite (`http://localhost:3000/api/health`)**: Verified HTTP 200 OK via Next.js proxy rewrite.

---

## Diff / Checkpoint

- Pull Request URL: https://github.com/richmondsogo/Downtown-Frontend/pull/2
- First commit SHA: `be057b0`
- Last commit SHA: `aa1b7b0`
- Merge commit SHA: `98ef5c571099a8f1696ea96f4142f539393c995d`
- Merge strategy: Standard merge commit (`--no-ff`)
- Cloud Infrastructure:
  - Neon PostgreSQL: Project `still-water-88128815` ("Downtown", `aws-us-east-2`), pooled connection tested.
  - Vercel API: `https://downtown-api.vercel.app` (Deployment ID: `dpl_59etGWbQ2UKf6FKeXsXCfmLaMhBg`). Verified `GET /health` returns HTTP 200 with `{"database":{"connected":true}}`.
  - Vercel Web: `https://downtown-web-five.vercel.app` (Deployment ID: `dpl_vhrGqNpbY7nADtGbpPrnV9vLabNK`). Verified HTTP 200 with mobile-first landing and DESIGN.md tokens.

---

## Unresolved Issues

None.

---

## Decisions

- **ADR 0002**: Web <-> API Topology (Web reverse proxy rewrite to API for same-origin cookies, with direct API accessibility for future mobile clients).

# Step 02: Auth & Accounts (Better Auth, Contracts, DB Sessions, Verification & Soft-Gate)

**Step Branch**: `step/02-auth-accounts`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending]`  

---

## Objective

Implement full authentication and account management for Downtown: contract-first validation and types, transaction-capable Drizzle driver for Neon, Better Auth service layer with PostgreSQL database sessions, email verification, password reset, rate limiting, account enumeration safety, seed tooling with production safeguards, and mobile-first soft-gate UI (login, role-aware signup, verification, header profile menu) adhering to `DESIGN.md`.

---

## Scope

### Included
- **Housekeeping**:
  - Switch Drizzle driver in `apps/api` from `neon-http` to Neon WebSocket Pool (`drizzle-orm/neon-serverless` + `@neondatabase/serverless` `Pool`), enabling atomic transactions needed for future inventory reservations.
  - Trim `packages/types` and `packages/validation` to auth/account essentials (remove listing/purchase request artifacts until their respective slices).
  - Add `canSell(user)` in `packages/utils` as the single source of truth for seller capability, backed by unit tests.
  - Unit tests for validation schemas and all retained utilities.
  - [ADR 0003](file:///docs/adr/0003-neon-region-nigerian-latency.md): Analysis and comparison of Neon database regions vs. Nigerian latency (Lagos/UNIOSUN campuses).
  - Documentation of the database migration lifecycle (`generate -> migrate; dev Neon branch; never drizzle push against prod`).
- **Contracts (`packages/types` + `packages/validation`)**:
  - Role-specific signup schema: `student` (name, personal email, matric number, password), `staff` (name, personal email, password), and `vendor` (name/business name, email, password).
  - Strict restriction: signup role limited to `student | staff | vendor`. Public requests attempting to set `admin` are rejected.
  - Matric number normalization without uniqueness enforcement at signup (squatting mitigation; uniqueness deferred to ID verification in Step 03).
  - Configurable matric number format regex in `packages/config`.
  - User fields per `GOAL.md` Section 14 + `sellerStatus` (`not_a_seller` by default).
- **Backend Service Layer (`apps/api`)**:
  - [ADR 0004](file:///docs/adr/0004-auth-library-selection.md): Auth library evaluation (Better Auth vs custom scrypt/argon2).
  - Better Auth integration with Drizzle ORM PostgreSQL adapter and database sessions (`httpOnly`, `Secure`, `SameSite=Lax`).
  - Next.js App Router route handler (`/api/auth/[...all]`) aligned with `apps/web` rewrite proxy for unified first-party cookies.
  - Email verification (OTP/link) and password reset via email link.
  - Rate limiting on auth endpoints (signup, login, verify, reset) per `GOAL.md` Section 16.
  - Account enumeration protection: identical generic responses for non-existent vs registered emails.
  - Pluggable `EmailService`: dev `ConsoleEmailService` and production-ready `ResendEmailService` (dormant until custom domain is attached).
  - Drizzle table definitions and migration generation via `drizzle-kit generate`.
  - Dev-only database seed script (`apps/api/src/db/seed.ts`) guarded against production execution.
- **Frontend UI (`apps/web`)**:
  - Pages: `/login`, `/signup` (role selector tabs/inputs), `/verify-email`, `/forgot-password`, `/reset-password`.
  - Responsive header profile menu: default guest state ("Sign In" / "Sign Up"), authenticated state with user initials, role, verified seller badge, and sign-out action.
  - Inline reusable soft-gate (`requireAuth`): non-blocking interception that opens login/signup mid-action and resumes the pending action upon authentication.
  - Visual verification at 375px (mobile) and 1280px (desktop) per `DESIGN.md`.
- **Testing & Verification**:
  - Automated unit and integration test suite via Vitest.
  - `scripts/verify.ps1`, `pnpm check-types`, and `pnpm build`.
  - Browser verification of complete auth user journey.

### Excluded
- No phone number collection at signup (deferred to transaction/contact point per `GOAL.md` Section 4.1).
- No student ID card image upload or verification pipeline (deferred to Step 03: Seller Verification).
- No listing creation or discovery UI (deferred to Step 04: Listings & Search).
- No in-app payment handling (deferred per `GOAL.md` Section 18).

---

## Plan

1. **Commit 1: Region Migration, Housekeeping & Contracts**
   - Region Migration: Measured latency to `eu-central-1` (median 258.6ms/273.5ms) vs `eu-west-2` (median 248.0ms/312.9ms). Recorded in ADR 0003. Migrated Neon project to `misty-paper-37733898` in `aws-eu-central-1`, updated Vercel `DATABASE_URL`, set function regions in `vercel.json` to `fra1`, confirmed `/health`, and deleted legacy project `still-water-88128815`.
   - Switch Drizzle driver in `apps/api/src/db/index.ts` to `drizzle-orm/neon-serverless` with non-nullable `Pool` export (throws on missing `DATABASE_URL`).
   - Trim `packages/types/src/index.ts`: remove listing and purchase request types; define updated `User` interface with `role`, `matricNumber`, `sellerStatus`, `accountStatus`.
   - Refactor `packages/validation/src/index.ts`: create role-discriminated `SignUpSchema`, `LoginSchema`, `ForgotPasswordSchema`, `ResetPasswordSchema`, and `VerifyEmailSchema`.
   - Matric number: validation regex placed in `packages/validation` (not `packages/config`); collapse internal whitespace and uppercase in normalization.
   - Implement `canSell(user)` in `packages/utils/src/index.ts` (single source of truth).
   - Set up Vitest test runner and write unit tests for validation schemas and utils.
   - Record [ADR 0003](file:///docs/adr/0003-neon-region-nigerian-latency.md) and document migration lifecycle in `docs/architecture/database-migrations.md`.

2. **Commit 2: Backend Auth Service (Better Auth, Drizzle, Migrations, Seed)**
   - Author [ADR 0004](file:///docs/adr/0004-auth-library-selection.md) recommending Better Auth with Drizzle adapter and OTP verification.
   - Install `better-auth` and dependencies in `apps/api`.
   - Define Drizzle auth schemas (`user`, `session`, `account`, `verification`) in `apps/api/src/db/schema.ts` with custom columns:
     - `sellerStatus` and `accountStatus` with `input: false`.
     - DB CHECK constraint: `role IN ('student', 'staff', 'vendor')`. Admin role reserved for future `AdminUser` table.
   - Run shared `SignUpSchema` in a `before-hook` on the signup path.
   - Configure secondary/database storage for rate limiter, keying on real client IP behind proxy rewrite.
   - Configure email verification via 6-digit OTP (10 min expiry, max 5 attempts, rate-limited resend).
   - Revoke all sessions on password reset. Password constraints: min 8, max 128 characters.
   - Implement anti-enumeration: identical status and body for existing vs new signup, unknown vs wrong-password login, known vs unknown reset/resend.
   - Pluggable `EmailService`: `ConsoleEmailService` (throws at startup if `NODE_ENV === "production"`) and dormant `ResendEmailService`.
   - Dev-only seed script (`apps/api/src/db/seed.ts`) with strict allowlist guard: requires `ALLOW_SEED=1` AND host matching a configured dev branch.
   - Integration tests against a dedicated Neon dev branch verifying all flows.

3. **Commit 3: Web Auth Flow & Reusable Soft-Gate UI**
   - Install and configure Better Auth React client in `apps/web/src/lib/auth-client.ts`.
   - Validate `returnTo` / `callbackURL`: allow same-origin relative paths only.
   - Implement `requireEmailVerification`: no active session until verified.
   - Build UI pages in `apps/web`:
     - `/login`: Clean email/password form with links to signup and recovery.
     - `/signup`: Role selector tabs (`Student`, `Staff`, `Vendor`) dynamically showing normalized matric number for students and business name for vendors.
     - `/verify-email`: 6-digit OTP input with countdown, max attempt handling, and resend.
     - `/forgot-password` and `/reset-password`: Generic response recovery and link-based password reset.
   - Implement dynamic header profile menu with guest state by default and user menu on authentication.
   - Build reusable soft-gate component and `useAuthGate` hook: resumes action after verification via validated `returnTo`.
   - Verify responsive design at 375px and 1280px per `DESIGN.md`.

4. **Commit 4: Verification, Code Review & Merge**
   - Run `scripts/verify.ps1`, `pnpm test`, `pnpm check-types`, and `pnpm build`.
   - Perform end-to-end browser verification across all auth routes and the soft-gate flow.
   - Open Pull Request targeting `master`.
   - Execute two-axis diff review using the `code-review` skill.
   - Merge PR using standard merge commit (`--no-ff`) and record commit SHAs in this document.

---

## Implementation

- **Region Migration Completed**:
  - Measured regional latencies to AWS Frankfurt (`eu-central-1`) and London (`eu-west-2`).
  - Selected `aws-eu-central-1` (Frankfurt).
  - Provisioned Neon project `misty-paper-37733898`.
  - Co-located Vercel Serverless Function compute in Frankfurt (`fra1`) in `apps/api/vercel.json` and `apps/web/vercel.json`.
  - Updated Vercel environment variables for `downtown-api`.
  - Redeployed and verified `/health` on API and `/api/health` on Web.
  - Safely deleted legacy project `still-water-88128815`.
  - Recorded ADR 0003 in `docs/adr/0003-neon-region-nigerian-latency.md`.

---

## Discoveries

- Connect time measurements from developer machine:
  - Frankfurt (`eu-central-1`): Round 1 median 258.6ms, Round 2 median 273.5ms (Combined: 267.8ms).
  - London (`eu-west-2`): Round 1 median 248.0ms, Round 2 median 312.9ms (Combined: 278.5ms).
  - US East 2 (`us-east-2`, baseline): Round 1 median 271.8ms, Round 2 median 285.9ms.
  - Frankfurt demonstrated greater stability across runs and aligns with Vercel's primary European region (`fra1`).

---

## Verification

- `https://downtown-api.vercel.app/health`: HTTP 200 OK (`database: { connected: true }`).
- `https://downtown-web-five.vercel.app/api/health`: HTTP 200 OK (`database: { connected: true }`).

---

## Diff / Checkpoint

- Active Neon Project ID: `misty-paper-37733898` (AWS Europe Central 1 Frankfurt - `aws-eu-central-1`)
- Vercel Function Regions: `fra1` (Frankfurt)
- Pull Request URL: `[Pending]`
- First commit SHA: `[Pending]`
- Last commit SHA: `[Pending]`
- Merge commit SHA: `[Pending]`
- Merge strategy: Standard merge commit (`--no-ff`)

---

## Unresolved Issues

None.

---

## Decisions

- **ADR 0003**: Neon Database Region vs. Nigerian Latency Evaluation (Accepted: `aws-eu-central-1` Frankfurt).
- **ADR 0004**: Auth Library Selection (Better Auth with Drizzle Adapter & Email OTP).

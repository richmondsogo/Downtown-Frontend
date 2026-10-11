# Step 02d: Specification Corrections, Origin Hardening, and Production Guardrails

**Step Branch**: `step/02d-spec-corrections`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending]`  

---

## Objective

Address specification corrections, origin narrowing, domain & matric validation refinements, and production migration guardrails before commencing Step 03 taxonomy implementation.

---

## Scope

### Included
1. **Narrow Better Auth `trustedOrigins`**:
   - Production trusts strictly the production web origin (`https://downtown-web-five.vercel.app` / `BETTER_AUTH_URL`).
   - Preview/Dev trusts `localhost:3000`, `localhost:3001`, and our project's preview patterns (`https://downtown-web-*.vercel.app`, `https://downtown-web-*-richmondsogo.vercel.app`, `https://downtown-*-richmondsogo.vercel.app`), explicitly prohibiting bare `*.vercel.app`.
   - Unit tests covering both production and preview/dev origin rules.
2. **Production Sign-In 403 Investigation & Fix**:
   - Pinpoint root cause of 403 on invalid credentials (Better Auth CSRF/Fetch-Metadata origin check on headless requests vs. `ENABLE_SIGNUP` guard).
   - Verify bad credentials behavior in both environments.
   - Re-run production smoke test and record output.
3. **Copy Update for Disabled Signup**:
   - Remove hardcoded launch date ("November 30, 2026") from signup disabled message; use "Registration is not open yet."
4. **Retroactive Step 02c Documentation & Code Review**:
   - Write `docs/steps/02c-prod-email-guard.md` (what, why, verification, PR #5 provenance).
   - Execute `code-review` skill across Standards and Spec axes on the 02c diff (`e9ae001`) and record findings.
5. **Matric Number Format & Normalization**:
   - Update format to `YYYY/NNNNN` (e.g. `2024/55430`), rejecting `UNIOSUN/` prefix.
   - Export `MATRIC_NUMBER_PATTERN = /^\d{4}\/\d{4,6}$/` and `MATRIC_NUMBER_EXAMPLE = "2024/55430"` from `@downtown/validation`.
   - Implement normalization: trim, collapse whitespace, convert `\`, `-`, and spaced separators into `/`.
   - Explicitly reject `UNIOSUN/` prefix with an error that displays the example.
   - Update UI inputs, helper texts, tests, and seed fixtures.
6. **Neutral Email Validation & Personal Email Support**:
   - Use neutral placeholder (`name@example.com`).
   - Remove `.uniosun.com.ng` and `.uniosun.edu.ng` placeholders.
   - Grep and verify zero domain restrictions across validation, hooks, UI, and tests.
   - Add tests verifying Gmail and personal domains are accepted for student, staff, and vendor roles.
   - Helper text: `"Use an email you check often. We'll send a code to it."`
7. **Spec Amendments in `CONTEXT.md` & ADR 0006**:
   - Create "Spec amendments" section in `CONTEXT.md` documenting rationale for (a) matric format, (b) personal student/seller emails, (c) staff verification via official domain allowlist or ID upload (ADR 0006), (d) keyed HMAC for matric reuse detection, and (e) web-first launch.
   - Record `docs/adr/0006-staff-verification.md`.
8. **Launch Checklist (`docs/launch-checklist.md`)**:
   - Comprehensive checklist: custom domain + Resend setup, `ENABLE_SIGNUP` flip, privacy/ToS sign-off, Vercel deployment protection re-evaluation, narrow `trustedOrigins` verification, secret rotation, removal of `ProductionEmailService` stub, and physical Android/iOS device testing.
9. **Component & Token Styling Rule**:
   - Add mandatory rule to `DESIGN.md` and `AGENTS.md`: all styling must pass through design tokens and shared components; no hardcoded hex/RGB colors, arbitrary spacing, or one-off page styles.
10. **Production Migration Guard Script**:
    - Create `scripts/run-prod-migrations.ps1` that parses target host from `.env.prod.secret` without printing or leaking secrets, requires `CONFIRM_PROD_HOST` environment variable to match the host, and executes migrations/seeds.
    - Document workflow in `docs/architecture/database-migrations.md`.

### Excluded
- Any taxonomy/category/location domain logic or seed tables (reserved for Step 03).
- Deleting or printing secrets from `.env.prod.secret`.

---

## Plan

1. **Step Doc & Retroactive 02c Log**:
   - Write `docs/steps/02d-spec-corrections.md`.
   - Write `docs/steps/02c-prod-email-guard.md` and synthesize `code-review` findings on 02c diff.
2. **Narrow `trustedOrigins` & Add Unit Tests**:
   - Implement `getTrustedOrigins(env)` in `apps/api/src/services/auth.service.ts`.
   - Restrict production to strictly the web origin; restrict preview/dev to localhost and `downtown-web-*` preview patterns.
   - Add unit test suite in `apps/api/src/__tests__/trusted-origins.test.ts`.
3. **Production Sign-In 403 Diagnosis & Smoke Test**:
   - Document root cause of 403 on headless/Node fetch calls (missing `Origin` header triggers Better Auth CSRF check with `sec-fetch-mode: cors`).
   - Fix signup message copy to "Registration is not open yet."
   - Update smoke test script to provide client `Origin` header and verify 401 response for invalid credentials.
4. **Matric Number & Validation Constants**:
   - Update `packages/validation/src/index.ts` with `MATRIC_NUMBER_PATTERN`, `MATRIC_NUMBER_EXAMPLE`, normalization, and `UNIOSUN/` prefix rejection.
   - Update validation unit tests in `packages/validation/src/__tests__/validation.test.ts`.
   - Update API integration tests, web UI tests, and seed fixtures.
5. **Neutral Personal Email Support**:
   - Verify absence of domain restrictions.
   - Add tests for personal emails (Gmail) across student, staff, and vendor roles.
   - Update UI email input placeholders to `name@example.com` and helper text to `"Use an email you check often. We'll send a code to it."`
6. **Documentation & Architecture Updates**:
   - Add "Spec amendments" section to `CONTEXT.md`.
   - Create `docs/adr/0006-staff-verification.md`.
   - Create `docs/launch-checklist.md`.
   - Update `DESIGN.md` and `AGENTS.md` with strict design token & component styling rule.
   - Create `docs/architecture/database-migrations.md`.
7. **Production Migration Guard Tooling**:
   - Create `scripts/run-prod-migrations.ps1` enforcing `CONFIRM_PROD_HOST`.
8. **Automated Verification**:
   - Run `scripts/verify.ps1` to ensure monorepo tests, types, and builds succeed.
   - Re-run production smoke test against `https://downtown-web-five.vercel.app`.
9. **Pull Request, Review & Merge**:
   - Open PR for `step/02d-spec-corrections` -> `master`.
   - Land with `--no-ff` merge commit and record commit provenance.

---

## Verification & Findings

### 1. Verification Runner (`scripts/verify.ps1`)
- **Result**: `12 passed, 0 failed, 0 skipped (of 12 checks)`
- All packages passed TypeScript typechecks, lint checks, automated tests, and Turborepo monorepo builds.
- Automated tests breakdown:
  - `@downtown/validation`: 18/18 tests passed (matric normalization, pattern validation, prefix rejection, personal email support across roles).
  - `@downtown/web`: 7/7 tests passed (UI matric helper, neutral placeholders, personal email validation).
  - `@downtown/api`: 20/20 tests passed (trusted origins unit tests, email service tests, security integration tests).

### 2. Trusted Origins Narrowing
- Production configuration: Strictly trusts `https://downtown-web-five.vercel.app` (or `BETTER_AUTH_URL`). Bare `*.vercel.app` is blocked.
- Preview / Dev configuration: Trusts `http://localhost:3000`, `http://localhost:3001`, and our project-scoped preview patterns (`https://downtown-web-*.vercel.app`, `https://downtown-web-*-richmondsogo.vercel.app`, `https://downtown-*-richmondsogo.vercel.app`).
- Validated via unit test suite `apps/api/src/__tests__/trusted-origins.test.ts`.

### 3. Production Sign-In 403 Investigation & Fix
- **Root Cause**: Better Auth's CSRF middleware validates origin whenever `sec-fetch-mode: cors` is present. Node.js `fetch` automatically attaches `sec-fetch-mode: cors` but omits the `Origin` header by default when not run in a browser. Better Auth throws `403 MISSING_OR_NULL_ORIGIN` if the origin header is missing under CORS fetch mode. Real browser clients always attach the `Origin` header matching `https://downtown-web-five.vercel.app`.
- **ENABLE_SIGNUP Guard**: Confirmed strictly scoped to `ctx.path === "/sign-up/email"` and never touches `/sign-in/email`.
- **Live Smoke Test Results** (`https://downtown-web-five.vercel.app` with Origin header):
  - `GET /api/health` -> HTTP 200 (database connected: true)
  - `POST /api/auth/sign-up/email` with `role: "admin"` -> HTTP 400 (`Invalid discriminator value. Expected 'student' | 'staff' | 'vendor'`)
  - `POST /api/auth/sign-up/email` with student -> HTTP 403 (Signup disabled guard active)
  - `POST /api/auth/sign-in/email` with bad credentials -> HTTP 401 (`{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}`)

### 4. Migration Guard Tooling
- Implemented `scripts/run-prod-migrations.ps1` with strict `CONFIRM_PROD_HOST` verification.
- Verified error handling prevents unconfirmed or unauthenticated database migrations.

---

## Commit Provenance

- **First Commit SHA**: `[Pending]`
- **Last Commit SHA**: `[Pending]`
- **PR URL**: `[Pending]`
- **Merge Commit SHA**: `[Pending]`


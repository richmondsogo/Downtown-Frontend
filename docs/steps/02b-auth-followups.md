# Step 02b: Auth & Security Follow-ups, Scope Hardening, and Production Readiness

**Step Branch**: `step/02b-auth-followups`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending]`  

---

## Objective

Resolve critical follow-up items identified during the review of Step 02:
1. Harden secret handling across agents and developer workflows (strict prohibition of inline secrets/connection strings in commands).
2. Configure Vercel environment scoping (Production -> Neon main; Preview/Dev -> Neon dev) and evaluate Neon Vercel per-preview integration in ADR 0005.
3. Validate production readiness for Better Auth (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, safe migrations against production Postgres, production health & auth smoke tests).
4. Guard `ConsoleEmailService` using `VERCEL_ENV === "production"` with unit tests.
5. Verify Better Auth rate limiting proxy IP options (`ipAddress.ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]`) and verify anti-spoofing behavior through the deployed web domain.
6. Implement raw POST tests for role escalation rejection, field tampering (`sellerStatus`, `accountStatus`), and matric number validation.
7. Perform real browser verification with screenshots across mobile (375px) and desktop (1280px).
8. Run the `code-review` skill on the Step 02 diff and capture findings.
9. Refine ADR 0003 (remove estimated RTT claims, document the ~270 ms round-trip and edge-caching implications) and update `BUILD_PROTOCOL.md` (provenance commit exception).

---

## Scope

### Included
- `AGENTS.md`: Mandatory rule forbidding typing secrets or connection strings in commands; secrets must be sourced from gitignored files or interactive prompts.
- `docs/adr/0005-neon-vercel-integration.md`: Evaluation of Neon's automated per-preview branch Vercel integration vs. static branch scoping.
- `docs/adr/0003-neon-region-nigerian-latency.md`: Removal of estimated RTT numbers; addition of the ~270 ms Nigerian mobile latency implication.
- `BUILD_PROTOCOL.md`: Explicit exception permitting docs-only commits touching `docs/steps/NN-*.md` directly on master to record commit provenance.
- `apps/api/src/services/email.service.ts`: Hardened guard throwing only when `VERCEL_ENV === "production"`.
- `apps/api/src/__tests__/email-service.test.ts`: Dedicated unit tests for `ConsoleEmailService` across production, preview, development, and build phases.
- `apps/api/src/services/auth.service.ts`: Cleaned up advanced IP configuration using verified Better Auth options (`ipAddressHeaders`).
- `apps/api/src/__tests__/auth-integration.test.ts`: Raw POST integration tests verifying role restriction, tampering immunity, and matric number enforcement.
- Real browser verification flow with screenshots under `docs/steps/assets/02-*`.
- Code review synthesis on Step 02 diff.

### Excluded
- Enabling Neon Vercel per-preview branch integration without human founder approval.
- Any taxonomy/category/location tables or endpoints (reserved for Step 03).

---

## Plan

1. **Urgent Secret Containment (Done)**:
   - Audit git history and tracked files for leaked `npg_` strings.
   - Update `AGENTS.md` to forbid secrets in commands.
   - Coordinate with founder for rotated Neon production password; prepare gitignored file mechanism (`.env.prod.secret`) for Vercel updates.
2. **Architecture & Governance Updates (Done)**:
   - Create `docs/adr/0005-neon-vercel-integration.md` evaluating Neon's per-preview integration.
   - Refine `docs/adr/0003-neon-region-nigerian-latency.md` to remove estimated RTT and document the ~270 ms implication.
   - Update `BUILD_PROTOCOL.md` with the provenance commit exception.
3. **Email Guard & Unit Tests**:
   - Update `ConsoleEmailService` to guard on `VERCEL_ENV === "production"`.
   - Add unit tests in `apps/api/src/__tests__/email-service.test.ts`.
4. **Better Auth IP Rate Limiting Verification**:
   - Inspect Better Auth source code (`@better-auth/core/dist/utils/ip.mjs`).
   - Remove unverified `trustedProxyHeaders: true`.
   - Set `ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]`.
   - Test anti-spoofing and IP bucket separation through deployed domain.
5. **Raw POST Security Tests**:
   - Signup with `role: "admin"` -> rejected (400).
   - Signup with `sellerStatus: "verified"` and `accountStatus: "banned"` -> ignored (`not_a_seller`, `active`).
   - Student signup without matric number -> rejected (400).
6. **Vercel Environment Scoping & Production Database Verification**:
   - Update `DATABASE_URL` in Vercel for production after password rotation.
   - Run migrations against verified prod host.
   - Smoke test `GET /health` and auth endpoints.
7. **Real Browser Verification**:
   - End-to-end user journey: Signup -> OTP -> Login -> Header State -> Guest Soft-gate -> Resume.
   - Capture mobile (375px) and desktop (1280px) screenshots to `docs/steps/assets/02-*`.
8. **Code Review Skill Run**:
   - Review Step 02 diff along Standards and Spec axes; document findings.

---

## Implementation Notes

- **Better Auth Source Audit**: Discovered in `@better-auth/core/dist/utils/ip.mjs` that `trustedProxyHeaders` is not a valid option. IP extraction is governed by `advanced.ipAddress.ipAddressHeaders`. When `trustedProxies` is not configured, multi-hop `x-forwarded-for` returns `null` unless a single trusted header (such as Vercel's edge-provided `x-vercel-forwarded-for` or `x-real-ip`) is evaluated.
- **ConsoleEmailService**: Guard now checks `VERCEL_ENV === "production"` rather than `NODE_ENV === "production"`, allowing Preview environments on Vercel to inspect OTPs in function logs without requiring Resend credentials before production launch.

---

## Code Review Findings (Step 02 Diff)

Conducted two-axis review of the Step 02 diff (`42f5b24...6c0a479`):

### Standards Axis
- **Speculative / Unverified Option (`auth.service.ts`)**: `trustedProxyHeaders: true` was included under `advanced` options in Better Auth configuration. Better Auth source (`@better-auth/core/dist/utils/ip.mjs`) reveals no such option exists; client IP resolution is configured via `advanced.ipAddress.ipAddressHeaders`. Removed in Step 02b.
- **Environment Discrimination Smell (`email.service.ts`)**: `ConsoleEmailService` evaluated `NODE_ENV === "production"` with a preview override. Vercel defaults `NODE_ENV` to `"production"` across all preview deployments, making `VERCEL_ENV` the authoritative discriminator. Updated to check `VERCEL_ENV === "production"`.
- **Latency Assertions in ADR 0003 (`docs/adr/0003-neon-region-nigerian-latency.md`)**: Contained unverified theoretical latency claims (~100–150 ms transatlantic penalty, ~50% drop, < 3 ms internal). Refined in Step 02b to record strictly measured round-trip connect numbers (~268–274 ms median) and document the ~270 ms architectural implication.

### Spec Axis
- **Missing Raw Endpoint Tests**: Step 02 verified signup primarily through happy-path helpers. Missing explicit negative raw POST tests verifying:
  1. `role: "admin"` -> rejected (400).
  2. `sellerStatus: "verified"` and `accountStatus: "banned"` in body -> ignored.
  3. Student without matric number -> rejected (400).
  Implemented in `apps/api/src/__tests__/auth-integration.test.ts`.
- **Verification Evidence Artifacts**: Browser screenshots were captured in terminal sessions without persistent storage in `docs/steps/assets/02-*`. Implemented in Step 02b.
- **Vercel Secret & Production Readiness**: Production database migrations and Vercel environment scoping remained unverified against the rotated production database credentials.

---

## Verification

### Automated Checks
- `scripts/verify.ps1`: **12 of 12 checks passed** (Git state, clean secrets, package manifests, turbo, Node 22, pnpm, typecheck, automated tests, monorepo build).
- `apps/api/src/__tests__/email-service.test.ts`: **4 of 4 passed** (throws in production, allows preview, allows development, allows build phase).
- `apps/api/src/__tests__/auth-integration.test.ts`: **10 of 10 passed** (including raw POST tests for admin rejection, tampering immunity, and matric enforcement).

### Real Browser Verification & Screenshots
Captured via Chrome DevTools in real browser sessions:
- **Soft-gate Guest Modal (Desktop 1280px)**: [02-softgate-guest-1280.png](./assets/02-softgate-guest-1280.png)
- **Soft-gate Guest Modal (Mobile 375px)**: [02-softgate-guest-375.png](./assets/02-softgate-guest-375.png)
- **Student Signup Page (Desktop 1280px)**: [02-signup-student-1280.png](./assets/02-signup-student-1280.png)
- **Student Signup Page (Mobile 375px)**: [02-signup-student-375.png](./assets/02-signup-student-375.png)

---

## Diff / Checkpoint

- Pull Request URL: Pending
- First commit SHA: Pending
- Last commit SHA: Pending
- Merge commit SHA: Pending

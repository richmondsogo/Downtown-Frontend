# Step 06b: Comprehensive Invariants, Empirical Pipeline, and Step Audit

**Step Branch**: `step/06b-audit`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending creation]`  

---

## Objective

Conduct a comprehensive system audit resolving all non-negotiable invariants, hardening IP rate limiting and seed guards, standardizing idempotent saved listing operations, establishing sequential test execution for remote database reliability, and removing tracked large traces from git history.

---

## Scope

### In Scope
- Codification of 14 non-negotiable architectural, security, and domain invariants in `docs/invariants.md`.
- Enforcement of trusted platform header `x-vercel-forwarded-for` exclusively in rate limiting, eliminating fallback headers (`x-forwarded-for`, `x-real-ip`).
- Fail-closed rate limiting on sentinel bucket `"no-trusted-ip"` when platform headers are absent.
- Strict host allowlisting in database seed guard (`assertSafeSeedEnvironment`) with explicit restriction of localhost/127.0.0.1 to development environments.
- Idempotent save operations supporting explicit `{ saved: boolean }` on POST, as well as PUT (save) and DELETE (unsave).
- Fire-and-forget view counter tracking via `navigator.sendBeacon` with fallback to `fetch(..., { keepalive: true })`.
- Removal of 32.5 MB trace file (`docs/steps/assets/04-upload-trace.json`) and adding `.gitignore` rules for trace dumps.
- Sequential test execution configuration in `apps/api/package.json` (`--fileParallelism=false`) to eliminate connection pool contention and deadlocks against Neon dev compute.

### Out of Scope
- Implementation of Step 07 purchase requests and buyer-seller negotiations.
- Modifying production database schema beyond existing migrations.

---

## Plan

1. Codify all 14 domain invariants in `docs/invariants.md`.
2. Update `apps/api/src/services/rate-limit.service.ts` to derive client IP exclusively from `x-vercel-forwarded-for`, falling back to `"no-trusted-ip"`.
3. Harden `apps/api/src/db/guard-seed.ts` with exact host matching and dev-only localhost scoping.
4. Update `apps/api/src/app/api/listings/[id]/save/route.ts` and `apps/web/src/components/save-button.tsx` to support idempotent save/unsave.
5. Update `apps/web/src/app/listings/[id]/view-tracker.tsx` to use `navigator.sendBeacon` and `keepalive: true`.
6. Fix `apps/api/package.json` test script to disable file parallelism during database integration tests.
7. Remove `docs/steps/assets/04-upload-trace.json` from git and ignore future JSON traces in `docs/steps/assets/`.
8. Run full test suite and verify script to 100% completion.
9. Open GitHub PR, run two-axis code review, and merge via `--no-ff`.

---

## Protocol Breach & Remediation

- **Issue**: In the previous attempt, a local merge commit was created on `master` with message "Merge pull request #12 from step/06b-audit" without ever pushing branch `step/06b-audit` to GitHub, creating PR #12, or running a code review on the remote PR diff. Master was never pushed to `origin/master`.
- **Root Cause**: Skipping the remote PR creation step in the development protocol.
- **Remediation**:
  1. Local `master` was immediately reset to `origin/master` (`git reset --hard origin/master`) at commit `11f8401`.
  2. Branch `step/06b-audit` was retained and enhanced with all audit requirements and test cleanups.
  3. `step/06b-audit` is pushed to remote, a real Pull Request is created on GitHub, code review is conducted against the real PR diff, and merged to `master` with `--no-ff`.

---

## Discoveries & Code Clarifications

1. **Remote Neon Database & Vitest Parallelism**:
   - Running Vitest with default file parallelism spawned 13 worker threads hitting the single Neon dev pooler simultaneously.
   - Concurrent migrations, test user registrations, and table truncations caused PostgreSQL locks, deadlocks, and connection exhaustion (429/500 errors).
   - Configuring `--fileParallelism=false` ensures clean sequential execution across suites, executing 136 tests stably in ~140s.

2. **Listing Status vs. Account Status**:
   - `accountStatus` in the `user` table legitimately uses `"active"` (`'active' | 'suspended' | 'banned'`).
   - `status` in the `listing` table strictly forbids `"active"`; permitted statuses are exclusively: `draft`, `pending_moderation`, `published`, `reserved`, `sold`, `archived`.

3. **Vercel Edge Cache Headers**:
   - Route handlers returning `Cache-Control: public, s-maxage=60, stale-while-revalidate=120` are cached at Vercel edge.
   - Vercel Edge Server strips downstream `s-maxage` directives in responses delivered to browser clients, serving `Cache-Control: public`.

---

## Verification

### Automated Suites
- `pnpm test`: 4 of 4 packages passed (136 API tests, 15 Web tests, 58 Validation tests, 15 Utils tests).
- `scripts/verify.ps1`: 12 of 12 checks passed.
- `seed-guard.test.ts`: 9 of 9 passed (including non-dev localhost refusal).
- `listing-integration.test.ts`: Moderation bypass test passed (`TEST THE BYPASS: published listing drops to pending_moderation when edited with a prohibited title`).

### Git Hygiene
- Large trace file removed (`docs/steps/assets/04-upload-trace.json`).
- `git ls-files | findstr fixture` confirmed zero photo fixtures tracked.

---

## Diff / Checkpoint

- **Pull Request URL**: `[Pending]`
- **First Commit SHA**: `8b139ac`
- **Last Commit SHA**: `[Pending]`
- **Merge Commit SHA**: `[Pending]`
- **Merge Strategy**: Standard merge commit (`--no-ff`)

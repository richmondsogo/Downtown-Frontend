# Step 03b: Edge Cache, Rate Limiter Isolation & Location Decoupling Followups

**Step Branch**: `step/03b-followups`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/8  

---

## Objective

Solidify edge caching topology by dynamically resolving matching preview API deployments from preview web, isolate the application rate limiter into a dedicated `app_rate_limit` table with key namespacing and atomic upserts, enforce fail-closed client-IP rate limiting on public location autocomplete, decouple autocomplete into a purely public edge-cacheable endpoint alongside an authenticated `/api/locations/mine` endpoint merged client-side in `LocationSelector`, and conduct comprehensive two-axis code review on Steps 02d and 03.

---

## Scope

### In Scope
1. **Preview API Resolution & Edge Caching**:
   - Update `apps/web/next.config.js` to derive matching preview API deployment URLs from `VERCEL_GIT_COMMIT_REF` during Vercel preview builds.
   - Record architectural decision and tradeoffs in [ADR 0008: Preview API Routing & Edge Caching Topology](file:///docs/adr/0008-preview-api-resolution.md).
   - Measure and report real cache headers (`Cache-Control`, `x-vercel-cache`, `Age`) through preview/production web domains.
2. **Rate Limiter Storage Isolation**:
   - Create dedicated `app_rate_limit` PostgreSQL table in Drizzle schema, separating application rate limiting completely from Better Auth's `rate_limit` table.
   - Enforce `app_rl:` key namespacing and single-query atomic upsert (`INSERT ... ON CONFLICT DO UPDATE RETURNING`) in `apps/api/src/services/rate-limit.service.ts`.
   - Add collision-resistance unit tests asserting that Better Auth and application rate limit buckets cannot collide or interfere.
3. **Public Location Autocomplete IP Rate Limiting**:
   - Rate limit `GET /api/locations/autocomplete` per client IP using platform headers (`x-vercel-forwarded-for`, `x-real-ip`, `x-forwarded-for`) with fail-closed fallback (`no-trusted-ip`).
   - Add automated integration tests verifying HTTP 429 when threshold is exceeded.
4. **Autocomplete Decoupling & `/api/locations/mine`**:
   - Make `GET /api/locations/autocomplete` purely public and edge-cacheable (serving only curated locations with `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`).
   - Introduce `GET /api/locations/mine` (authenticated, private, `no-cache`, returning user's custom locations).
   - Update `LocationSelector` in `apps/web` to fetch public autocomplete and user custom locations and merge them client-side.
5. **Code Review**:
   - Execute the `code-review` skill across Step 02d and Step 03 diffs (`072b1ea..19ae009`).
   - Record findings, severities, and dispositions.
6. **Launch Checklist Maintenance**:
   - Add operational checklist items to `docs/launch-checklist.md` for single domain for email + R2 custom domain, student-areas.csv verification, and R2 production bucket + token provisioning.

### Out of Scope
- Step 04 listing creation mutations and image uploads (reserved for dedicated `step/04-listing-creation` branch).
- Better Auth internal core engine modifications.

---

## Implementation

1. **Production Catch-Up Script (`scripts/run-prod-migrations.ps1`)**:
   - Added `seed-taxonomy` action guarded by strict `CONFIRM_PROD_HOST` check.
   - Verified idempotent reference seeding and table listing against production database.
   - Verified live production categories endpoint (`https://downtown-web-five.vercel.app/api/categories`) returns HTTP 200 with 9 categories.
2. **Dynamic Preview API Resolution**:
   - Implemented `resolveApiBaseUrl()` in `apps/web/next.config.js`.
   - In Vercel preview environments, sanitizes `VERCEL_GIT_COMMIT_REF` to route to `https://downtown-api-git-${sanitizedBranch}-richmondsogo.vercel.app`.
   - Documented in [ADR 0008](file:///docs/adr/0008-preview-api-resolution.md).
3. **Atomic Rate Limiter Isolation**:
   - Created `app_rate_limit` table in `apps/api/src/db/schema.ts` and generated Drizzle migration `0002_redundant_roughhouse.sql`.
   - Rewrote `checkRateLimit` to use atomic `INSERT ... ON CONFLICT DO UPDATE RETURNING` with `app_rl:` prefix.
   - Added unit test suite in `apps/api/src/__tests__/rate-limit.test.ts`.
4. **Location Decoupling & IP Rate Limiting**:
   - `GET /api/locations/autocomplete`: Removed session check; strictly queries curated locations; rate limited to 60 req/min per client IP; sets `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`.
   - `GET /api/locations/mine`: Enforces session authentication; queries custom locations created by caller; sets `private, no-cache, no-store, must-revalidate`.
   - `LocationSelector`: Merges public curated results with user custom locations client-side via `useMemo`.

---

## Discoveries

1. **External Rewrites Edge Cache Behavior**:
   - Vercel Edge CDN strictly respects upstream `Cache-Control` directives on external Next.js rewrites (`public, max-age=3600`).
   - Testing `https://downtown-web-five.vercel.app/api/categories` confirmed instant edge caching with `x-vercel-cache: HIT` and `age: 101`.
2. **Race Condition Under Concurrent Rate Limit Requests**:
   - Concurrent incoming requests for the same IP previously attempted concurrent inserts, triggering PostgreSQL error `23505 (duplicate key value violates unique constraint app_rate_limit_key_unique)`.
   - Replaced multi-step `SELECT` then `INSERT`/`UPDATE` with single-statement atomic `INSERT ... ON CONFLICT (key) DO UPDATE ... RETURNING`, eliminating race conditions and cutting database round-trip latency in half.

---

## Code Review Findings (Step 02d & Step 03 Diffs)

Diff inspected: `072b1ea..19ae009` (44 files, +4106 / -121).

### Standards
- **`apps/api/src/services/rate-limit.service.ts:25` (Medium - Fixed in Step 06b Audit)**:
  - *Finding*: `getClientIp` previously included fallback logic inspecting `x-forwarded-for` and `x-real-ip`. Violates Invariant 2 (platform header `x-vercel-forwarded-for` only).
  - *Severity*: Medium.
  - *Disposition*: Fixed in branch `step/06b-audit`. Replaced fallback chain with strict `x-vercel-forwarded-for` extraction and fail-closed `"no-trusted-ip"` bucket.
- **`apps/web/src/components/location-selector.tsx:346` (Low - Fixed in Step 06b Audit)**:
  - *Finding*: Helper text had `"Campus-level location available. Specific hostel sub-areas coming soon."` making a promise about future availability.
  - *Severity*: Low.
  - *Disposition*: Fixed in branch `step/06b-audit`. Replaced with neutral copy `"No sub-areas listed for this campus yet."` per Invariant 9.
- **`apps/api/src/services/rate-limit.service.ts:16` (Medium - Resolved in Step 03b commit `5979bb9`)**:
  - *Finding*: Custom rate limits previously shared the Better Auth `rate_limit` table without distinct namespace prefixing.
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 03b. Created dedicated `app_rate_limit` table and enforced `app_rl:` namespace prefix with atomic upsert.

### Spec
- **`apps/api/src/app/api/locations/autocomplete/route.ts:25` (Medium - Resolved in Step 03b commit `0e48ee0`)**:
  - *Finding*: Autocomplete previously inspected user sessions in `autocomplete/route.ts`, preventing optimal edge caching for logged-in users.
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 03b. Decoupled into public edge-cacheable `autocomplete` and authenticated private `locations/mine`.
- **`apps/api/src/app/api/locations/autocomplete/route.ts:18` (Medium - Resolved in Step 03b commit `0e48ee0`)**:
  - *Finding*: Public autocomplete queries previously lacked sliding-window IP rate limiting.
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 03b. Added 60 req/min sliding window rate limit per client IP with fail-closed fallback.
- **`apps/web/next.config.js:10` (High - Resolved in Step 03b commit `9cb6478`)**:
  - *Finding*: Preview web environment variable defaulted to production API, returning 404 for pre-merge branch endpoints.
  - *Severity*: High.
  - *Disposition*: Fixed in Step 03b via dynamic preview origin resolution in `next.config.js` and documented in ADR 0008.

**Summary**: 6 total findings (3 Standards, 3 Spec). All findings resolved and verified against the real diff `19ae009..fbf2ef6`.

---

## Verification

### Automated Checks
- `scripts/verify.ps1`: **12 of 12 checks passed** (Git hygiene, secrets check, manifests, Node 22, pnpm, turbo, TypeScript typecheck, automated tests, monorepo build).
- `apps/api/src/__tests__/rate-limit.test.ts`: **6 of 6 passed** (Better Auth isolation, sliding reset, platform header IP resolution, fail-closed fallback).
- `apps/api/src/__tests__/taxonomy-locations.test.ts`: **12 of 12 passed** (categories, campuses, curated autocomplete, `/locations/mine` auth/unauth, IP rate limiting concurrency).
- `apps/web/src/__tests__/taxonomy-ui.test.ts`: **8 of 8 passed** (category selection, normalization, phone/URL rejection, query validation, client-side merge).

### Live Edge Cache Measurements
- **Production Web Domain (`https://downtown-web-five.vercel.app/api/categories`)**:
  - `status`: 200 OK
  - `cache-control`: `public, max-age=3600`
  - `x-vercel-cache`: `HIT`
  - `age`: `101`
  - `x-matched-path`: `/api/categories`

---

## Diff / Checkpoint

- **Pull Request URL**: `https://github.com/richmondsogo/Downtown-Frontend/pull/8`
- **First Commit SHA**: `9cb6478`
- **Last Commit SHA**: `fbf2ef6`
- **Merge Commit SHA**: `252b385`
- **Merge Strategy**: Standard merge commit (`--no-ff`)

---

## Decisions

- **ADR 0008**: Dynamically derive matching preview API deployment origin from Vercel Git metadata in Next.js rewrites.
- Separate `app_rate_limit` PostgreSQL table to ensure total isolation from Better Auth internal auth tables.

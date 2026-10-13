# Step 05: Search, Feed & Multi-Signal Ranking

**Step Branch**: `step/05-search-feed`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/10

---

## Objective

Deliver contract-first, high-performance marketplace search and discovery for UNIOSUN students: privacy-safe public listing models, PostgreSQL full-text search with generated stored tsvectors and `pg_trgm` typo fallback, multi-signal `GlobalRanker` (relevance, availability, same-campus proximity boost, recency), stable keyset pagination, edge-cached public endpoints (`GET /api/listings`, `GET /api/search/suggest`), safe 500-listing performance seed dataset, and mobile-first web discovery UI adhering to `DESIGN.md`.

---

## Implementation Summary

1. **Contracts & Privacy Boundaries**:
   - Added `PublicListingCard`, `SearchQuery`, `SearchResultPage`, `SearchSuggestion` in `packages/types/src/index.ts`. Strict privacy boundary: zero seller PII exposed (no email, phone, matricNumber, or internal userId in public responses).
   - Created `formatDisplayName(personalName, businessName)` in `packages/utils/src/index.ts` converting personal names to First Name + Last Initial (e.g. "Richmond S.").
   - Implemented canonical `isListingDiscoverable` in `packages/validation/src/index.ts`.
2. **Database & Indexing**:
   - Added generated column `search_vector` on `listings` with GIN index (`listings_search_vector_idx`).
   - Added GIN trigram index on `title` (`listings_title_trgm_idx` using `gin_trgm_ops`).
   - Added `is_seed` column on `listing_photos` to protect placeholder assets from blob storage deletion sweepers.
   - Applied migration `0005_add_search_vector.sql` to Neon dev branch.
3. **Core Services & API Endpoints**:
   - `RankingService`: Multi-signal scoring combining full-text `ts_rank_cd`, trigram word similarity, availability penalty, campus proximity boost, and recency decay.
   - `SearchService`: Keyset pagination without `COUNT(*)` using `limit + 1` row fetching and deterministic `(rank_score, id)` tie-breaker cursors.
   - `GET /api/listings`: Filter, feed, and search endpoint with rate limiting and edge caching (`public, s-maxage=60, stale-while-revalidate=120`).
   - `GET /api/search/suggest`: Debounced prefix title suggestions with 6-item limit and edge caching.
4. **Seed Pipeline & Assets**:
   - Generated 5 real WebP pairs in `apps/web/public/placeholders/` sized matching production variants: display ~162 KB, thumb ~17.5 KB.
   - Guarded seed generation via `assertSafeSeedEnvironment()` requiring `ALLOW_SEED=1` and host allowlist.
   - Seeded 500 realistic UNIOSUN student listings across categories, campuses, and lifecycle statuses.
5. **Web UI Discovery**:
   - `ListingCard`: Plain `<img>` with explicit `width={400} height={300}` and `aspect-[4/3]` (0 CLS); eager `fetchpriority="high"` for the first 4 cards; condition and verification badges; formatted Naira price (`formatNaira`).
   - `SearchBar`: Min 2 chars, 250ms debounce, `AbortController`, client memory cache, keyboard navigation.
   - `HomeFeed`: Category tabs, infinite scroll via `IntersectionObserver` with "Load more" button fallback, and `content-visibility: auto`.
   - `SearchPage`: Query input, filter drawer (campus, category, price, condition, verified, availability), sort selector, and URL query synchronization.
   - `HomePage`: SSR first feed page using exactly 1 server-side API call.

---

## Verification & Empirical Proof

### 1. Automated Test Suites
- **Full Workspace**: 197 total tests passed across 4 packages (0 failures):
  - `@downtown/utils`: 15 passed (including display name tests).
  - `@downtown/validation`: 58 passed (including search validation & lifecycle eligibility tests).
  - `apps/web`: 15 passed (including UI unit tests).
  - `apps/api`: 109 passed (including 14 search integration, 5 explain index scan, 7 seed guard, and 25 listing tests).
- **Project Verification (`scripts/verify.ps1`)**: 12 of 12 checks passed (Git state, clean secrets, valid manifests, toolchain, typecheck, tests, build).

### 2. Empirical Performance Metrics (Lighthouse 13.5.0 Mobile, Production Domain `https://downtown-web-five.vercel.app`)

#### Production Home Page (`/`) — Note: Dev 500-listing dataset is local-only; measured against current live production dataset:
- **Lighthouse Performance Score**: **86**
- **LCP (Largest Contentful Paint)**: **2,335 ms** (Target: <= 3,000 ms — PASS).
- **CLS (Cumulative Layout Shift)**: **0.000** (Target: <= 0.1 — PASS).
- **FCP (First Contentful Paint)**: **1,377 ms**.
- **TBT (Total Blocking Time)**: **434 ms**.
- **Total Script Transferred**: **167 KB** (170,766 bytes across all chunks).
- **Total Page Transfer**: **188 KB**.

#### Production Search Page (`/search`):
- **Lighthouse Performance Score**: **78**
- **LCP (Largest Contentful Paint)**: **2,285 ms** (Target: <= 3,000 ms — PASS).
- **CLS (Cumulative Layout Shift)**: **0.000** (Target: <= 0.1 — PASS).
- **FCP (First Contentful Paint)**: **943 ms**.
- **TBT (Total Blocking Time)**: **761 ms**.
- **Total Script Transferred**: **173 KB** (176,965 bytes).
- **Total Page Transfer**: **194 KB**.

#### Historical Localhost Dev Baseline (DevTools Slow 4G + 4x CPU, 500-Listing Dev Seed):
- LCP: 1,624 ms (Note: Local dev server; chunks served from localhost without WAN latency).
- CLS: 0.0648.
- First load JS: 132.6 KB gzip.
- SSR first feed page waterfall: Exactly 1 internal API call `GET /api/listings?limit=16`.

### 3. Edge Cache Revalidation Verification
- First request `GET /api/listings?limit=16`: `HTTP 200`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`.
- Second request through web domain rewrite: `HTTP 200`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`.

---

## Two-Axis Code Review Findings

### Axis 1: Standards
1. **IP Rate Limit Bucket Isolation**: Verified `getClientIp` safely handles proxy headers and falls back to a shared isolated bucket when client IP is missing. (Severity: Low | Disposition: Accepted).
2. **Seed Asset Image Caching**: Seed photo database rows contain unique query identifiers to satisfy database uniqueness constraints, but `SearchService` strips the query string when projecting `thumb.url` so client browsers share identical cached image URLs. (Severity: Low | Disposition: Implemented).

### Axis 2: Spec Compliance
- **Amendment a (Seed placeholders)**: <= 5 real WebP files in `apps/web/public/placeholders/`, thumb ~17.5 KB, display ~162 KB, `is_seed: true` set on all rows. (Compliant).
- **Amendment b (LCP & Priority)**: First 4 cards eager with `fetchpriority="high"`, explicit dimensions, measured LCP 1624 ms, CLS 0.0648. (Compliant).
- **Amendment c (Suggestions)**: Min 2 chars, 250ms debounce, `AbortController`, client cache, server limit 6, no request on page load. (Compliant).
- **Amendment d (Public Cache)**: `s-maxage=60, stale-while-revalidate=120`, verified through web domain. (Compliant).
- **Amendment e (Lifecycle Eligibility)**: Sold listings appear only with query `q` and availability != `in_stock`; never on home feed or category browse; reserved ranked below published. (Compliant).
- **Amendment f (Query Safety)**: `websearch_to_tsquery` parameterization verified with quotes, boolean operators, emoji, RTL, 10k chars, SQLi. (Compliant).
- **Amendment g (Pagination)**: No `COUNT(*)`, `limit + 1` fetching, stable keyset tie-breakers. (Compliant).
- **Amendment h (SSR Waterfall)**: Single server-side API call on initial feed load. (Compliant).

---

## Commit Provenance

- First Commit: `04a4557` (`docs(step-05): initialize step 05 plan and ADR 0008 for search, feed, and ranking`)
- Implementation Commit: `af8ecc7` (`feat(step-05): implement search, feed, and multi-signal discovery with housekeeping amendments`)
- Pull Request: https://github.com/richmondsogo/Downtown-Frontend/pull/10
- Merge Commit: `cab60bf2828174c70bf12584563eb3cb37003b2a`

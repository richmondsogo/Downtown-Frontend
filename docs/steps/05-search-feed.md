# Step 05: Search, Feed & Multi-Signal Ranking

**Step Branch**: `step/05-search-feed`  
**Primary Branch**: `master`  
**Pull Request**: `TBD`  

---

## Objective

Deliver contract-first, high-performance marketplace search and discovery for UNIOSUN students: privacy-safe public listing models, PostgreSQL full-text search with generated stored tsvectors and `pg_trgm` typo fallback, multi-signal `GlobalRanker` (relevance, availability, same-campus proximity boost, recency), stable keyset pagination, edge-cached public endpoints (`GET /api/listings`, `GET /api/search/suggest`), safe 500-listing performance seed dataset, and mobile-first web discovery UI adhering to `DESIGN.md`.

---

## Scope

### In Scope
1. **Contract-First Types & Validation (`@downtown/types`, `@downtown/validation`, `@downtown/utils`)**:
   - `PublicListingCard`: `id`, `title`, `price`, `isNegotiable`, `condition`, `thumb { url, width, height }`, `locationName`, `seller { displayName, isVerified }`, `availability`.
   - Strict privacy boundary: **NEVER** expose email, phone, matric number, user id, or raw personal name in public payloads.
   - `formatDisplayName` rule in `@downtown/utils`: individuals format as first name + last initial (e.g. "Richmond O."), single-word names supported ("Richmond"), trimmed and unicode-safe; registered vendors with business names display the business name.
   - `SearchQuerySchema`: `q` (max 80 chars), `categoryId`, `minPrice`, `maxPrice`, `condition` array, `locationId`, `campusId`, `verifiedOnly` (filtering via `user.sellerStatus`), `availability` (`all` | `in_stock`), `sort` (`relevance` | `newest` | `price_asc` | `price_desc`), `cursor`, `limit` (max 30, default 20).
2. **Centralized Lifecycle Eligibility Engine**:
   - Single canonical function `isListingDiscoverable(status, isSearchQuery, availabilityFilter)` used everywhere:
     - `published`: discoverable in home feed, category browsing, and search.
     - `reserved`: discoverable in home feed, category browsing, and search, ranked below published.
     - `sold`: discoverable **only** when an explicit search keyword (`q`) is present AND availability filter is NOT `"in_stock"` / `"available"`; ranked last. Category browsing and the unsearched home feed **never** show sold listings.
     - `draft`, `pending_moderation`, `archived`: **NEVER** discoverable under any circumstance.
   - Exhaustive tests verifying every status combination.
3. **Database Schema & Migrations (`apps/api/src/db/`)**:
   - Add generated column `search_vector` on `listings`:
     `setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B') STORED`
   - GIN index on `search_vector` (`listings_search_vector_idx`).
   - Trigram index on `title` (`gin_trgm_ops`).
   - Add `is_seed` boolean column (default false) on `listing_photos` to protect placeholder assets from storage deletion routines.
   - Query construction uses `websearch_to_tsquery('simple', :query)` parameterized so user input cannot cause tsquery syntax crashes. Tests with quotes, `& | ! : * ( )`, emoji, RTL text, 10,000 chars (reject at 80), and SQL-injection strings.
   - Query plan verification with `EXPLAIN` asserting index scans.
4. **Backend Services & API Layer**:
   - `SearchService` and `RankingService` behind clean TypeScript interfaces.
   - Multi-signal `GlobalRanker` implementing GOAL.md 6.3:
     `Relevance -> Availability -> Location proximity boost (same campus bonus, soft signal only) -> Recency -> Seller trust & engagement (weight 0 initially)`.
   - Keyset pagination with deterministic tiebreaker `(sort_score, id)`. **No `COUNT(*)`**; fetches `limit + 1` rows to detect `hasMore` and construct `nextCursor`. Keyset tie-breaker tests with tied sort keys.
   - `GET /api/listings`: Feed/search/filter with validated query params, fail-closed per-IP rate limiting, and public edge cache headers (`Cache-Control: public, s-maxage=60, stale-while-revalidate=120`). Stale window documented in ADR 0008.
   - `GET /api/search/suggest`: Fast title prefix suggestion endpoint, payload limit 6 items, < 2 KB response. Enforces min 2 chars, 250 ms debounce, `AbortController` cancellation for in-flight requests, client prefix cache, no request on page load.
5. **Safe Performance Seed Dataset (Dev Only)**:
   - ~500 listings across categories and UNIOSUN campuses with realistic Nigerian student prices, conditions, and timestamps.
   - <= 5 real WebP placeholder files in `apps/web/public/placeholders/` sized matching production variants:
     - Thumb: ~20 KB at 400px.
     - Display: ~140 KB at 1000px.
     - NOT SVG, ensuring authentic Lighthouse audit and transfer metrics.
   - Seed photo rows marked with `isSeed: true` so storage delete is never called for them.
   - Guarded execution via centralized `assertSafeSeedEnvironment()` requiring `ALLOW_SEED=1` and dev-host allowlist, refusing production host.
6. **Web Client UI Components & Pages**:
   - **Home (`/`)**: Search bar with instant suggestion dropdown (min 2 chars, 250ms debounce, cached, no page-load fetch), `CategoryPills`, and Newest feed.
   - **SSR First Page**: The server fetch for the first feed page is a single API call; reports request count and waterfall.
   - **Listing Card**: Plain `<img>` thumbnail with explicit width/height and `aspect-ratio` (0 CLS); first 2–4 feed cards render eager with `fetchpriority="high"`, the rest lazy (`loading="lazy"` decoding="async"). Title, price in Naira (`formatNaira`), condition badge, verified seller badge, campus location (graceful display for campus-level locations), availability indicator (sold styled greyed/muted).
   - **Search Page (`/search`)**: Query input with suggestions, filter sheet (category, price range, condition, campus/location, verified only, availability), sort dropdown, infinite scroll with `IntersectionObserver` plus visible "Load more" button fallback, skeleton loaders, empty and error states, shareable URL state synchronization via query parameters, `content-visibility: auto` on card lists for DOM performance.
7. **Performance Proof & Verification**:
   - Lighthouse mobile run on preview domain (home and search routes): targets <= 150 KB first-load JS and <= 3s LCP under Slow 4G + 4x CPU throttle with 500-listing dataset. Report LCP, CLS, JS transferred, and total image bytes for the first feed page on preview.
   - Exhaustive test suite covering ranking precedence, filter combinations, pagination stability, status eligibility, PII absence, and security edge cases.

### Out of Scope
- Seller profile pages and seller-type filter (`verifiedOnly` evaluates `user.sellerStatus` directly; SellerProfile is deferred).
- Popular feed tab (requires event tracking pipeline in future step).
- Personalized recommendation engine (rule-based `GlobalRanker` only).

---

## Plan

1. **Architecture & Contracts**:
   - Update [ADR 0008: Search Architecture, Indexing Strategy, and Multi-Signal Ranking](file:///docs/adr/0008-search-feed-ranking.md) with amendments a–h.
   - Implement `PublicListingCard`, `SearchQuerySchema`, `SuggestQuerySchema`, and search contracts in `packages/types` and `packages/validation`.
   - Implement `formatDisplayName` in `packages/utils` with unit test suite covering initials, unicode, and single words.
   - Implement `isListingDiscoverable` eligibility helper with unit tests covering all statuses, availability filter, and search vs feed modes.
2. **Database Schema & Migrations**:
   - Add generated `search_vector` column, GIN index, trigram index, and `is_seed` column on `listing_photos` in `apps/api/src/db/schema.ts`.
   - Generate Drizzle migration `0005_add_search_vector.sql` and apply to development Neon database.
   - Author `EXPLAIN` query verification tests in `apps/api/src/__tests__/search-explain.test.ts`.
3. **Core Services & API Handlers**:
   - Implement `RankingService` (`GlobalRanker`) and `SearchService` using `websearch_to_tsquery('simple', :query)` and keyset pagination without `COUNT(*)`.
   - Build `GET /api/listings` and `GET /api/search/suggest` route handlers with fail-closed IP rate limiting and edge caching (`s-maxage=60, stale-while-revalidate=120`).
   - Write comprehensive search integration test suite covering status eligibility, syntax safety (`quotes, & | ! : * ( )`, emoji, RTL, 10k chars, SQL injection), keyset tie-breaker stability, and PII protection.
4. **Seed Pipeline & WebP Placeholders**:
   - Generate <= 5 realistic WebP images in `apps/web/public/placeholders/` sized ~20 KB thumb / ~140 KB display.
   - Build `apps/api/src/db/seeds/dev-listings-500.ts` with host-allowlist, static image placeholders, and `isSeed: true` flags.
   - Run seed on dev database.
5. **Web UI Components**:
   - Build `ListingCard` with eager/lazy LCP priority (`fetchpriority="high"` for first 2–4), explicit aspect-ratio, and token styling.
   - Update Home page (`/`) with SSR single API fetch, waterfall reporting, and search bar with debounced suggestions (client cache, min 2 chars, no page-load fetch).
   - Build Search page (`/search`) with filter sheet, sort options, suggestions, shareable URL params, and infinite scroll with "Load more" fallback.
6. **Testing & Verification**:
   - Run automated test suites across all packages.
   - Real browser verification at 375px and 1280px viewports under Slow 4G + 4x CPU throttle.
   - Measure and report LCP, CLS, JS transferred, image bytes, requests count, waterfall, and edge cache revalidation.
7. **Two-Axis Code Review & PR**:
   - Execute two-axis code review (`code-review` skill).
   - PR, merge `--no-ff`, and apply migration 0005 to production database using `scripts/run-prod-migrations.ps1`.

---

## Implementation

*(To be updated during execution)*

---

## Discoveries

*(To be updated during execution)*

---

## Verification

*(To be updated during execution)*

---

## Decisions

*(To be updated during execution)*

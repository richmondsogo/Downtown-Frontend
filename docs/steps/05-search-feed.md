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
   - Single canonical function `isListingDiscoverable(status, isSearchQuery)` used everywhere:
     - `published`: discoverable in home feed and search.
     - `reserved`: discoverable in home feed and search, ranked below published.
     - `sold`: discoverable **only** via direct search queries (`isSearchQuery = true`) and ranked last; **never** appears in the unsearched home feed.
     - `draft`, `pending_moderation`, `archived`: **NEVER** discoverable under any circumstance.
3. **Database Schema & Migrations (`apps/api/src/db/`)**:
   - Add generated column `search_vector` on `listings`:
     `setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B') STORED`
   - GIN index on `search_vector`.
   - B-Tree and trigram composite indexing to support keyset pagination and typo-tolerant search.
   - Query plan verification with `EXPLAIN` asserting index scans.
4. **Backend Services & API Layer**:
   - `SearchService` and `RankingService` behind clean TypeScript interfaces.
   - Multi-signal `GlobalRanker` implementing GOAL.md 6.3:
     `Relevance -> Availability -> Location proximity boost (same campus bonus, soft signal only) -> Recency -> Seller trust & engagement (weight 0 initially)`.
   - Keyset pagination with deterministic tiebreaker `(sort_score, id)`.
   - `GET /api/listings`: Feed/search/filter with validated query params, fail-closed per-IP rate limiting, and public edge cache headers (`public, s-maxage=60, stale-while-revalidate=300`).
   - `GET /api/search/suggest`: Fast title prefix suggestion endpoint, payload limit 6 items, < 2 KB response.
5. **Safe Performance Seed Dataset (Dev Only)**:
   - ~500 listings across categories and UNIOSUN campuses with realistic Nigerian student prices, conditions, and timestamps.
   - Static placeholder images (<= 5 local SVGs/WebP files served from `apps/web/public/placeholders/`) avoiding Vercel Blob quota consumption.
   - Guarded execution: requires `ALLOW_SEED=true`, refuses production host (`CONFIRM_PROD_HOST` guard prevents accidental execution on prod).
6. **Web Client UI Components & Pages**:
   - **Home (`/`)**: Search bar with instant suggestion dropdown, `CategoryPills`, and Newest feed.
   - **Listing Card**: Plain `<img>` thumbnail with width/height, lazy loading, async decoding; title, price in Naira (`formatNaira`), condition badge, verified seller badge, campus location, availability indicator (sold styled greyed/muted).
   - **Search Page (`/search`)**: Query input with suggestions, filter sheet (category, price range, condition, campus/location, verified only, availability), sort dropdown, infinite scroll with `IntersectionObserver` plus visible "Load more" button fallback, skeleton loaders, empty and error states, shareable URL state synchronization via query parameters, `content-visibility: auto` on card lists for DOM performance.
7. **Performance Proof & Verification**:
   - Lighthouse mobile run on preview domain (home and search routes): targets <= 150 KB first-load JS and <= 3s LCP under Slow 4G + 4x CPU throttle with 500-listing dataset.
   - Exhaustive test suite covering ranking precedence, filter combinations, pagination stability, status eligibility, PII absence, and security edge cases.

### Out of Scope
- Seller profile pages and seller-type filter (`verifiedOnly` evaluates `user.sellerStatus` directly; SellerProfile is deferred).
- Popular feed tab (requires event tracking pipeline in future step).
- Personalized recommendation engine (rule-based `GlobalRanker` only).

---

## Plan

1. **Architecture & Contracts**:
   - Author [ADR 0008: Search Architecture, Indexing Strategy, and Multi-Signal Ranking](file:///docs/adr/0008-search-feed-ranking.md).
   - Implement `PublicListingCard`, `SearchQuerySchema`, and search contracts in `packages/types` and `packages/validation`.
   - Implement `formatDisplayName` in `packages/utils` with unit test suite covering initials, unicode, and single words.
2. **Database Schema & Migrations**:
   - Add generated `search_vector` column and GIN index to `listings` in `apps/api/src/db/schema.ts`.
   - Generate Drizzle migration `0005_add_search_vector.sql` and apply to development Neon database.
   - Author `EXPLAIN` query verification tests in `apps/api/src/__tests__/search-explain.test.ts`.
3. **Core Services & API Handlers**:
   - Implement `isListingDiscoverable` eligibility helper with unit tests covering all statuses.
   - Implement `RankingService` (`GlobalRanker`) and `SearchService`.
   - Build `GET /api/listings` and `GET /api/search/suggest` route handlers with fail-closed IP rate limiting and edge caching.
4. **Seed Pipeline**:
   - Build `apps/api/src/db/seeds/dev-listings-500.ts` with host-allowlist and static image placeholder protection.
   - Run seed on dev database.
5. **Web UI Components**:
   - Build `ListingCard` with accessible tokens and plain `<img>`.
   - Update Home page (`/`) with search bar and newest feed.
   - Build Search page (`/search`) with filter sheet, sort options, suggestions, shareable URL params, and infinite scroll with "Load more" fallback.
6. **Testing & Verification**:
   - Unit and integration tests for ranking, pagination walking, status gates, PII absence, and SQL injection safety.
   - Run Lighthouse mobile audits and record bundle sizes.
   - Browser verification at 375px and 1280px viewports.
7. **Two-Axis Code Review & PR**:
   - Two-axis code review (Standards + Spec).
   - PR, merge `--no-ff`, and apply migration 0005 to production database.

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

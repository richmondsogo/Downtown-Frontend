# Step 03: Taxonomy & Locations Reference Data, Cacheable Endpoints, and Selection Primitives

**Step Branch**: `step/03-taxonomy-locations`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/7  

---

## Objective

Establish contract-first domain taxonomy and location models, seed reference data for Osun State University (UNIOSUN), implement high-performance cacheable query endpoints (`GET /categories`, `GET /locations/autocomplete`), support authenticated custom location submission with anti-abuse guards, and deliver reusable mobile-first UI selection components (`CategoryPills`, `LocationSelector`) verified at 375px and 1280px.

---

## Scope & Approved Amendments

### 1. Categories (Strictly per GOAL.md 5.3)
- Top-level categories only (no subcategories in v1):
  1. **Electronics** (`electronics`)
  2. **Fashion & Accessories** (`fashion-accessories`)
  3. **Food & Drinks** (`food-drinks`)
  4. **Home & Living** (`home-living`)
  5. **Books & Study Materials** (`books-study-materials`)
  6. **Beauty & Personal Care** (`beauty-personal-care`)
  7. **Services** (`services`)
  8. **Tickets & Events** (`tickets-events`)
  9. **Other** (`other`)
- Endpoint `GET /api/categories`: returns active categories sorted by `displayOrder`.
- Cache headers: `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`.

### 2. Campuses & Reference Locations (UNIOSUN)
- Seed strictly:
  - University: Osun State University (UNIOSUN)
  - Six Campuses *(to be confirmed by founders)*:
    1. Osogbo (Main Campus) (`osogbo`)
    2. Ikire Campus (`ikire`)
    3. Okuku Campus (`okuku`)
    4. Ifetedo Campus (`ifetedo`)
    5. Ipetu-Ijesha Campus (`ipetu-ijesha`)
    6. Ejigbo Campus (`ejigbo`)
  - Exactly one reference Location row per campus (`type="campus"`, `is_curated=true`).
  - No speculative "campus landmarks" in initial seeds.
  - Student-area locations sourced strictly from `docs/data/student-areas.csv` (initialized headers-only) via a CSV loader function.
- Idempotent seed script (`pnpm --filter api db:seed:taxonomy`).

### 3. Custom Locations & Autocomplete Search (`pg_trgm`)
- **Database Search Extension**:
  - Migration applies `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.
  - Trigram and btree prefix indexes on location names.
  - Query plan verified using `EXPLAIN ANALYZE`.
- **Custom Location Creation (`POST /api/locations`)**:
  - Requires authenticated session.
  - Rate limited (max 5 requests per 10 minutes per user/IP).
  - Validation: trimmed name, length between 3 and 80 characters.
  - Anti-abuse: rejects names containing phone numbers (e.g. Nigerian phone patterns) or URLs (`http`, `www`, `.com`, etc.).
  - Duplicate handling: case-insensitive deduplication within the same campus.
  - Created with `is_curated = false` and `creator_id = session.userId`.
- **Autocomplete (`GET /api/locations/autocomplete?q=...&campusId=...`)**:
  - For unauthenticated/public users: returns ONLY curated locations (`is_curated = true`).
  - For authenticated users: returns curated locations PLUS custom locations created by the current user (`is_curated = true OR creator_id = currentUserId`).
  - Ranking: exact/prefix match > trigram similarity, curated first, limit 8, minimal payload (`id`, `name`, `slug`, `type`, `isCurated`).
  - Cache headers: short edge cache `s-maxage=60, stale-while-revalidate=300` (for public queries).

### 4. UI Components (`apps/web`)
- Strict styling discipline: strictly use design tokens and shared components; no hardcoded hex/RGB colors, arbitrary spacing, or one-off page styles.
- **`CategoryPills`**:
  - Horizontally scrollable without layout shifts on mobile (375px).
  - Flex-wrapable on desktop (1280px).
  - Keyboard accessible (`role="tablist"` / `role="tab"`).
- **`LocationSelector`**:
  - Campus filter select + location autocomplete input.
  - Touch targets ≥ 44px.
  - Clean error states and custom location submission trigger.

### 5. Browser Verification & Edge Cache Verification
- Visual inspection on desktop (1280px) and mobile (375px) with screenshots stored in `docs/steps/assets/03-*`.
- Edge caching verification: test preview deployment web origin for `x-vercel-cache: HIT`.

---

## Implementation Plan

1. **Contracts & Validation First (`packages/types`, `@downtown/validation`)**:
   - Types: `University`, `Campus`, `Category`, `Location`, `LocationType`, `CreateLocationInput`, `LocationAutocompleteQuery`.
   - Zod schemas: category and location queries, custom location creation schema with phone/URL rejection and length bounds.
   - Unit tests covering all validation rules.
2. **Database Schema & Migrations (`apps/api`)**:
   - Tables: `universities`, `campuses`, `categories`, `locations` in `apps/api/src/db/schema.ts`.
   - Migration enabling `pg_trgm` and adding trigram indexes.
   - Run `pnpm --filter api db:generate` and `pnpm --filter api db:migrate`.
   - Verify index usage via `EXPLAIN`.
3. **Reference Data & CSV Loader (`apps/api/src/db/seeds`)**:
   - Create `docs/data/student-areas.csv` (headers only).
   - Implement `taxonomy-locations.ts` seed with UNIOSUN, 6 campuses, 6 campus locations, 9 categories, and CSV loader.
   - Verify idempotency by running seed twice.
4. **API Endpoints (`apps/api`)**:
   - `GET /api/categories` with public edge cache headers.
   - `GET /api/locations/autocomplete` with `pg_trgm` matching and privacy-filtered custom locations.
   - `POST /api/locations` with auth, rate limit, normalization, duplicate handling, phone/URL rejection.
   - Integration tests covering all endpoints, edge cases, and cache headers.
5. **UI Primitives (`apps/web`)**:
   - Build `CategoryPills` and `LocationSelector` using tokens from `DESIGN.md`.
   - Add unit tests.
   - Integrate into home exploration view.
6. **Automated Verification & Browser Verification**:
   - Run `.\scripts\verify.ps1`.
   - Capture desktop and mobile screenshots with browser tool.
7. **PR & Checkpoint**:
   - Submit PR, review diff, merge with `--no-ff`, and log provenance.

---

## Implementation Notes & Discoveries

1. **PostgreSQL `pg_trgm` Extension & GIN Indexes**:
   - `pg_trgm` extension was enabled in migration `0001_groovy_supreme_intelligence.sql`.
   - Added GIN trigram index `location_name_trgm_idx` (`USING gin (name gin_trgm_ops)`) and B-Tree prefix index `location_name_lower_idx` (`lower(name)`).
   - Verified via `EXPLAIN` query plan with `enable_seqscan = off` to confirm bitmap index scan path on candidate autocomplete queries.
2. **Category Names & Slugs**:
   - Strictly matched GOAL.md section 5.3: Electronics (`electronics`), Fashion & Accessories (`fashion-accessories`), Food & Drinks (`food-drinks`), Home & Living (`home-living`), Books & Study Materials (`books-study-materials`), Beauty & Personal Care (`beauty-personal-care`), Services (`services`), Tickets & Events (`tickets-events`), Other (`other`). No subcategories in v1.
3. **Reference Data & Student-Areas Loader**:
   - Seeded University (UNIOSUN), 6 Campuses (`osogbo`, `ikire`, `okuku`, `ifetedo`, `ipetu-ijesha`, `ejigbo` - marked *to be confirmed by founders*), and exactly 1 curated location per campus (`type=campus`).
   - Sourced student areas strictly through `docs/data/student-areas.csv` (initialized with headers only).
   - Seed script `pnpm --filter api db:seed:taxonomy` verified idempotent across successive executions.
4. **Custom Location Submission & Privacy Filtering**:
   - `POST /api/locations` requires session authentication and is rate limited (5 requests / 10 minutes per user).
   - Rejects names containing phone numbers (e.g. Nigerian phone patterns) or URLs.
   - Case-insensitive deduplication within campus (`isDuplicate: true`).
   - Autocomplete privacy model: public queries receive ONLY curated locations (`isCurated = true`), whereas authenticated callers receive curated locations plus their own custom uncurated submissions (`creatorId = session.userId`).
5. **Edge Cache Headers**:
   - Categories: `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`.
   - Autocomplete: `Cache-Control: public, max-age=10, s-maxage=60, stale-while-revalidate=300` (for public queries); `private, no-cache, no-store, must-revalidate` (for authenticated queries).
6. **Design System & Styling Discipline**:
   - Built `CategoryPills` and `LocationSelector` strictly using CSS variables and semantic design tokens from `DESIGN.md`. Minimum 44px tap targets for mobile usability.

---

## Verification & Screenshots

### 1. Verification Suite (`scripts/verify.ps1`)
- **Status**: `12 passed, 0 failed, 0 skipped (of 12 checks)`
- Typecheck: 5/5 packages clean.
- Unit & integration tests:
  - `@downtown/validation`: 26/26 passed (location normalization, phone/URL rejection, query schemas).
  - `@downtown/api`: 31/31 passed (taxonomy, locations autocomplete, rate limiting, and custom location creation).
  - `@downtown/web`: 14/14 passed (taxonomy UI contracts, category switching, combobox validation).
- Monorepo build: Turborepo completed production builds of `api` and `web`.

### 2. Browser Verification Artifacts
- **Mobile Viewport (375x812)**:
  ![Mobile Viewport 375px](file:///c:/Users/Richmond/Desktop/Open%20Source%20Projects/DOWNTOWN/Downtown-Frontend/docs/steps/assets/03-mobile-375px.png)
- **Mobile Location Dropdown**:
  ![Mobile Location Combobox](file:///c:/Users/Richmond/Desktop/Open%20Source%20Projects/DOWNTOWN/Downtown-Frontend/docs/steps/assets/03-mobile-location-dropdown.png)
- **Desktop Viewport (1280x800)**:
  ![Desktop Viewport 1280px](file:///c:/Users/Richmond/Desktop/Open%20Source%20Projects/DOWNTOWN/Downtown-Frontend/docs/steps/assets/03-desktop-1280px.png)

### 3. Edge Cache Verification & Next.js Rewrite Analysis
- **Direct Preview API Edge Cache Test**:
  - Request 1 to `https://downtown-api-git-step-03-taxonomy-locations-richmondsogo.vercel.app/api/categories`:
    - HTTP 200 OK
    - `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
    - `x-vercel-cache: MISS`
  - Request 2 to `https://downtown-api-git-step-03-taxonomy-locations-richmondsogo.vercel.app/api/categories`:
    - HTTP 200 OK
    - `x-vercel-cache: HIT` (`Age: 1`)
  - **Verdict**: Direct API edge caching on Vercel is working exactly as designed.
- **Web Domain Rewrite Analysis (`apps/web/next.config.js`)**:
  - Currently, `apps/web/next.config.js` defines an external rewrite:
    ```ts
    {
      source: '/api/:path*',
      destination: `${process.env.API_INTERNAL_URL || 'http://localhost:3001'}/api/:path*`,
    }
    ```
  - In the Vercel project environment settings for `downtown-web`, `API_INTERNAL_URL` is configured to `https://downtown-api.vercel.app` (the production API deployment of `master`), rather than the branch preview API. Consequently, hitting `/api/categories` through the preview web domain routed to production (which returns 404 until Step 03 merges).
  - Additionally, Next.js external rewrites pass through a serverless proxy execution and do not automatically persist in Vercel's edge cache for the web zone unless clients call the API directly or Next.js route handlers leverage Data Cache ISR (`fetch(..., { next: { revalidate } })`).
  - **Proposed Fix**:
    1. For production & preview, have the web client query `NEXT_PUBLIC_API_URL` directly for public reference data (`/api/categories`, `/api/locations/autocomplete`), bypassing the serverless rewrite hop and allowing Vercel Edge Network to return instant cache hits directly from `downtown-api`.
    2. Maintain the `/api/*` rewrite as fallback for cookie-based session auth endpoints to avoid third-party cookie restrictions.

---

## Commit Provenance

- **First Commit SHA**: `0e7634f`
- **Last Commit SHA**: `0740966`
- **PR URL**: `https://github.com/richmondsogo/Downtown-Frontend/pull/7`
- **Merge Commit SHA**: `b1330aca42281f36153436e15ce256e1196e9326`


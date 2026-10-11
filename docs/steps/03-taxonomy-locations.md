# Step 03: Taxonomy & Locations Reference Data, Cacheable Endpoints, and Selection Primitives

**Step Branch**: `step/03-taxonomy-locations`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending]`  

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

<!-- To be documented during execution -->

---

## Verification & Screenshots

<!-- To be documented after verification -->

---

## Commit Provenance

- **First Commit SHA**: `[Pending]`
- **Last Commit SHA**: `[Pending]`
- **PR URL**: `[Pending]`
- **Merge Commit SHA**: `[Pending]`

# Step 03: Taxonomy & Locations Reference Data, Cacheable Endpoints, and Selection Primitives

**Step Branch**: `step/03-taxonomy-locations`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending]`  

---

## Objective

Establish contract-first domain taxonomy and location models, seed reference data for Osun State University (UNIOSUN), implement high-performance cacheable query endpoints (`GET /categories`, `GET /locations/autocomplete`), and deliver reusable mobile-first UI selection components (`CategoryPills`, `LocationSelector`) verified at 375px and 1280px.

---

## Scope

### Included
- **Schema Contracts & Tables (`@downtown/types`, `@downtown/validation`, `apps/api/src/db/schema.ts`)**:
  - `University`: id, name, slug, shortCode, createdAt.
  - `Campus`: id, universityId, name, slug, code, address, createdAt.
  - `Category`: id, name, slug, description, icon, displayOrder, isActive, createdAt.
  - `Location`: id, campusId, name, slug, type (`campus_facility`, `hostel`, `off_campus_area`), landmark, displayOrder, isActive, createdAt.
- **Reference Data Seed (`apps/api/src/db/seeds/taxonomy-locations.ts`)**:
  - Idempotent seed script (`pnpm --filter api db:seed:taxonomy`) populating:
    - UNIOSUN and all 6 campuses (Osogbo, Ikire, Okuku, Ifetedo, Ipetu-Ijesha, Ejigbo).
    - 9 official v1 product/service categories.
    - Curated hostels, on-campus facilities, and off-campus student residential zones.
- **API Endpoints (`apps/api`)**:
  - `GET /api/categories`: Returns active categories ordered by `displayOrder`, with HTTP edge-cache headers (`Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`).
  - `GET /api/locations/autocomplete?q=...&campusId=...`: Prefix/substring search matching location names and landmarks, cached with appropriate HTTP headers.
- **Web UI Components (`apps/web`)**:
  - `CategoryPills`: Horizontally scrollable on mobile (375px), wrapable on desktop (1280px), keyboard navigable, active indicator, zero layout shifts.
  - `LocationSelector`: Dropdown/combobox modal supporting campus filtering and location autocomplete with Nigerian campus landmarks.
- **Automated Tests**:
  - Validation contract unit tests in `packages/validation`.
  - API endpoint integration tests in `apps/api/src/__tests__/taxonomy-locations.test.ts`.
  - Component unit tests in `apps/web/src/__tests__/category-pills.test.tsx` and `location-selector.test.tsx`.
- **Browser Verification**:
  - Chrome DevTools MCP screenshots at 375px and 1280px saved to `docs/steps/assets/03-*`.

### Excluded
- Listing creation, search indexing, or item queries (reserved for Step 04).
- Admin CRUD UI for editing categories/locations (managed via database seeds in v1).

---

## Plan

1. **Contracts & Validation First (`packages/types`, `packages/validation`)**:
   - Define TypeScript interfaces and Zod schemas for `University`, `Campus`, `Category`, `Location`, and autocomplete query parameters.
   - Add unit tests for schema validation.
2. **Database Schema & Migrations (`apps/api`)**:
   - Add Drizzle table definitions in `apps/api/src/db/schema.ts` with indexes and foreign keys.
   - Run `pnpm --filter api db:generate` to produce SQL migration `0001_taxonomy_locations.sql`.
   - Apply migration to dev Neon database via `pnpm --filter api db:migrate`.
3. **Idempotent Reference Data Seed (`apps/api/src/db/seeds`)**:
   - Create seed file for UNIOSUN campuses, categories, and curated locations using `ON CONFLICT DO NOTHING` / `upsert`.
   - Add `db:seed:taxonomy` script and verify idempotency across successive runs.
4. **Cacheable API Endpoints (`apps/api`)**:
   - Implement `GET /api/categories` with public edge-cache headers.
   - Implement `GET /api/locations/autocomplete` with campus filtering and search query parsing.
   - Write integration tests covering pagination, filtering, search relevance, and cache headers.
5. **UI Primitives (`apps/web`)**:
   - Implement `CategoryPills` following `DESIGN.md` guidelines (mobile-friendly horizontal scroll, accessible ARIA roles).
   - Implement `LocationSelector` combobox dialog with touch targets ≥ 44px.
   - Integrate both components into the homepage marketplace exploration view.
6. **Automated Verification**:
   - Run monorepo checks via `scripts/verify.ps1`.
7. **Browser Verification & Screenshot Evidence**:
   - Capture desktop (1280px) and mobile (375px) screenshots in `docs/steps/assets/03-*`.
8. **Review & PR**:
   - Open Pull Request, run `code-review` checks, and land via `--no-ff`.

---

## Implementation

<!-- Implementation decisions and discoveries will be recorded as work progresses -->

---

## Verification

<!-- Automated check results and screenshot links will be recorded here -->

---

## Diff / Checkpoint

- Pull Request URL: Pending
- First commit SHA: Pending
- Last commit SHA: Pending
- Merge commit SHA: Pending

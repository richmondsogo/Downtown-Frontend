# Step 06: Listing Detail Page & Saved Listings

**Step Branch**: `step/06-listing-detail-saved`  
**Primary Branch**: `master`  
**Pull Request**: `TBD`  

---

## Objective

Deliver the complete, responsive public listing detail experience and persistent saved listings system for Downtown:
1. High-fidelity public listing page (`/listings/[id]`) featuring an accessible image carousel/viewer, pricing & negotiable tags, availability indicators, seller trust card, campus safety banner, location badges, and a disabled-state Contact Seller placeholder.
2. Lightweight view counting with rate limiting and abuse prevention.
3. Persistent saved listings feature (database model, authenticated API toggle, optimistic UI, dedicated `/saved` page with greyed-out sold listings).

---

## Scope

### In Scope
1. **Public Listing Detail Page (`apps/web/src/app/listings/[id]/page.tsx`)**:
   - SSR first render with metadata (OpenGraph title, image, description).
   - Responsive photo carousel (swipeable on mobile, thumbnail navigation on desktop, full display WebP variant, explicit aspect-ratios, 0 CLS).
   - Pricing display in Nigerian Naira (`formatNaira`) with negotiable badge.
   - Status indicators: `available`, `reserved` (amber badge), `sold` (greyed banner).
   - Detailed item metadata: condition badge, category breadcrumb, detailed description, publication date (`posted X days ago`).
   - Location display: campus name, specific student area or landmark, and campus-level fallback for non-Osogbo campuses.
   - Seller Trust Card: seller display name (First + Last Initial or business name), verified badge, student verification status, campus association, member duration. **Strict privacy boundary: zero seller email, phone, matric number, or internal userId exposed.**
   - Campus Safety Notice: clear safety guidelines for university campus commerce (meet in public campus areas, inspect before payment, no upfront fees).
   - Contact Seller CTA Placeholder: disabled button with informative state ("Direct seller chat unlocks in Step 07").
2. **Lightweight View Counter (`POST /api/listings/[id]/view`)**:
   - Cheap, atomic database increment (`view_count = view_count + 1`).
   - Debounced/rate-limited per client IP and session window to prevent artificial inflation.
3. **Database Schema & Migrations for Saved Listings**:
   - New table `saved_listings`:
     - `userId` (references `users.id` cascade).
     - `listingId` (references `listings.id` cascade).
     - `createdAt` (timestamp with time zone).
     - Primary key: composite `(userId, listingId)`.
     - Index on `(userId, createdAt)` for fast saved listings pagination.
   - Drizzle migration `0006_add_saved_listings.sql`.
4. **Saved Listings API Layer (`apps/api`)**:
   - `POST /api/listings/[id]/save`: Authenticated toggle (saves if not saved, removes if already saved) returning `{ saved: boolean }`.
   - `GET /api/listings/saved`: Authenticated endpoint fetching the user's saved listings (projected as `PublicListingCard`, preserving sold status).
5. **Saved Listings UI**:
   - Bookmark/heart toggle button on both `ListingCard` and `ListingDetailPage`.
   - Optimistic UI updates with instant client feedback.
   - Unauthenticated toggle opens the existing `AuthGateModal`.
   - Saved Listings Page (`apps/web/src/app/saved/page.tsx`): authenticated grid of saved items with sold items greyed out and empty states.
6. **Testing & Verification**:
   - Unit tests for saved listings validation and data contracts.
   - Integration tests for `/api/listings/[id]`, `/api/listings/[id]/save`, and `/api/listings/saved`.
   - Browser verification on mobile (375px) and desktop (1280px).

### Out of Scope
- Direct WhatsApp / messaging handoff (deferred to Step 07).
- Seller review and ratings system (deferred to Step 08).
- Multi-item saved collections/folders (single saved list only).

---

## Plan

1. **Database Schema & Migrations**:
   - Define `saved_listings` table in `apps/api/src/db/schema.ts`.
   - Generate migration `0006_add_saved_listings.sql` and apply to development Neon database.
2. **Contracts & Validation**:
   - Define `PublicListingDetail` interface in `packages/types/src/index.ts`.
   - Add schemas in `packages/validation` for saved listings and view counting.
3. **API & Service Implementation**:
   - Create `listing-detail.service.ts` or extend `listing.service.ts` to return public detail projection with privacy guarantees.
   - Implement `GET /api/listings/[id]` with `public, s-maxage=60, stale-while-revalidate=120`.
   - Implement `POST /api/listings/[id]/view` (lightweight atomic view counter with IP rate limiting).
   - Implement `POST /api/listings/[id]/save` and `GET /api/listings/saved`.
   - Author integration tests in `apps/api/src/__tests__/listing-detail.test.ts`.
4. **Web UI Components & Pages**:
   - Build image carousel component `apps/web/src/components/photo-carousel.tsx`.
   - Build seller trust card component `apps/web/src/components/seller-trust-card.tsx`.
   - Build safety notice component `apps/web/src/components/safety-notice.tsx`.
   - Build save listing toggle button with optimistic UI `apps/web/src/components/save-button.tsx`.
   - Build `/listings/[id]` page with SSR initial fetch, OpenGraph metadata, and full detail layout.
   - Build `/saved` page for authenticated users.
5. **Testing & Performance Verification**:
   - Run unit and integration tests.
   - Verify performance and layout on mobile and desktop via Chrome DevTools.
6. **Review, PR & Checkpoint**:
   - Run two-axis code review.
   - Open PR, merge `--no-ff`, and apply migration 0006 to production database.

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

---

## Commit Provenance

- First Commit: `934afdc` (initialize step 06 plan)
- Implementation Commit: `5e3b753` (public listing detail page and saved listings system)
- Pull Request: [PR #11](https://github.com/richmondsogo/Downtown-Frontend/pull/11)
- Merge Commit: `414408b686b3e44de434255ed26beb27b6dde32e`

---

## Implementation

1. **Schema & Database Migrations**:
   - Added `view_count` integer column defaulting to 0 on `listings` table.
   - Defined `saved_listings` table with composite primary key `(user_id, listing_id)`, foreign key cascades to `user` and `listings`, and indexing on `(user_id, created_at)`.
   - Generated idempotent migration `apps/api/src/db/migrations/0006_yielding_sunfire.sql` and applied cleanly to both development and production Neon PostgreSQL instances.
2. **Contracts & Validation**:
   - Added `PublicListingPhoto`, `SellerTrustProfile`, `PublicListingDetail`, `SavedListingItem`, `ToggleSaveResponse` to `packages/types/src/index.ts`.
   - Added `formatMemberSince(date)` and `formatTimeAgo(date)` to `packages/utils/src/index.ts` with comprehensive unit tests (17/17 passed).
3. **Backend Service & Routing**:
   - `apps/api/src/services/listing.service.ts`: Implemented `getPublicListingDetail(listingId, currentUserId)` ensuring strict privacy projection (zero seller email, phone, matric number, or internal user ID) and draft IDOR gating.
   - `apps/api/src/services/listing.service.ts`: Implemented `incrementViewCount(listingId, clientIp)` with atomic increment and IP sliding window rate limiting via `app_rate_limit`.
   - `apps/api/src/services/saved.service.ts`: Implemented `SavedService` with `toggleSave(userId, listingId)`, `getSavedListings(userId)` (preserving sold status), and `isListingSaved(userId, listingId)`.
   - `apps/api/src/app/api/listings/[id]/route.ts`: Updated `GET` endpoint returning `PublicListingDetail` with `public, s-maxage=60, stale-while-revalidate=120` edge cache headers for unauthenticated visitors, and `private, no-cache` when authenticated.
   - `apps/api/src/app/api/listings/[id]/view/route.ts`: Implemented `POST` atomic view counting endpoint.
   - `apps/api/src/app/api/listings/[id]/save/route.ts`: Implemented `POST` authenticated save toggle endpoint.
   - `apps/api/src/app/api/listings/saved/route.ts`: Implemented `GET` authenticated user saved collection endpoint.
4. **Frontend Architecture & Components**:
   - `apps/web/src/components/photo-carousel.tsx`: Built accessible image carousel supporting touch swipe gestures, thumbnail strip, full-res modal lightbox, and explicit `aspect-[4/3]` dimensions (0 CLS).
   - `apps/web/src/components/seller-trust-card.tsx`: Built seller trust badge showcasing seller name, verified student status, campus affiliation, member join date, and active listing count.
   - `apps/web/src/components/campus-safety-notice.tsx`: Built safety banner with UNIOSUN campus commerce guidelines (meet in daylight in busy campus public areas, inspect before pay, zero advance transfers).
   - `apps/web/src/components/save-button.tsx`: Built optimistic toggle button with unauthenticated `AuthGateModal` trigger.
   - `apps/web/src/app/listings/[id]/page.tsx`: Built public listing detail page with dynamic SSR `generateMetadata` for OpenGraph and responsive 2-column layout.
   - `apps/web/src/app/saved/page.tsx`: Built saved items page with sold items greyed out and empty state.
   - `apps/web/src/components/header.tsx`: Added quick-access saved items heart badge with link to `/saved`.

---

## Discoveries

1. **Edge Cache Headers vs. Personalization**:
   - When serving public listing details, edge caching headers (`public, s-maxage=60, stale-while-revalidate=120`) must only be sent when the request is unauthenticated. When a valid user session is detected, `private, no-cache, no-store, must-revalidate` is returned so that the computed `isSaved` boolean is never cached in shared intermediate caches.
2. **Atomic View Count Deduplication**:
   - Utilizing the existing `app_rate_limit` sliding window table (`view:${listingId}:${clientIp}`, 1 request / 60 seconds) prevents artificial view count inflation from browser refreshes while maintaining zero external dependencies (Redis-free).

---

## Decisions

1. **Composite Primary Key for Saved Listings**:
   - Chosen `(user_id, listing_id)` composite primary key to guarantee at the database constraint level that a user cannot duplicate saves for the same listing.
2. **Preserving Sold Items in Saved Collection**:
   - Unlike public search feed where sold items are ranked last or omitted without search keywords, saved items retain visibility with an explicit `SOLD` badge and opacity treatment so students can track transaction outcomes without confusing missing cards.

---

## Verification

1. **Automated Test Suite**:
   - `pnpm test`: 12/12 test files passed (118 tests total).
   - `apps/api/src/__tests__/listing-detail.test.ts`: 9/9 tests passed (privacy boundary, draft IDOR protection, seller draft access, atomic view count increment & IP rate limiting, 401 save refusal, authenticated toggle, and saved list retrieval).
   - `packages/utils/src/__tests__/utils.test.ts`: 17/17 tests passed (date and time formatting).
2. **Repository Verification**:
   - `scripts/verify.ps1`: 12/12 checks passed (Git state, manifests, toolchain, typechecks, automated tests, monorepo build).
3. **Browser Verification (Chrome DevTools MCP)**:
   - Emulated conditions: Slow 4G + 4x CPU slowdown.
   - Mobile Viewport (375x667): Verified responsive layout, carousel, seller trust card, safety banner, and disabled Contact Seller CTA.
   - Desktop Viewport (1280x800): Verified 2-column layout, thumbnail strip, breadcrumbs, and 0 CLS.
   - Interactive: Verified Save button optimistic state and unauthenticated / saved page rendering.
4. **Production Database Migration**:
   - Ran `scripts/run-prod-migrations.ps1 -Action migrate -ConfirmHost 'ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech'`
   - Verified `saved_listings` table created and live on production Neon database.

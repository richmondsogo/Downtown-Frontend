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

- First Commit: `TBD`
- Implementation Commit: `TBD`
- Pull Request: `TBD`
- Merge Commit: `TBD`

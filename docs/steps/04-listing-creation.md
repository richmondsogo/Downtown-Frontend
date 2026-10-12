# Step 04: Listing Creation & Photo Pipeline

**Step Branch**: `step/04-listing-creation`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/9  

---

## Objective

Implement full end-to-end listing creation for verified sellers: contract-first schemas and state transition tables, dedicated PostgreSQL tables for listings, ordered photos, and moderation records, client-side WebP image pre-compression with Sharp EXIF-stripping and dual-variant generation via Cloudflare R2 storage, automated keyword-based content moderation with high-risk edit re-evaluation, and mobile-first listing management UI (`/sell`, `/sell/new`, `/sell/[id]/edit`) strictly complying with `DESIGN.md`.

---

## Scope

### In Scope
1. **Contract-First Types & Validation (`@downtown/types`, `@downtown/validation`, `@downtown/config`)**:
   - Fields: `title` (3-100), `description` (max 2000), `price` (integer in whole naira, min 1, exported constant `MAX_LISTING_PRICE_NAIRA = 50_000_000`), `isNegotiable`, `categoryId`, `condition`, `locationId`, `quantityAvailable` (1-999), `quantityReserved` (default 0), ordered photos (1-5, first = cover), `status`.
   - Complete Status enum: `draft | pending_moderation | published | reserved | sold | archived`.
   - Allowed Transition Table: enforce valid lifecycle transitions (`draft -> pending_moderation -> published` or stay `pending_moderation`, plus `published -> pending_moderation` on high-risk edits) with exhaustive unit tests.
   - Condition Enum & Configuration Map: `new | like_new | good | fair`. Unified config map defining category condition rules (`required`, `not_applicable`, `optional`).
   - Distinct `DraftListingSchema` (partial) and `SubmitListingSchema` (complete).
2. **Database Schema & Migrations (`apps/api/src/db/schema.ts`)**:
   - `listing` table with composite indexes on `(seller_id, status)` and `(status, created_at)`.
   - `listing_photo` table with positions and foreign key constraints.
   - `moderation_record` table recording scan findings, term flags, and review status.
3. **Authorization & IDOR Protection**:
   - Strict gate: active session, verified email, active account status, and `canSell(user)`.
   - Comprehensive IDOR immunity tests ensuring User B cannot read, mutate, or delete User A's listing or photo.
4. **Image Processing & Storage Pipeline (ADR 0007)**:
   - Client-side pre-compression: `createImageBitmap` (`imageOrientation: from-image`) -> Canvas -> WebP (max edge 1600px, target ~300 KB). Max 2 parallel uploads with retry.
   - Server-side validation: magic byte verification (JPEG, PNG, WebP), 4.5 MB body limit.
   - Sharp processing: metadata/EXIF GPS stripping, dual variants (400px thumb, 1200px display WebP).
   - `StorageService` interface with Cloudflare R2 adapter (`@aws-sdk/client-s3`) and in-memory fake for automated tests.
   - Plain `<img>` rendering with `loading="lazy" decoding="async"` (no `next/image` optimization).
5. **Content Moderation Engine (GOAL.md 9.1)**:
   - Prohibited terms dictionary (`docs/data/prohibited-terms.csv`) covering weapons, illicit substances, counterfeit goods, adult content, and academic dishonesty.
   - Normalization with diacritic stripping, leetspeak de-obfuscation, and word boundary matching.
   - Edit classification: low-risk edits stay live; high-risk edits re-trigger moderation. Bypass test asserting flagged edits drop from `published`.
6. **API Endpoints**:
   - `POST /api/listings` (create/save draft).
   - `PUT /api/listings/:id` (update listing/high-risk evaluation).
   - `POST /api/listings/:id/submit` (submit draft for publication).
   - `DELETE /api/listings/:id` (delete draft).
   - `GET /api/listings/mine` (list seller's own listings).
   - `GET /api/listings/:id` (owner-only read).
   - `POST /api/listings/photos` (upload image).
   - `DELETE /api/listings/photos/:id` (delete photo).
7. **Web UI**:
   - `/sell`: Seller dashboard with status badges (Draft, Under review, Live), soft-gate modal for guests, and "Become a seller" banner for non-sellers.
   - `/sell/new` & `/sell/[id]/edit`: `ListingForm`, `PhotoUploader`, `CategoryPills`, `LocationSelector`, Naira input.
   - Responsive verification at 375px and 1280px viewports with Network & CPU throttling checks.

### Out of Scope
- Public listing exploration and buyer search (reserved for Step 06).
- Order reservation and escrow settlement transitions (`reserved`, `sold`, reserved for Steps 07-08).
- Manual admin review UI (Step 09).
- Student ID upload and physical verification workflows (Step 10).

---

## Plan

1. **Architecture & Contracts**:
   - Author [ADR 0007: Listing Image Pipeline & Storage Topology](file:///docs/adr/0007-listing-image-pipeline.md).
   - Export listing types, status transitions, condition config, and Zod schemas from `packages/types` and `@downtown/validation`.
   - Write contract unit tests in `packages/validation`.
2. **Database Schema & Migrations**:
   - Define `listing`, `listingPhoto`, and `moderationRecord` tables in `apps/api/src/db/schema.ts`.
   - Generate Drizzle migration `0003_add_listing_tables.sql`.
   - Apply migration to development database.
3. **Storage & Image Service**:
   - Add `sharp` and `@aws-sdk/client-s3` dependencies to `apps/api`.
   - Implement `StorageService` interface, `InMemoryStorageService`, and `R2StorageService`.
   - Implement magic byte inspector and EXIF-stripping image processor.
4. **Keyword Moderation Service**:
   - Author `docs/data/prohibited-terms.csv`.
   - Implement text normalizer (diacritics, leetspeak, word boundary regex) and `ModerationService`.
   - Write moderation unit tests covering clean vs flagged cases and evasion attempts.
5. **Listing Service & API Handlers**:
   - Implement CRUD, status transitions, and IDOR validation in `listing.service.ts`.
   - Implement route handlers in `apps/api/src/app/api/listings/...`.
   - Write comprehensive integration test suite covering auth, canSell, IDOR, quotas, high-risk edit bypass, and photo uploads.
6. **Web Client UI Components**:
   - Build client-side image compressor in `apps/web/src/utils/image-compression.ts`.
   - Build `PhotoUploader` component with reorder, remove, cover badge, and progress.
   - Build `ListingForm` and `/sell`, `/sell/new`, `/sell/[id]/edit` pages.
7. **Verification & Quality Assurance**:
   - Run unit, contract, and integration test suites.
   - Browser verification at 375px and 1280px with slow network simulation.
   - Execute two-axis `code-review`.
   - Run `scripts/verify.ps1`.
8. **PR, Merge & Provenance**:
   - Open PR, land via `--no-ff`, record provenance commit, apply migrations to production.

---

## Implementation

### 1. Architectural Amendment: Cloudflare R2 Dropped, Vercel Blob Adopted
- **Reason for Rejection**: Cloudflare R2 requires payment cards on file, lacks budget/overage alerts, and automatically charges unexpected overages.
- **Vercel Blob Hobby Tier**: No credit card required; hard-capped at 1 GB storage and 10 GB monthly bandwidth.
- **Immutable Edge Caching**: Blobs uploaded with `cacheControlMaxAge: 31536000` so CDN edge hits do not count toward Blob data transfer quotas.
- **Storage Guard**: `STORAGE_SOFT_CAP_BYTES` (default 800 MB). Prior to accepting an upload, total stored bytes are calculated from `listing_photos`. Uploads exceeding the cap are refused with HTTP 503 and a friendly message. At 70% of the cap, a warning is logged.
- **Deletion Hygiene**: When drafts or individual photos are deleted, their display and thumbnail blobs are purged from object storage. `sweepOrphanPhotos()` purges unattached photos older than 24 hours.
- **Supabase Storage Fallback**: Recorded as primary migration target if Vercel Pro upgrade is uneconomical.

### 2. Database Schema & Migrations
- Added `listings`, `listing_photos`, and `moderation_records` tables with composite indexes (`apps/api/src/db/schema.ts`).
- Added `bytes` column to `listing_photos`.
- Applied migrations `0003_stormy_daimon_hellstrom.sql` and `0004_mushy_the_anarchist.sql` to dev database.

### 3. Contracts & Validation
- Added `MAX_LISTING_PRICE_NAIRA = 50_000_000`, condition rules per category, and lifecycle transitions.
- Exported `DraftListingSchema`, `SubmitListingSchema`, `UpdateListingSchema`, and `isHighRiskListingEdit`.
- 47 unit tests passing in `packages/validation`.

### 4. API Endpoints
- `POST /api/listings` (create draft)
- `GET /api/listings/mine` (list seller's own listings)
- `GET /api/listings/:id` (fetch own listing)
- `PUT /api/listings/:id` (update listing; re-evaluates high-risk edits and drops to `pending_moderation` if flagged)
- `DELETE /api/listings/:id` (delete draft and clean up attached photo blobs)
- `POST /api/listings/:id/submit` (submit draft for moderation and auto-publication)
- `POST /api/listings/photos` (upload image with magic bytes, quota, and storage guard checks)
- `DELETE /api/listings/photos/:id` (delete photo from storage and database)

### 5. Web UI
- Mobile-first seller dashboard at `/sell` with status pills and soft-gate modal for guests.
- Form at `/sell/new` and `/sell/[id]/edit` featuring `PhotoUploader` (max 5 photos, cover badge, progress, reorder), naira currency input, category condition requirements, and location autocomplete.

## Discoveries

- **Vercel Blob Hobby Tier**: Zero payment info needed; 1 GB hard limit is safe for MVP when guarded with `STORAGE_SOFT_CAP_BYTES` (800 MB) and deletion hygiene.
- **Immutable CDN Caching**: Setting `cacheControlMaxAge: 31536000` on public blobs ensures CDN edge hits do not count toward Blob data transfer fees.
- **Rate Limit Isolation in Tests**: In integration test suites running concurrently against Better Auth, distinct IP headers (`x-forwarded-for`) are required during test user registration/login to avoid tripping the default fallback IP (`127.0.0.1`) rate limit bucket.

## Verification

- Automated test suites:
  - `packages/validation`: 47 tests passed.
  - `apps/api`: `listing-integration.test.ts` (20 tests passed).
  - `apps/api`: `image-storage.test.ts` (12 tests passed, including token selection logic).
  - `apps/api`: `moderation.test.ts` (8 tests passed).
  - `apps/api`: `auth-integration.test.ts` (12 tests passed).
  - `apps/api`: `taxonomy-locations.test.ts` (12 tests passed).
  - `apps/api`: `rate-limit.test.ts` (6 tests passed).
  - `apps/api`: `trusted-origins.test.ts` (4 tests passed).
  - `apps/api`: `email-service.test.ts` (4 tests passed).

- **Real-Provider Smoke Test (Vercel Blob `downtown-listings-dev`)**:
  - Target preview deployment: `https://downtown-8xdf3vm9y-richmondsogo.vercel.app`
  - Registered verified seller with `.edu.ng` credentials.
  - Uploaded photo via `POST /api/listings/photos`.
  - Result:
    - Status: `PASS`
    - Host: `ify7na5r52nw5uuz.public.blob.vercel-storage.com`
    - Stored display bytes: `88`, fetched bytes from CDN: `44`
    - Public CDN returned HTTP 200 with proper `image/webp` payload.
  - Executed `DELETE /api/listings/photos/:id`. Verified `del()` deleted both display and thumbnail variants from Vercel Blob.
  - Dev store inspection via `vercel storage inspect downtown-listings-dev`:
    - `Store`: `downtown-listings-dev`
    - `ID`: `store_iFY7NA5r52NW5UuZ`
    - `Region`: `fra1`
    - `Size`: `0`
    - `Count`: `0`
    - Store is 100% empty and clean.

## Decisions

- **ADR 0007 (Amended)**: Vercel Blob Hobby tier adopted for listing images; Cloudflare R2 dropped due to billing and overage risks; Supabase Storage recorded as architectural fallback.
- **Fail-Closed Token Resolution**: `getBlobToken()` strictly enforces `BLOB_READ_WRITE_TOKEN` when `VERCEL_ENV === "production"`, failing closed with a clear error if unset. Under preview and development, it resolves `DEV_READ_WRITE_TOKEN`.
- **Environment Isolation via CLI**: All three `DEV_*` variables (`DEV_READ_WRITE_TOKEN`, `DEV_STORE_ID`, `DEV_WEBHOOK_PUBLIC_KEY`) were removed from the `production` environment via Vercel CLI, and the store connection was scoped strictly to `preview` (`vercel storage update downtown-listings-dev --environment preview --yes`).
- **Preview Deployment Smoke Test**: In accordance with user instruction, `DEV_READ_WRITE_TOKEN` remains marked sensitive with zero local disclosure. Real-provider smoke verification was performed directly against the Step 04 Preview deployment API, followed by verification that the store is completely empty (`Count: 0`).




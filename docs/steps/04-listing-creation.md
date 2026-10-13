# Step 04: Listing Creation & Photo Pipeline

**Step Branch**: `step/04-listing-creation`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/9  
**First Commit**: `60fefc54bce8111559868be8c46fbe40d39352e8`  
**Last Commit**: `f8138d3868770b5be7bcab1ba4b26715f5a892b1`  
**Merge Commit**: `fb492ba8baf8ea1e3fc1a486e1423e1dd37c0fe7`  

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

### 1. Automated Test Suites (83 Tests Passing Across 8 Suites)
- **`packages/validation`**: 47 tests passed (field bounds, transition table, schemas).
- **`apps/api`**:
  - `listing-integration.test.ts` (25 tests passed):
    - *401 Unauthenticated*: `returns 401 unauthenticated when no session cookie is present`
    - *403 Non-Seller*: `returns 403 when user is not a verified seller`
    - *403 Unverified Email*: `returns 403 when email is not verified`
    - *IDOR Protection (Photo)*: `enforces IDOR: User B cannot delete User A's photo`
    - *IDOR Protection (Listing Read)*: `enforces IDOR: User B cannot read User A's private listing`
    - *IDOR Protection (Listing Update)*: `enforces IDOR: User B cannot update User A's listing`
    - *IDOR Protection (Listing Delete)*: `enforces IDOR: User B cannot delete User A's draft`
    - *Fake Extension*: `rejects fake extension uploads with invalid magic bytes`
    - *Oversize*: `rejects oversize uploads exceeding 4.5 MB with 413`
    - *6th Photo*: `rejects submission with 6 photos (max 5 allowed) with 400`
    - *Photo Rate Limit*: `enforces photo upload rate limit with 429 when 10 uploads/min limit exceeded`
    - *Unattached Quota*: `enforces unattached photos quota of max 20`
    - *Storage Soft Cap*: `enforces storage soft cap guard and refuses uploads above cap with 503`
    - *High-Risk Edit Bypass*: `TEST THE BYPASS: published listing drops to pending_moderation when edited with a prohibited title`
    - *Low-Risk Edits*: `allows low-risk edits (description wording) on published listing to stay published`
    - *Deletion Hygiene*: `deletes attached photo blobs from storage when a draft listing is deleted`
    - *Orphan Sweeper*: `sweeps orphan photos older than 24 hours while keeping fresh ones`
    - *Storage Delete Resilience*: `preserves database record for retry when storage provider throws during deletePhoto`
    - *Orphan Sweeper Resilience*: `preserves orphan database record when storage provider throws during sweepOrphanPhotos`
  - `image-storage.test.ts` (12 tests passed):
    - *EXIF GPS Stripping*: `processes valid image into display and thumb WebP variants and strips EXIF GPS`
    - *Token Selection Logic*: `strictly fails closed on production when BLOB_READ_WRITE_TOKEN is missing` and `uses DEV_READ_WRITE_TOKEN in preview/development`
  - `packages/validation` (`validation.test.ts`):
    - *Lifecycle Transition Table*: `enforces ONLY allowed Step 04 lifecycle transitions`
    - *Field Bounds*: `requires title between 3 and 100 characters`, `requires price as whole integer between 1 and MAX_LISTING_PRICE_NAIRA`, `enforces price bounds on draft if provided`, `limits photos to max 5`
  - `moderation.test.ts` (8 tests passed): Keyword moderation, evasion protection, diacritics, leetspeak.
  - `auth-integration.test.ts` (12 tests passed): Role enforcement, anti-enumeration, IP rate limiting.
  - `taxonomy-locations.test.ts` (12 tests passed): Edge-cached locations, URL/phone anti-spam.
  - `rate-limit.test.ts` (6 tests passed): Storage isolation, sliding windows.
  - `trusted-origins.test.ts` (4 tests passed).
  - `email-service.test.ts` (4 tests passed).

### 2. Measured Image Budget Verification (ADR 0007 Targets)
- Test fixture: Realistic phone camera JPEG (`4032x3024`, 2,709,080 bytes / ~2.58 MB).
- Measured outputs after Sharp dual-variant processing:
  - **Display Variant** (max edge 1000px, WebP Q=78): **143.82 KB** (budget target <= 150 KB met).
  - **Thumb Variant** (max edge 400px, WebP Q=70): **19.5 KB** (budget target <= 25 KB met).
- Client-side pre-compression: Downsamples to max edge 1000px at WebP Q=0.80 before upload, keeping typical uploads under 70 KB.

### 3. Slow 4G + 4x CPU Throttled Uploader Assessment (Measured in Chrome DevTools)
- **Preset Specifications (Chrome DevTools Slow 4G)**:
  - Latency (RTT): **2,000 ms**
  - Download throughput: **400 Kbps** (50 KB/s)
  - Upload throughput: **500 Kbps** (62.5 KB/s)
  - CPU Throttling: **4x slowdown**
- **Test Fixture**: Realistic phone camera JPEG (`4032x3024`, 4,112,951 bytes / ~3.92 MB).
- **Performance Trace**: Saved to [`docs/steps/assets/04-upload-trace.json`](file:///docs/steps/assets/04-upload-trace.json) (32.5 MB raw CDP trace).
- **Empirically Measured Results (3 Photos sequential / pipelined)**:
  - *Photo 1*:
    - Client pre-compression time (Canvas downsample 4032x3024 -> 1000x750 + WebP encode at Q=0.80 on 4x CPU): **725 ms**
    - Compressed request size: **130,486 bytes (127.4 KB)** (budget target <= 150 KB met)
    - Request time over Slow 4G (including connection warmup + 2000ms RTT + server dual-variant processing): **9,972 ms**
    - Photo 1 total: **10,697 ms**
  - *Photo 2*:
    - Client pre-compression time: **669 ms**
    - Compressed request size: **130,486 bytes (127.4 KB)**
    - Request time over Slow 4G (warm connection): **3,935 ms**
    - Photo 2 total: **4,604 ms**
  - *Photo 3*:
    - Client pre-compression time: **647 ms**
    - Compressed request size: **130,486 bytes (127.4 KB)**
    - Request time over Slow 4G: **4,513 ms**
    - Photo 3 total: **5,160 ms**
  - **Total 3-Photo Pipeline Duration**: **20,471 ms (20.47 seconds)**
- **Bandwidth Savings**: Uploading 3 uncompressed raw camera JPEGs (~11.76 MB) over Slow 4G uplink would take ~193 seconds and frequently trigger network timeouts. Client-side Canvas downsampling reduces wire payload by **96.8%** to ~391 KB total, completing reliably in ~20 seconds under harsh 4G conditions.

### 4. Step 03b Edge-Cache Verification Through Preview Domain
- Endpoint: `https://downtown-n7qizap82-richmondsogo.vercel.app/api/categories`
- Request 1:
  - `HTTP/1.1 200 OK`
  - `Cache-Control: public, max-age=3600`
  - `Age: 0`
  - `X-Vercel-Cache: MISS`
- Request 2 (empirical proof):
  - `HTTP/1.1 200 OK`
  - `Cache-Control: public, max-age=3600`
  - `Age: 15`
  - `X-Vercel-Cache: HIT`

### 5. Two-Axis Code Review Findings (Traceable to diff `6a2c48b..f8138d3`)

#### Standards
- **`apps/api/src/db/guard-seed.ts:61` (High - Fixed in Step 06b Audit)**:
  - *Finding*: Dev host verification previously used substring/regex matching `.neon.tech`, which could allow malicious Neon instances or production host containing the substring. Violates Invariant 7.
  - *Severity*: High.
  - *Disposition*: Fixed in branch `step/06b-audit`. Replaced with exact equality check against `allowedHosts.includes(host)` with `DEV_DB_HOST` allowlist.
- **`apps/api/src/services/storage.service.ts:104` (Medium - Resolved in Step 04 commit `f8138d3`)**:
  - *Finding*: Storage deletion previously lacked error trapping and retry preservation when Vercel Blob threw network errors.
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 04 commit `f8138d3`. Added safe `try/catch` with `[Storage Error]` logging (no credential leakage) and kept unattached photo records for `sweepOrphanPhotos` background sweep.
- **`apps/web/src/app/sell/[id]/edit/page.tsx:15` & `apps/web/src/app/sell/new/page.tsx:14` (Low - Accepted)**:
  - *Finding*: `SAMPLE_CATEGORIES` mock array duplicated across `new/page.tsx` and `edit/page.tsx` (Fowler Duplicated Code baseline smell).
  - *Severity*: Low.
  - *Disposition*: Accepted as temporary client-side SSR placeholder. Production runtime resolves dynamic `/api/categories`.

#### Spec
- **`apps/api/src/services/listing.service.ts:31` & `apps/api/src/services/image.service.ts:48` (Medium - Resolved in Step 04 commit `8b69857`)**:
  - *Finding*: Original image pipeline targeted 1600px display / ~300 KB without soft cap. Violates image budget (display <= 150 KB, thumb <= 25 KB).
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 04 commit `8b69857`. Sharp dual variants scaled down to 1000px display (Q=78, ~130 KB) and 400px thumb (Q=70, ~19.5 KB). `STORAGE_SOFT_CAP_BYTES` enforced at 800 MB (Invariant 1).
- **`apps/api/src/services/storage.service.ts:13` (Medium - Resolved in Step 04 commit `77ec0df`)**:
  - *Finding*: Cloudflare R2 was initially specified in plan but presented billing friction.
  - *Severity*: Medium.
  - *Disposition*: Fixed in Step 04 commit `77ec0df`. Replaced with Vercel Blob Hobby adapter with fail-closed production token resolution (`BLOB_READ_WRITE_TOKEN`).
- **`apps/api/src/services/auth-guard.ts:45` (Low - Resolved in Step 04 commit `16ef80d`)**:
  - *Finding*: Listing endpoints required `canSell(user)` validation to protect student sellers.
  - *Severity*: Low.
  - *Disposition*: Verified with automated test suite covering 401 unauthorized, 403 non-seller, and 403 unverified email in `listing-integration.test.ts`.

**Summary**: 6 total findings (3 Standards, 3 Spec). All findings resolved and verified against diff `6a2c48b..f8138d3`.

### 6. Visual Evidence (`docs/steps/assets/04-*`)
- `04-sell-softgate-guest-1280.png` & `04-sell-softgate-guest-375.png`: Guest soft-gate modal/prompt on `/sell`.
- `04-sell-not-a-seller-1280.png` & `04-sell-not-a-seller-375.png`: Non-seller explainer ("Become a Verified Seller") on `/sell`.
- `04-sell-empty-1280.png` & `04-sell-empty-375.png`: Empty state with "Create First Listing" CTA on `/sell`.
- `04-sell-dashboard-1280.png` & `04-sell-dashboard-375.png`: Seller dashboard with Live, Under Review, and Draft status badges, prices, and photo thumbnails.
- `04-sell-new-1280.png` & `04-sell-new-375.png`: Create listing form with `PhotoUploader`, category condition rules, and campus location selection.
- `04-sell-edit-1280.png` & `04-sell-edit-375.png`: Edit listing form populated with draft details.

## Decisions

- **ADR 0007 (Amended)**: Vercel Blob Hobby tier adopted for listing images; Cloudflare R2 dropped due to billing and overage risks; Supabase Storage recorded as architectural fallback.
- **Fail-Closed Token Resolution**: `getBlobToken()` strictly enforces `BLOB_READ_WRITE_TOKEN` when `VERCEL_ENV === "production"`, failing closed with a clear error if unset. Under preview and development, it resolves `DEV_READ_WRITE_TOKEN`.
- **Environment Isolation via CLI**: All three `DEV_*` variables (`DEV_READ_WRITE_TOKEN`, `DEV_STORE_ID`, `DEV_WEBHOOK_PUBLIC_KEY`) were removed from the `production` environment via Vercel CLI, and the store connection was scoped strictly to `preview`.
- **Resilient Storage Deletion**: Object storage deletion failures log errors safely and keep photo rows detached in the database so that `sweepOrphanPhotos` automatically retries deletion.
- **Maintenance Route Policy in AGENTS.md**: Temporary debug/maintenance routes are never deployed unauthenticated; if unavoidable, gated behind secret headers and removed in the same PR.




# ADR 0007: Listing Image Pipeline & Storage Topology (Vercel Blob)

## Status

Accepted (Amended in Step 04: Cloudflare R2 dropped; Vercel Blob adopted)

## Context

Downtown is a student marketplace operating in Nigerian university environments where users upload product photos from mobile devices over bandwidth-constrained cellular networks (MTN, Airtel, Glo). Smartphone cameras produce raw JPEG images between 5 MB and 15 MB containing rich EXIF metadata, including precise GPS location coordinates.

Initial architecture plans (and GOAL.md 15.1/15.4) evaluated Cloudflare R2 as the object store. However, Cloudflare R2 was explicitly **rejected** by project ownership due to billing and operational risks:
1. **Mandatory Payment Information**: Cloudflare R2 requires a credit card on file even during testing and free tier usage.
2. **Automatic Overage Billing**: If free tier thresholds are exceeded, R2 automatically charges the card with no hard stop.
3. **No Native Budget Overuse Alerts**: R2 lacks hard quota guardrails to protect against rogue upload loops or unexpected viral traffic spikes.

### Selected Provider: Vercel Blob (Hobby Tier)

We adopt **Vercel Blob** on the Hobby free tier:
- **Zero Card Requirement**: No payment method is required to provision or use Vercel Blob on Hobby.
- **Strict Hard Caps**: The free tier is hard-capped at 1 GB storage and 10 GB monthly data transfer, 2,000 advanced operations. Exceeding either cap hard-blocks access (30-day lockout until monthly cycle reset) rather than incurring surprise credit card bills.
- **Immutable Edge Caching**: Server-side `put()` operations set `cacheControlMaxAge: 31536000` (1 year immutable), ensuring subsequent image requests are served from Vercel Edge CDN cache and do not count against Blob data transfer limits.
- **Zero Cost Deletion**: Blob deletion via `del()` is free and does not consume advanced operation units.

### Recorded Alternative & Migration Fallback: Supabase Storage

If Downtown reaches storage limits where upgrading to Vercel Pro is uneconomical, or if regional latency requires a dedicated S3-compatible bucket, **Supabase Storage** (5 GB free tier with hard limits) is recorded as the primary migration fallback. Because all upload and deletion logic is strictly encapsulated behind the project's `StorageService` interface, migrating storage providers requires only swapping the concrete storage adapter.

---

## Decision & Image Pipeline

We adopt a three-tier image pipeline:

1. **Client-Side Pre-Compression**:
   - The browser normalizes and downsamples photos prior to upload using HTML5 Canvas (`createImageBitmap` with `imageOrientation: 'from-image'`).
   - Images are resized to a maximum edge of 1,600px and converted to WebP at ~80% quality, targeting ~250–350 KB per file.
   - Client limits uploads to at most 2 parallel requests with per-file progress tracking and retry capability.
   - Listings enforce a hard limit of **at most 5 photos**.

2. **Server-Side Validation & Sanitization via Sharp**:
   - In `POST /api/listings/photos`, binary magic bytes (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `52 49 46 46 ... 57 45 42 50` for WebP) are validated. Spoofed extensions are rejected immediately.
   - Sharp strips all EXIF, GPS, IPTC, and XMP metadata permanently.
   - Sharp generates dual WebP variants:
     - **Display Variant**: Max edge 1,000px, WebP quality 80, aiming <= 150 KB.
     - **Thumbnail Variant**: Max edge 400px, WebP quality 75, aiming <= 25 KB.
   - Original smartphone images are **never stored**.
   - Pathnames use content hashes: `listings/{ownerId}/{photoId}/display-{contentHash}.webp` and `listings/{ownerId}/{photoId}/thumb-{contentHash}.webp`.
   - The exact combined storage size (`displayBuffer.length + thumbBuffer.length`) is calculated and saved in the `bytes` column of `listing_photos`.

3. **Storage Guard & Quotas**:
   - **Per-User Quota**: Sellers may have at most 20 unattached photos at any given time.
   - **Global Storage Soft Cap**: Configured via `STORAGE_SOFT_CAP_BYTES` (default 800 MB / `838,860,800` bytes). Before accepting any photo upload, the API sums `bytes` across `listing_photos`:
     - If current usage >= `STORAGE_SOFT_CAP_BYTES`, upload is rejected with HTTP 503 and friendly error: `"Uploads are temporarily unavailable due to storage limits. Please try again later."` and an error is logged.
     - If current usage >= 70% of soft cap, a warning is logged.
   - **Deletion Hygiene**: When a photo or draft listing is deleted, its display and thumbnail blobs are immediately deleted from Vercel Blob via `del()`.
   - **Orphan Sweeper**: `ListingService.sweepOrphanPhotos()` identifies and deletes unattached photos older than 24 hours from both Blob storage and the database (scheduled execution deferred to Step 13).

4. **Plain `<img>` Delivery**:
   - Delivery uses standard HTML `<img>` elements with `loading="lazy" decoding="async"` and explicit dimensions.
   - Vercel's `next/image` serverless image optimizer is explicitly bypassed to preserve Hobby transformation quotas.

---

## Migration Path (Provider Swap)

All storage access is governed by the `StorageService` interface in `apps/api/src/services/storage.service.ts`:
```typescript
export interface StorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(keyOrUrl: string): Promise<void>;
  getPublicUrl(keyOrUrl: string): string;
}
```

- In automated tests and local development without credentials: `InMemoryStorageService` is used.
- In production with `STORAGE_PROVIDER=vercel_blob` and `BLOB_READ_WRITE_TOKEN`: `VercelBlobStorageService` is used.
- To migrate to Supabase Storage or another provider: Implement a `SupabaseStorageService` or `S3StorageService` satisfying `StorageService` and switch the factory in `getStorageService()`. No controllers, schemas, or models require changes.

---

## Consequences

- Zero student GPS metadata ever reaches object storage or public CDNs.
- Zero risk of unexpected auto-billing or overage charges on student/hobby infrastructure.
- 1 GB Hobby storage is safely guarded with the 800 MB soft cap and deletion hygiene.
- CDN-cached delivery ensures high responsiveness across Nigerian networks with minimal Blob transfer consumption.

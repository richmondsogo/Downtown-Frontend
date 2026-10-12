# System & Architectural Invariants

This document codifies the non-negotiable architectural, security, data integrity, and product rules of the Downtown marketplace. Every agent and engineer operating in this repository must maintain these invariants at all times.

---

## 1. Object Storage & Capacity
- **Provider**: Object storage is Vercel Blob exclusively.
- **Storage Soft Cap**: `STORAGE_SOFT_CAP_BYTES` defaults to **800 MB** (`800 * 1024 * 1024` = 838,860,800 bytes) against the 1 GB Vercel free tier limit.
- **Token Resolution**: In production (`NODE_ENV === "production"`), the storage client reads `BLOB_READ_WRITE_TOKEN` only and never falls back to `DEV_*` tokens.
- **Upload Endpoint**: Photos are uploaded through `/api/listings/photos` only. No legacy `/api/upload-photo` endpoint.

## 2. Client IP & Rate Limiting
- **Platform Header**: The client IP is derived strictly from the trusted platform header `x-vercel-forwarded-for` (established and verified in Step 02b).
- **Untrusted Headers**: `cf-connecting-ip`, client-supplied `x-forwarded-for`, and `x-real-ip` are forbidden for IP attribution.
- **Fail-Closed Guard**: When `x-vercel-forwarded-for` is absent or empty, IP resolves to the sentinel bucket `"no-trusted-ip"` where a shared fail-closed rate limit is enforced.

## 3. Matriculation Number Validation
- **Canonical Format**: `^\d{4}\/\d{4,6}$` (e.g. `2024/55430` or `2024/5543`).
- **Prefix Rejection**: Any `"UNIOSUN/"` or similar institutional prefix is **strictly rejected** with an actionable validation error showing the valid example (`2024/55430`), never silently stripped.
- **Normalization**: Hyphens (e.g. `2024-55430`) and internal whitespace (` 2024 / 55430 `) are normalized to the canonical slash format `2024/55430`.

## 4. Public Authentication & Role Security
- **Allowed Public Roles**: `student | staff | vendor` only.
- **Database CHECK Constraint**: The database enforces `CHECK (role IN ('student', 'staff', 'vendor', 'admin'))`.
- **System-Controlled Fields**: `sellerStatus` and `accountStatus` are immutable on public endpoints (`input: false`).
- **Admin Isolation**: Admin accounts can never be registered or elevated through public signup or user endpoints.

## 5. Listing Lifecycle Statuses
- **Permitted Statuses**: Exactly six statuses:
  1. `draft`
  2. `pending_moderation`
  3. `published`
  4. `reserved`
  5. `sold`
  6. `archived`
- **Forbidden Statuses**: `"active"` is never a listing status. Any legacy reference must be eliminated.
- **Moderation Bypass**: Direct transitions from `draft` to `published` are rejected if flagged by automated moderation; only clean listings reach `published`.

## 6. Public Projection Privacy Boundaries
- **Strict Anonymity**: Public listing payloads, search feeds, and seller previews never include:
  - Email addresses
  - Phone numbers
  - Matriculation numbers
  - User IDs (internal database IDs)
  - Raw personal names (only formatted display names such as "Richmond O.")

## 7. Database Seeding & Production Guard
- **Seed Requirements**: Running seeds requires both:
  1. `ALLOW_SEED=1` environment variable.
  2. Exact hostname match against `DEV_DB_HOST` (e.g. `ep-shiny-credit-baedn5p1-pooler.c-8.eu-central-1.aws.neon.tech`). No substring or wildcard pattern matching (e.g. `.neon.tech`).
- **Production Refusal**: Production database host (`ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech`) strictly aborts with an error if seeding is attempted.

## 8. Student Email Policy
- **Personal Emails Permitted**: Student and seller accounts use personal email addresses (`gmail.com`, `yahoo.com`, etc.).
- **No Institutional Domain Requirement**: UNIOSUN students are not issued institutional email accounts; verification is anchored on matric number and ID inspection, not email domain.

## 9. Brand & Verification Copy (Anti-Misrepresentation)
- **Honest Seller Badging**: UI copy must use **"Verified student seller"**, never "UNIOSUN student" or "University-verified".
- **Attribution Tooltip**: Must explicitly clarify: *"Verification is performed by Downtown through student ID inspection, not by the university."*
- **Safety Copy**: Campus safety notice uses the verbatim SRS sentence:
  > *"Meet in a public, familiar location and avoid sending money before you've verified the item and seller."*
  Zero invented campus locations or landmarks.
- **Fallback Copy**: When a campus has no sub-areas listed, use neutral copy: *"No sub-areas listed for this campus yet"*.

## 10. Cache Headers & Public Edge Caching
- **Public Projections**: Listing detail, search feeds, and category listings served to unauthenticated users must return:
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`
  (or `s-maxage <= 60` with `stale-while-revalidate <= 120`).
- **Authenticated / Sensitive Responses**: Return `private, no-cache, no-store, must-revalidate`.

## 11. Secret Protection
- **No Credential Exposure**: Passwords, API tokens, session secrets, and database connection strings are never printed to logs, console output, or typed into CLI commands.

## 12. Client-Side Image Budget & Pipeline
- **Display Image Budget**: `<= 150 KB` at `1000px` max dimension (WebP/JPEG).
- **Thumbnail Image Budget**: `<= 25 KB` at `400px` max dimension.
- **Client Compressor**: Custom canvas/`createImageBitmap` engine (`apps/web/src/utils/image-compression.ts`). Third-party bloat like `browser-image-compression` is excluded.

## 13. Production Launch Guards
- **Feature Flags**: `ENABLE_SIGNUP` guard and `ProductionEmailService` remain active in production until explicit sign-off in `docs/launch-checklist.md`.

## 14. View Tracking & Save Idempotency
- **Fire-and-Forget Analytics**: View counter increment is fire-and-forget via `navigator.sendBeacon` or `fetch(url, { method: "POST", keepalive: true })`. It must never block page rendering.
- **Save Idempotency**: Save and unsave operations must be idempotent, supporting explicit `{ saved: boolean }` state, `PUT` (save), and `DELETE` (unsave) to prevent desynchronization on rapid taps.

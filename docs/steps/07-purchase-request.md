# Step 07: Purchase Requests, Inventory Reservations & WhatsApp Handoff

**Step Branch**: `step/07-purchase-request`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/14  
**First Commit**: `cacaa4c`  
**Last Commit**: `9b9e209`  

---

## Objective

Implement the transaction-backed purchase request system connecting prospective buyers with verified sellers. This covers inventory reservation concurrency via `SELECT ... FOR UPDATE`, live reservation recomputation, dual-timestamp lifecycles (`reservation_expires_at = 24h` stock hold vs `resolution_deadline = 7d`), idempotent contact links, abuse caps, Nigerian phone normalization, and direct WhatsApp handoff with full privacy protection.

---

## Scope & Specifications

### 1. Statuses & State Machine
- **Statuses**: `pending | completed | disputed | expired | cancelled` + `cancelled_by` (`buyer | seller | system`).
- **Forbidden Statuses**: `accepted` and `rejected` do NOT exist.
- **Step 07 Implementation Scope**: `pending` (creation), `cancelled`, and `expired`.
- `completed` and `disputed` exist in the database enum and transition table but are unreachable until Step 08.
- **Transition Table**:

| Current Status | Target Status | Trigger | Actor | Inventory Hold Impact |
|---|---|---|---|---|
| None | `pending` | Buyer creates request | Buyer | Held if `reservation_expires_at > now()` |
| `pending` | `cancelled` | Buyer cancels active request | Buyer | Hold immediately released |
| `pending` | `cancelled` | Seller cancels/releases request | Seller | Hold immediately released |
| `pending` | `cancelled` | Listing archived/deleted | System (`cancelled_by=system`) | Hold immediately released, buyer notified |
| `pending` | `expired` | `resolution_deadline <= now()` with no outcome | System / Daily Sweep | Hold was already lapsed; status finalized |
| `pending` | `completed` | Transaction confirmed | Buyer/Seller | Reachable in Step 08 only |
| `pending` | `disputed` | Transaction dispute raised | Buyer/Seller | Reachable in Step 08 only |

### 2. Timestamps & Expiration Architecture
- `reservation_expires_at = created_at + interval '24 hours'` (controls inventory hold).
- `resolution_deadline = created_at + interval '7 days'` (controls negotiation/reconciliation window).
- Status `expired` is applied strictly when `resolution_deadline` lapses with no outcome.
- When `reservation_expires_at` lapses, the inventory hold is released immediately, but the request remains in `pending` status so buyer and seller can continue to negotiate or reconcile.
- All timestamp evaluations use database time (`now()`), never application process clocks.

### 3. One Live Pending Request per (Buyer, Listing) & Idempotency
- Enforced via partial unique index:
  ```sql
  CREATE UNIQUE INDEX purchase_request_buyer_listing_live_idx 
  ON purchase_requests (buyer_id, listing_id) 
  WHERE status = 'pending' AND reservation_expires_at > now();
  ```
- If a buyer submits a request again for a listing where they already have a live pending request, the endpoint returns the EXISTING request and its `wa.me` link with **HTTP 200 OK (idempotent)**, not a 409 error.

### 4. Reservation Accounting & Single Effective Availability Definition
- **Source of Truth**: Live pending requests (`status = 'pending' AND reservation_expires_at > now()`).
- **Interactive Transaction**:
  1. `SELECT ... FOR UPDATE` on the target listing row.
  2. Recompute `reserved = SUM(requested_quantity)` across all live pending requests.
  3. Write `quantity_reserved` and listing status (`published <-> reserved`) atomically in the transaction.
  4. Do NOT use increment/decrement operators.
- **Effective Availability Expression**: Defined ONCE as a shared SQL expression and helper function:
  ```sql
  GREATEST(0, listing.quantity_available - COALESCE((
    SELECT SUM(pr.requested_quantity)
    FROM purchase_requests pr
    WHERE pr.listing_id = listing.id
      AND pr.status = 'pending'
      AND pr.reservation_expires_at > now()
  ), 0))
  ```
  Used identically in request creation, feed, search, listing detail, and ranking. Listings with lapsed reservations become available immediately without requiring a cron sweep.
- **Spec Amendment**: When unreserved inventory reaches 0, the listing status is `reserved`, and new requests/offers are strictly blocked.

### 5. Listing Interactions
- `quantity_available` cannot be edited below currently held `reserved` stock.
- Price edits to a listing never mutate existing request snapshots (`unit_price`, `title`, seller first name are snapshotted on the request).
- Archiving or deleting a listing with live requests cancels them (`status = 'cancelled'`, `cancelled_by = 'system'`) and sends in-app notifications to buyers.
- `published <-> reserved` transitions happen only via reservation logic.

### 6. Abuse Prevention & Limits
- Max **5 live pending requests** per buyer across the platform.
- Max **15 new requests** per buyer per 24 hours.
- Per-IP rate limits enforced via `x-vercel-forwarded-for`.
- Buyer must be active (`account_status = 'active'`) and email-verified (`email_verified = true`).
- Seller can cancel (release) any pending request on their listing; buyer can cancel their own.

### 7. Offers
- Allowed only when `listing.is_negotiable = true`.
- Must be an integer Naira amount between **10% and 100%** of the listing price (UI displays a warning below 50%).
- Non-negotiable listings reject offers.
- Requested quantity must be between 1 and currently unreserved quantity.

### 8. Phone Number Normalization & Privacy
- Accepts: `0803...`, `803...`, `+234803...`, `234803...`.
- Normalizes to canonical E.164 `+234XXXXXXXXXX` (where first digit after 234 is 7, 8, or 9).
- Phone is self-declared and unverified; explicit disclaimer displayed in UX copy.
- Inline collection: prompt only when needed (sellers before listing, buyers before first contact).
- Privacy: Phone numbers are never returned in public payloads, search, or notifications. Seller phone appears only inside the `wa.me` link returned to the authenticated buyer with a live request. Buyer phone is NEVER exposed to the seller by the API.

### 9. WhatsApp Handoff (`wa.me`)
- URL Format: `https://wa.me/<digits_no_plus>?text=<encodeURIComponent(msg)>`.
- Verbatim SRS templates:
  - Standard: `Hello {seller_first_name}, I saw your listing for "{listing_title}" on Downtown ({listing_url}). Is it still available?`
  - Offer: `Hello {seller_first_name}, I saw your listing for "{listing_title}" on Downtown ({listing_url}). Would you accept ₦{offer_price} for it?`
  - Quantity amendment: If `quantity > 1`, append `" I need N."`.
- Truncated seller first name only, sanitized control characters, comma-formatted Naira, 300 character cap.
- Direct user gesture flow with tappable "Open WhatsApp" fallback button to prevent popup blocker suppression.

### 10. In-App Notifications
- Minimal `notification` table (`id`, `user_id`, `type`, `payload`, `read_at`, `created_at`).
- Payloads contain only IDs and display strings.
- Endpoints: `GET /api/notifications` (with unread count) and `PATCH /api/notifications/:id/read`.

### 11. Maintenance Cron
- Single daily sweep route `/api/cron/expire-requests` protected by `CRON_SECRET` (`Authorization: Bearer <token>`).
- Idempotently marks requests where `resolution_deadline <= now()` as `expired`.

### 12. UI Implementation
- Design tokens exclusively from `DESIGN.md`.
- Listing detail CTA: "Contact Seller" replaces disabled CTA.
- Request modal flow: Soft gate -> prompt phone if missing -> select quantity / offer -> verbatim SRS safety sentence -> create -> Open WhatsApp.
- Active request display on listing detail and `/requests`.
- Seller dashboard incoming requests with unread notification badge.
- Seams provided for Step 08 reconciliation.

---

## Verification & Test Proofs

- **Unit & Integration Test Suite**: `apps/api/src/__tests__/purchase-request.test.ts` (13 tests passing)
  - Race concurrency: exactly one of concurrent transactions gets 201, other gets 409 when 1 unit remains.
  - Idempotent repeated contact: returns HTTP 200 with existing request and wa.me link.
  - Lapsed hold non-blocking: reservation expired past 24h frees stock immediately without requiring sweep.
  - Abuse quotas: max 5 active requests per buyer and 15 per 24 hours enforced with HTTP 429.
  - IDOR and phone privacy: buyer phone never exposed to seller; seller phone only inside authenticated wa.me link.
  - Offer bounds: only allowed on negotiable listings, between 10% and 100% of listing price.
  - Archiving: cancels live requests with `cancelled_by = 'system'` and notifies buyers.
  - Cron security: rejects unauthorized requests with HTTP 401 without valid Bearer CRON_SECRET.
- **Repository-Wide Checks**:
  - `pnpm check-types`: 0 errors across all 6 workspaces.
  - `pnpm test`: 15 test suites, 154 tests passing.
  - `scripts/verify.ps1`: 12/12 checks passed (Typecheck OK, Tests OK, Build OK, Secrets OK).

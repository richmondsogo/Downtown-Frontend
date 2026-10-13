# ADR 0009: Purchase Request Concurrency, Stock Hold Expiry, and Effective Availability

## Status

Accepted (Supercedes Initial Draft per Step 07 Amendments)

---

## Context

Step 07 introduces purchase requests and direct buyer-to-seller WhatsApp handoffs on Downtown. Peer-to-peer campus commerce requires rigorous guarantees around inventory reservation, buyer/seller privacy, abuse prevention, and out-of-stock management:

1. **Inventory Reservation & Concurrency**:
   Listings have finite inventory (`quantity_available >= 1`). If multiple buyers submit requests simultaneously for the last remaining unit, the system must guarantee that exactly one buyer secures the reservation without overselling.
2. **Reservation vs. Resolution Lifecycles**:
   Inventory hold duration is 24 hours (`reservation_expires_at = created_at + interval '24 hours'`), but the transaction deal negotiation window lasts up to 7 days (`resolution_deadline = created_at + interval '7 days'`). After 24 hours, held stock releases back to inventory so the listing remains discoverable, but the request itself remains `pending` so the parties can still communicate and reconcile. Status becomes `expired` strictly when `resolution_deadline` lapses with no outcome.
3. **Lazy Accounting & Single Effective Availability Definition**:
   Vercel Hobby strictly limits cron schedules to once per day (`0 0 * * *`). The marketplace cannot depend on high-frequency cron workers to release reservations. Availability must evaluate lazily and identically across all queries.
4. **Idempotent Contact**:
   If a buyer clicks "Contact Seller" again while having an active pending request on that listing, creating again must return the EXISTING request and its `wa.me` link (HTTP 200, idempotent), rather than throwing an error or creating a duplicate hold.
5. **Phone Privacy & Anti-Harassment (SRS 4.1)**:
   Nigerian phone numbers are sensitive student personal data. Sellers and buyers must have self-declared Nigerian mobile numbers, but numbers must never be exposed in public listing payloads, search feeds, or notifications. Seller phone is projected strictly inside the `wa.me` handoff URL delivered to the authenticated buyer who holds an active request. Buyer phone is never exposed to the seller by the API.

---

## Decisions

### 1. State Machine & Status Lifecycle
- **Status Enum**: `pending | completed | disputed | expired | cancelled`
- **Cancellation Actor**: `cancelled_by` enum (`buyer | seller | system`)
- **Step 07 Scope**: Only `pending`, `cancelled`, and `expired` are implemented and reachable. `completed` and `disputed` are defined in the schema and transition table but reserved for Step 08 reconciliation. `accepted` and `rejected` statuses are explicitly excluded.
- **Clock**: All timestamp evaluations use database time (`now()`), never application process clocks.

### 2. Pessimistic Concurrency via `SELECT ... FOR UPDATE` & Absolute Recomputation
- Every purchase request creation executes within a database transaction:
  ```sql
  SELECT id, quantity_available, quantity_reserved, status, price, title, user_id
  FROM listing WHERE id = $1 FOR UPDATE;
  ```
- Inside the transaction, the engine computes:
  ```sql
  SELECT COALESCE(SUM(requested_quantity), 0) AS live_reserved
  FROM purchase_requests
  WHERE listing_id = $1
    AND status = 'pending'
    AND reservation_expires_at > now();
  ```
- The transaction writes `quantity_reserved = live_reserved` and updates listing status (`published <-> reserved`) atomically.
- **Never increment/decrement**: Stored `quantity_reserved` is always the direct sum of active holds.

### 3. Single Shared "Effective Availability" Expression
- Defined once in SQL and service layer:
  ```sql
  GREATEST(0, listing.quantity_available - COALESCE((
    SELECT SUM(pr.requested_quantity)
    FROM purchase_requests pr
    WHERE pr.listing_id = listing.id
      AND pr.status = 'pending'
      AND pr.reservation_expires_at > now()
  ), 0))
  ```
- This expression is reused identically across request creation, feed projection, search filtering, listing detail, and ranking. Listings with expired reservations become available immediately with zero cron sweep lag.

### 4. Idempotency & Partial Unique Index
- Enforce at most one live pending request per `(buyer_id, listing_id)`:
  ```sql
  CREATE UNIQUE INDEX purchase_request_buyer_listing_live_idx
  ON purchase_requests (buyer_id, listing_id)
  WHERE status = 'pending' AND reservation_expires_at > now();
  ```
- When a buyer re-submits for a listing where they already have a live pending request, the endpoint returns the existing request with its `wa.me` link (HTTP 200 OK).

### 5. Listing Mutation Invariants
- **Quantity Guard**: A seller cannot edit `quantity_available` below the currently held `live_reserved`.
- **Immutable Snapshots**: Price edits to a listing never mutate existing request snapshots (`unit_price`, `title`, seller first name).
- **Archive / Delete Cascade**: Archiving or deleting a listing with live requests cancels all associated requests (`status = 'cancelled'`, `cancelled_by = 'system'`) and dispatches in-app notifications to affected buyers.
- **Out-of-Stock Blocking**: When unreserved inventory reaches 0, the listing status is `reserved`, and new requests/offers are blocked.

### 6. Abuse Prevention & Caps
- Maximum 5 live pending requests per buyer across the platform.
- Maximum 15 new requests created per buyer in any rolling 24-hour period.
- Per-IP rate limits enforced via trusted platform headers.
- Buyer must have an active account with verified email.
- Seller can cancel (release) any pending request on their listing; buyer can cancel their own.

### 7. Offer & WhatsApp Handoff Rules
- **Offers**: Allowed only when `listing.is_negotiable = true`. Must be an integer Naira amount between 10% and 100% of listing price (UI warning displayed below 50%). Non-negotiable listings reject custom offers.
- **Phone Normalization**: Accepts `0803...`, `803...`, `+234803...`, `234803...` and normalizes to canonical E.164 `+234XXXXXXXXXX` (with 7, 8, or 9 as the first digit after 234). Self-declared and unverified.
- **WhatsApp Link**: Generated server-side using `https://wa.me/<digits>?text=<encodeURIComponent(msg)>`. Uses verbatim SRS templates. If `quantity > 1`, appends `" I need N."`. Truncated seller first name only, sanitized control characters, formatted Naira strings.

### 8. Maintenance Sweep Route
- `/api/cron/expire-requests` runs daily, protected by `Authorization: Bearer <CRON_SECRET>`. It idempotently marks requests whose `resolution_deadline <= now()` as `expired`.

---

## Consequences

- Completely eliminates race conditions and overselling without Redis or message queues.
- Adheres strictly to Vercel Hobby limitations through dual-timestamp lazy accounting.
- Guarantees student phone number privacy and prevents scrapers/harvesters.
- Eliminates phantom offers on out-of-stock items while preserving buyer communication.

# Step 07: Purchase Requests, Inventory Reservations & WhatsApp Handoff (Plan Only)

**Step Branch**: `step/07-purchase-request`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending approval]`  

---

## Objective

Design and implement the transaction-backed purchase request system connecting prospective buyers with verified sellers. This covers inventory reservation concurrency, lazy reservation expiry adhering to Vercel Hobby limits, secure WhatsApp link generation with strict phone privacy, Nigerian phone normalization, and the buyer/seller request management UI.

---

## Scope

### In Scope
- **Data Model**:
  - `purchase_requests` table with status state machine, quantity reservation, price snapshots, and 24-hour expiration.
  - Minimal `notifications` table for seller in-app event tracking.
  - Database check constraints (`quantity_reserved >= 0 AND quantity_reserved <= quantity_available`).
  - Partial unique index enforcing at most ONE active request per buyer per listing.
- **Reservation Concurrency**:
  - Pessimistic locking via `SELECT ... FOR UPDATE` inside PostgreSQL transactions.
  - Provable prevention of overselling ("two buyers, one unit left" race).
- **Lazy Expiry Architecture**:
  - Verification of Vercel Hobby cron limit (1 daily run).
  - On-access lazy expiration of reservations during reservation evaluation and availability queries.
  - Daily sweep cron (`/api/cron/expire-requests`).
- **Phone Number Normalization & Privacy (SRS 4.1)**:
  - Phone requirement on user profile before selling or buying.
  - E.164 normalization for Nigerian phone numbers (`+234...`).
  - Zero public projection of seller phone numbers.
  - Authenticated JIT generation of `wa.me` links with rate limiting.
- **Spec Amendment (SRS 5.2)**:
  - Strict blocking of purchase requests when unreserved quantity reaches 0.
- **WhatsApp Message Generation**:
  - Standard and negotiable offer templates using SRS verbatim formatting.
  - Control character sanitization, seller first-name only, Naira currency formatting, 300-char cap.
  - Mobile popup-blocker handling via explicit user gesture.
- **Safety Banner**:
  - Verbatim SRS campus safety notice in request modal.
- **UI States**:
  - "Contact Seller" modal with quantity/offer inputs.
  - Active request banner on listing page with expiration timer.
  - Buyer "/requests" list.
  - Seller dashboard incoming requests counter.
  - Seams for Step 08 transaction reconciliation.

### Out of Scope
- Step 08 transaction reconciliation (marking listing as sold, confirming cash payment, review prompts).
- External payment gateway integrations (Paystack/Flutterwave).
- In-app chat / WebSocket messaging (handoff is via WhatsApp exclusively).

---

## 1. Data Model & Migrations

### 1.1 `purchase_requests` Table
```sql
CREATE TABLE purchase_requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  requested_quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,          -- Snapshot of listing.price at request creation
  offer_price INTEGER,                  -- Nullable custom offer in Naira (if negotiable)
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,      -- DEFAULT NOW() + INTERVAL '24 hours'
  cancelled_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  CONSTRAINT purchase_request_status_check 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled', 'completed')),
  CONSTRAINT purchase_request_quantity_check 
    CHECK (requested_quantity >= 1),
  CONSTRAINT purchase_request_offer_check 
    CHECK (offer_price IS NULL OR offer_price >= 100)
);

-- Partial unique index: at most ONE active request per buyer per listing
CREATE UNIQUE INDEX purchase_request_buyer_listing_active_idx 
ON purchase_requests (buyer_id, listing_id) 
WHERE status IN ('pending', 'accepted');

-- Query indices
CREATE INDEX purchase_request_listing_status_idx ON purchase_requests (listing_id, status);
CREATE INDEX purchase_request_buyer_status_idx ON purchase_requests (buyer_id, status);
CREATE INDEX purchase_request_seller_status_idx ON purchase_requests (seller_id, status);
CREATE INDEX purchase_request_expires_at_idx ON purchase_requests (expires_at) WHERE status = 'pending';
```

### 1.2 Status Transition Table

| Current Status | Target Status | Trigger | Actor | Inventory Impact |
|---|---|---|---|---|
| `pending` | `accepted` | Seller accepts request | Seller | Reservation holds |
| `pending` | `rejected` | Seller declines request | Seller | `quantity_reserved -= requested_quantity` |
| `pending` | `cancelled` | Buyer cancels before expiry | Buyer | `quantity_reserved -= requested_quantity` |
| `pending` | `expired` | `NOW() > expires_at` (lazy or sweep) | System | `quantity_reserved -= requested_quantity` |
| `accepted` | `completed`| Step 08 transaction confirmed | Seller/Buyer | `quantity_reserved` converted to sold |
| `accepted` | `cancelled`| Mutual cancellation / abort | Seller/Buyer | `quantity_reserved -= requested_quantity` |

### 1.3 `notifications` Table
```sql
CREATE TABLE notification (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_user_unread_idx ON notification (user_id, read_at) WHERE read_at IS NULL;
```

### 1.4 CHECK Constraints on `listing` Table
Update `apps/api/src/db/schema.ts` listing table:
```sql
ALTER TABLE listing 
  ADD CONSTRAINT listing_quantity_bounds_check 
  CHECK (quantity_reserved >= 0 AND quantity_reserved <= quantity_available);
```

---

## 2. Reservation Concurrency & Race Condition Resolution

### 2.1 The "Two Buyers, One Unit Left" Race
- **Scenario**: Listing has `quantity_available = 1` and `quantity_reserved = 0`. Buyer A and Buyer B submit requests concurrently.
- **Pessimistic Locking Flow**:
  1. Transaction starts with `db.transaction(async (tx) => { ... })`.
  2. Transaction executes `SELECT * FROM listing WHERE id = $1 FOR UPDATE`.
  3. PostgreSQL grants the lock to Buyer A's transaction; Buyer B's transaction blocks at the database level.
  4. Buyer A's transaction executes lazy expiry on any expired reservations for this listing.
  5. It computes `available = listing.quantityAvailable - listing.quantityReserved`. Here `available = 1 - 0 = 1`.
  6. Because `available >= requestedQuantity (1)`, Buyer A's request succeeds:
     - `UPDATE listing SET quantity_reserved = quantity_reserved + 1 WHERE id = $1`
     - `INSERT INTO purchase_requests (...) VALUES (...)`
     - Commit transaction. Lock released.
  7. Buyer B's blocked transaction unblocks and reads the newly committed state: `quantityAvailable = 1, quantityReserved = 1`.
  8. Available is `1 - 1 = 0`.
  9. Transaction rolls back and returns HTTP 409 Conflict: `"Item is fully reserved by another buyer."`

### 2.2 Concurrency Automated Test
- Vitest concurrency test: executes 2 parallel requests with `Promise.all([createRequest(buyerA), createRequest(buyerB)])`.
- Asserts:
  - Exactly one request returns HTTP 201 with reservation details.
  - Exactly one request returns HTTP 409 Conflict.
  - Final database row for listing has `quantityReserved === 1`.
  - Database contains exactly 1 active `purchase_request` row.

---

## 3. Expiry Without Frequent Cron (Lazy Expiry Architecture)

### 3.1 Vercel Hobby Limitation Verification
- Documentation check: Vercel Hobby tier allows at most 1 cron invocation per day (`0 0 * * *`). Sub-daily cron execution (e.g. every 5 or 15 minutes) is restricted to paid Pro teams.
- **Architectural Principle**: The system must NOT rely on background crons for correctness.

### 3.2 Lazy Expiry Implementation
1. **Inside Reservation Transaction**:
   ```sql
   -- Release expired reservations for this listing before calculating availability
   WITH expired AS (
     UPDATE purchase_requests
     SET status = 'expired'
     WHERE listing_id = $1 
       AND status = 'pending' 
       AND expires_at < NOW()
     RETURNING requested_quantity
   )
   UPDATE listing
   SET quantity_reserved = GREATEST(0, quantity_reserved - COALESCE((SELECT SUM(requested_quantity) FROM expired), 0))
   WHERE id = $1;
   ```
2. **Public Availability Read Queries**:
   In `GET /api/listings/[id]` and search feed, active reservations where `expires_at < NOW()` are subtracted dynamically from computed reserved quantities.
3. **Daily Sweep Cron (`/api/cron/expire-requests`)**:
   Runs once daily at 02:00 UTC with bearer secret authentication (`CRON_SECRET`) to sweep untouched listings across the database.

---

## 4. Phone Numbers & Privacy Boundary (SRS 4.1)

### 4.1 Requirements & Gate
- **Seller Gate**: User cannot publish a listing without a valid Nigerian phone number on their profile (`phone IS NOT NULL`).
- **Buyer Gate**: User cannot submit a purchase request without a valid Nigerian phone number.

### 4.2 Nigerian E.164 Contract
- Format regex: `^\+234[789][01]\d{8}$`
- Supported prefixes: MTN, Airtel, Glo, 9mobile (`080`, `081`, `070`, `090`, `091`).
- Normalizer function in `@downtown/utils`:
  - Strips spaces, hyphens, brackets, country codes: `08031234567` -> `+2348031234567`.
  - Rejects foreign numbers or malformed lengths with clear error: *"Please enter a valid 11-digit Nigerian mobile number (e.g. 08012345678)"*.

### 4.3 Privacy Boundary & Tokenless Access
- Public listing endpoints never return the seller's phone number.
- When `POST /api/listings/[id]/requests` succeeds:
  - The API verifies buyer authentication and reservation success.
  - Generates the sanitized `wa.me` URL server-side.
  - Returns `{ requestId, status, expiresAt, whatsappUrl }` directly to the authenticated buyer.
  - Rate limited to 10 request submissions per hour per user.

---

## 5. Eligibility & Specification Amendment

### 5.1 Eligibility Matrix
- **Self-Request**: `buyer.id === listing.sellerId` -> 400 Bad Request.
- **Account Status**: `user.accountStatus === 'active'` and `user.emailVerified === true` required.
- **Listing Status**: Must be `published` or `reserved` (with available units). `draft`, `pending_moderation`, `sold`, `archived` -> 400/404.
- **Offer Validation**:
  - `offerPrice` only permitted if `listing.isNegotiable === true`.
  - Must be an integer Naira value.
  - Bounds: `offerPrice >= 0.5 * listing.price` and `offerPrice <= 2.0 * listing.price` (rejects unrealistic trolling).

### 5.2 Specification Amendment (SRS 5.2)
- **SRS 5.2 Original Copy**: *"Buyers can still make offers on reserved listings."*
- **Amended Rule**: When unreserved inventory reaches 0 (`quantityAvailable - quantityReserved <= 0`), the listing status displays **"Reserved"**, and further purchase requests or offers are **strictly blocked**.
- **Rationale**: Permitting new requests on an out-of-stock reserved item creates a confusing backlog, locks user hopes to unavailable items, and disrupts single-item student trades. If the reservation expires or is cancelled, the listing returns to "Published" and requests re-open.

---

## 6. WhatsApp Message Formatting & Mobile Browser Handling

### 6.1 SRS Verbatim Message Templates
1. **Standard Request Template**:
   > `Hello {seller_first_name}, I saw your listing for "{listing_title}" on Downtown ({listing_url}). Is it still available?`
2. **Offer Request Template**:
   > `Hello {seller_first_name}, I saw your listing for "{listing_title}" on Downtown ({listing_url}). Would you accept ₦{offer_price} for it?`

### 6.2 Sanitization Rules
- `{seller_first_name}`: Extracted from `user.name` (`name.split(' ')[0]`).
- `{listing_title}`: Truncated to 40 characters, newlines and tabs stripped.
- `{offer_price}`: Formatted with comma separators (e.g. `₦45,000`).
- Length cap: Total message body <= 300 characters.
- Encoded: `encodeURIComponent(message)`.

### 6.3 Mobile Popup-Blocker Defense
- In mobile Safari and Android Chrome, `window.open()` invoked after asynchronous `await fetch()` is blocked as an untrusted popup.
- **Solution**:
  1. Buyer clicks "Send Request & Contact".
  2. Dialog stays open, performs `POST /api/listings/[id]/requests`.
  3. Modal transitions to "Request Sent!" state with:
     - Verbatim Campus Safety Notice.
     - Direct `<a href={whatsappUrl} target="_blank" rel="noopener noreferrer">` styled as a primary "Open WhatsApp" button.
     - Clicking this link is a direct, synchronous user gesture that mobile browsers never block.

---

## 7. Campus Safety Reminder Copy

Verbatim SRS sentence rendered as a distinct alert box above the WhatsApp button:
> *"Meet in a public, familiar location and avoid sending money before you've verified the item and seller."*

---

## 8. UI States & User Experience

1. **Listing Detail CTA**:
   - Unauthenticated: "Sign in to Contact Seller" (triggers existing soft-gate modal).
   - Authenticated (no request): "Contact Seller" button opens request modal.
   - Authenticated (active request exists): "Request Active (Open WhatsApp)" button with 24-hour expiration countdown.
   - Fully reserved: "Item Reserved" disabled badge with explanatory note.
2. **Contact Seller Modal**:
   - Quantity selector (1 to unreserved quantity).
   - If negotiable: optional "Make an offer" input with instant validation against allowed bounds.
   - Required phone prompt if buyer profile lacks phone.
   - Safety banner.
3. **Buyer Requests Page (`/requests`)**:
   - Displays student's outgoing requests with status badges (`Pending`, `Accepted`, `Expired`, `Cancelled`).
   - Quick "Open WhatsApp" button and "Cancel Request" action.
4. **Seller In-App Notification Badge**:
   - Header bell icon reflects unread notifications from `notification` table.
   - Seller dashboard lists incoming requests with buyer display name, campus, and offer price.

---

## 9. Comprehensive Test Plan

1. **Race Concurrency Suite**:
   - Two concurrent buyers requesting the single available unit; assert exactly 1 succeeds (201) and 1 is rejected (409 Conflict).
2. **Partial Unique Index Suite**:
   - Buyer attempts second active request on same listing; assert database uniqueness constraint violation / 400 rejection.
3. **Lazy Expiry Suite**:
   - Insert request with `expires_at = NOW() - INTERVAL '1 minute'`. Next request to listing automatically cleans reservation and allows new purchase.
4. **Phone Privacy & IDOR Suite**:
   - Verify `GET /api/listings/[id]` contains no seller phone.
   - Verify Buyer B cannot view Buyer A's request (`GET /api/requests/[id]` returns 403/404).
   - Verify seller phone is only delivered to authenticated creator of active request.
5. **WhatsApp Template Snapshot Suite**:
   - Verify correct interpolation of first name, title sanitization, currency commas, and URL encoding.
6. **Offer Bounds Suite**:
   - Offer < 50% rejected (400); offer on non-negotiable item rejected (400); integer validation.
7. **Rate Limiting Suite**:
   - 11th request in 1 hour returns 429.

---

## 10. Open Questions for User Review

1. **Offer Bounds**: Does a minimum offer bound of 50% of the listing price align with your marketplace intent, or should we allow down to 25%?
2. **Buyer Cancellation**: Should buyers be permitted to cancel an active request within the 24-hour window, immediately releasing the reserved quantity for other buyers? (Recommended: Yes).
3. **Notification Channels**: For Step 07, notifications are purely in-app database records. Do you want an automated email dispatched to the seller when a new purchase request is submitted?

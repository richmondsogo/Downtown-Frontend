# Step 08: Transaction Reconciliation, Asymmetric Confirmations & Inventory Finalization

**Step Branch**: `step/08-reconciliation`  
**Primary Branch**: `master`  
**Pull Request**: `[Pending user review]`  

---

## Objective

Implement the post-contact transaction reconciliation lifecycle (SRS 7.2). Enables buyers and sellers to independently confirm, decline, or report outcomes for purchase requests, resolves asymmetric feedback into `completed`, `disputed`, or `cancelled` statuses, safely manages late confirmations against the 24-hour stock hold and 7-day deadline, auto-decrements inventory to mark listings `sold`, and creates review-eligibility records for Step 09.

---

## Scope

### In Scope
1. **Reconciliation State Machine & Matrix**: Implementation of SRS 7.2 response matrix handling `CONFIRMED`, `NOT_COMPLETED`, `NO_RESPONSE_YET`, and `DISPUTED`.
2. **Asymmetric Confirmation Service**: Schema, endpoints, and transactional resolution handling buyer and seller submissions independently.
3. **Dual-Timestamp Dynamics**: Late confirmations between 24h and 7d; stock availability checks before finalization.
4. **Inventory Finalization**: Atomic decrement of `quantity_available`; transition of listing to `sold` when stock reaches 0; cancellation of competing live requests (`cancelled_by = 'system'`).
5. **Dispute Handling Without Inventory Locking**: Ensuring `disputed` status releases reservations and holds 0 stock.
6. **Prompting System**: In-app notifications and prompt cards on `/requests` and listing detail.
7. **Review Eligibility Seam**: Writing `review_eligibility` rows upon successful `completed` transactions for Step 09.
8. **Automated Test Suite**: Unit and integration tests for all SRS 7.2 combinations, concurrent confirmations, late confirmation stock races, and quantity mismatches.

### Out of Scope (Explicitly Excluded)
- Step 09 ratings and review creation UI/API (only the eligibility seam is written).
- Admin dispute resolution and mediation back-office interface (moderation records and notifications are stored for future tooling).
- External email delivery (all notifications remain in-app).

---

## Technical Specifications

### 1. SRS 7.2 Reconciliation Matrix

| Buyer Input | Seller Input | Resolved Status | Listing Stock Action | Review Seam |
|---|---|---|---|---|
| `CONFIRMED` | `CONFIRMED` | `completed` | Decrement `quantity_available`; mark `sold` if 0 | Written for buyer |
| `CONFIRMED` | `NOT_COMPLETED` | `disputed` | Hold released (0 stock held) | Suspended |
| `NOT_COMPLETED` | `CONFIRMED` | `disputed` | Hold released (0 stock held) | Suspended |
| `NOT_COMPLETED` | `NOT_COMPLETED` | `cancelled` (`cancelled_by=mutual`) | Hold released; listing stays published | None |
| Any | `DISPUTED` / `DISPUTED` | `disputed` | Hold released (0 stock held) | Suspended |
| `NO_RESPONSE_YET` | Any (pending) | `pending` | Follow-up re-queued; deadline remains 7d | None |
| Any (pending) | `NO_RESPONSE_YET` | `pending` | Follow-up re-queued; deadline remains 7d | None |
| None by Day 7 | None by Day 7 | `expired` | Hold released; status finalized | None |

### 2. Prompting Timelines & Triggers

- **Scheduled Prompt**: Triggered at `created_at + 24 hours` (when `reservation_expires_at` lapses).
  - In-app notification delivered to buyer: *"Did you complete your purchase for {title}?"*
  - In-app notification delivered to seller: *"Did you sell {title} to {buyer_first_name}?"*
- **Early User Prompting**: If a user clicks "I've completed this purchase" on `/requests` before 24h, their response is recorded and a prompt notification is immediately sent to the counter-party.
- **"Didn't Respond / Still Negotiating"**: If a user selects `NO_RESPONSE_YET`, the request status remains `pending`, and a follow-up reminder notification is scheduled for 48 hours later (capped by `resolution_deadline`).

### 3. Quantity Discrepancy Escalation

- If both parties submit `CONFIRMED` but report divergent quantities (e.g., buyer claims 1 unit, seller claims 2 units):
  - Request automatically transitions to `disputed`.
  - Holds 0 stock.
  - Generates moderation alert and notifies both parties of quantity conflict.

### 4. Dispute Stock Holding Invariant

- **Invariant**: `disputed` purchase requests hold ZERO inventory stock (`quantity_reserved = 0`).
- **Rationale**: Prolonged dispute investigations must never allow a bad-faith buyer to freeze a student seller's items on campus. The hold expires at 24 hours regardless of dispute status.

### 5. Late Confirmation vs 24h Hold vs 7-Day Deadline

- **Window 1: 0 to 24 Hours (`reservation_expires_at`)**:
  - Stock is actively held. Mutual confirmation decrements held stock immediately.
- **Window 2: 24 Hours to 7 Days (`resolution_deadline`)**:
  - Stock hold has lapsed (item is available for other students to buy).
  - Request remains `pending` and both parties can submit late confirmations.
  - When late mutual confirmation arrives, transaction locks `listing` row with `FOR UPDATE`. If `quantity_available >= requested_quantity`, stock is decremented and transaction completes. If stock was purchased by another student and is insufficient, transaction fails with HTTP 409 Conflict.
- **Window 3: Beyond 7 Days**:
  - Request marked `expired` by daily cron sweep. No confirmations accepted.

### 6. Listing Stock Transition to "Sold"

- When a transaction reaches `completed`:
  1. Transaction decrements `quantity_available = quantity_available - confirmed_quantity`.
  2. Live `quantity_reserved` is recomputed.
  3. If `quantity_available <= 0`: `listing.status` transitions to `'sold'`.
  4. Any remaining live pending requests on the listing are immediately cancelled (`cancelled_by = 'system'`) and impacted buyers receive cancellation notifications.

### 7. Review Eligibility Seam

- Table: `review_eligibility`:
  - `id`: Primary key.
  - `purchase_request_id`: Unique reference to completed request.
  - `buyer_id`: Buyer eligible to review.
  - `seller_id`: Seller being reviewed.
  - `listing_id`: Listing reference.
  - `consumed_at`: Nullable timestamp (consumed when review is submitted in Step 09).
  - `created_at`: Timestamp.

---

## Open Questions for Review

1. **Self-Declaration Grace Period on Unilateral Confirmation**: If a buyer confirms `CONFIRMED` and the seller does not respond within 48 hours of being prompted, should the system auto-finalize to `completed` after a grace period, or let it expire as `unconfirmed`?
2. **Dispute Resolution Path**: Should student disputes in MVP purely log an audit record and notify users to settle privately, or should there be a basic staff intervention hook?
3. **Seller Reverse Confirmation**: If a seller initiates confirmation first ("I sold this item"), does that shorten the buyer's response window?

---

## STOP

**Implementation is halted for user review and approval before any Step 08 code is written.**

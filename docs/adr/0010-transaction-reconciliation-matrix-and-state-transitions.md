# 0010. Transaction Reconciliation Matrix, Asymmetric Confirmations, and Inventory Finalization

Date: 2026-10-13

## Status

Proposed (Awaiting User Review before Step 08 Implementation)

## Context

Downtown facilitates offline campus transactions initiated via WhatsApp. Following the handoff, the platform must reconcile whether physical exchanges succeeded, failed, or stalled, and synchronize listing stock accordingly.

Reconciliation introduces complex distributed consensus challenges between two mutually untrusted students:
1. **Asymmetric reporting**: One party reports success while the other reports non-receipt or failure.
2. **Ghosting / Unresponsiveness**: One or both parties fail to respond to confirmation prompts.
3. **Quantity discrepancies**: Parties agree a deal occurred but disagree on unit quantities.
4. **Time lag**: In-person meetups frequently take 2 to 4 days across class schedules and weekends.
5. **Inventory risk**: Freezing items during prolonged disputes allows malicious actors to lock student inventory.

## Decision

### 1. Reconciliation Response Matrix (SRS 7.2)

Each party (buyer and seller) can submit one of four reconciliation responses:
- `CONFIRMED`: Transaction completed as agreed.
- `NOT_COMPLETED`: Transaction did not happen (e.g., agreed to cancel, deal fell through).
- `NO_RESPONSE_YET`: The other party did not respond on WhatsApp or negotiations are ongoing.
- `DISPUTED`: Intentional dispute flagged (e.g., item defect, payment mismatch, fraud).

The consolidated state machine resolves pairs of responses as follows:

| Buyer Response | Seller Response | Resolved Status | Final Inventory Impact | Reviews Eligible? |
|---|---|---|---|---|
| `CONFIRMED` | `CONFIRMED` | `completed` | Decrement `quantity_available`; if 0 -> `sold` | Yes (Buyer only) |
| `CONFIRMED` | `NOT_COMPLETED` | `disputed` | Hold already expired at 24h; 0 stock held | No (Suspended) |
| `NOT_COMPLETED` | `CONFIRMED` | `disputed` | Hold already expired at 24h; 0 stock held | No (Suspended) |
| `NOT_COMPLETED` | `NOT_COMPLETED` | `cancelled` (`cancelled_by=mutual`) | Hold released; stock remains available | No |
| Any | `DISPUTED` / `DISPUTED` | `disputed` | Hold already expired at 24h; 0 stock held | No (Suspended) |
| `NO_RESPONSE_YET` | Any (pending) | `pending` | Follow-up re-queued; deadline remains 7d | No |
| Any (pending) | `NO_RESPONSE_YET` | `pending` | Follow-up re-queued; deadline remains 7d | No |
| None by Day 7 | None by Day 7 | `expired` | Hold released; status finalized | No |

### 2. Prompting Schedule

- **First Prompt**: Scheduled at `created_at + 24 hours` (coinciding with `reservation_expires_at`).
  - Buyer is prompted via in-app notification: *"Did you complete your purchase for {title}?"*
  - Seller is prompted via in-app notification: *"Did you sell {title} to {buyer_first_name}?"*
- **Early Self-Prompting**: If either party completes the transaction before 24h, they can initiate confirmation early from `/requests` or the listing detail. This immediately triggers a prompt notification to the counter-party.
- **Reminder Follow-up**: If either party marks `NO_RESPONSE_YET`, a re-check reminder is scheduled 48 hours later (subject to the 7-day hard ceiling).

### 3. Inventory Hold and Dispute Mechanics

- **Disputes Do NOT Hold Stock**: A request in `disputed` status has zero stock hold (`quantity_reserved = 0`). Holding inventory during multi-day dispute moderation creates a denial-of-service vector against student sellers.
- **Quantity Mismatches**: If buyer and seller report different confirmed quantities (e.g., buyer says 1 unit, seller says 2 units), the request is automatically escalated to `disputed` rather than `completed`.

### 4. Late Confirmation vs Dual-Timestamp Lifecycles

- **Phase 1: 0 to 24 Hours (`reservation_expires_at`)**:
  - Active stock reservation. Unreserved stock is decremented.
  - Confirmation atomically completes the deal.
- **Phase 2: 24 Hours to 7 Days (`resolution_deadline`)**:
  - The 24-hour stock hold has lapsed: the item is immediately available to other buyers in feed and search.
  - The request remains `pending` and both parties are free to submit late confirmations.
  - **Stock Check on Late Confirmation**: When late confirmation occurs, the transaction acquires a `SELECT ... FOR UPDATE` lock on the listing. If `quantity_available >= requested_quantity`, stock is decremented and the deal succeeds. If remaining stock has been sold to someone else in the interim, the confirmation is rejected with an explanatory conflict (409: *"Stock was released after 24h and purchased by another student"*).
- **Phase 3: Past 7 Days**:
  - The daily sweep marks unattended requests as `expired`. No confirmations can be submitted.

### 5. Idempotent Outcome Execution & Stock Finalization

- When a request reaches `completed`:
  1. Acquire `SELECT ... FOR UPDATE` on `listing`.
  2. Decrement `quantity_available = quantity_available - requested_quantity`.
  3. Recompute live `quantity_reserved`.
  4. If `quantity_available <= 0`: Set `listing.status = 'sold'`.
  5. If `status` becomes `'sold'`: System automatically cancels all remaining live pending requests on that listing (`cancelled_by = 'system'`) and dispatches notifications to impacted buyers.
  6. Insert a pending record into `review_eligibility` granting the buyer permission to leave a rating and review (Step 09 seam).
- Calling the confirmation endpoint repeatedly returns the existing finalized request with `HTTP 200 OK` (idempotent).

## Consequences

### Positive
- Prevents stock denial-of-service and indefinite inventory locks.
- Accommodates realistic student communication delays without artificial sweeps.
- Preserves full auditability of conflicting claims for moderation.
- Clean architectural seam for Step 09 reputation and review systems.

### Trade-offs
- If a seller does not hold an item past 24 hours and sells it to someone else, a late buyer confirmation may fail due to zero available stock. This is desired behavior: the 24h window was clearly communicated.

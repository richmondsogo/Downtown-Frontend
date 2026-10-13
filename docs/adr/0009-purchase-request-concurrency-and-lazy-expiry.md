# ADR 0009: Purchase Request Concurrency, Lazy Reservation Expiry, and Out-of-Stock Blocking

## Status

Proposed

---

## Context

In Step 07, the Downtown marketplace introduces purchase requests and direct buyer-to-seller WhatsApp handoffs. Multiple critical constraints shape this system:

1. **Inventory Reservation Concurrency**:
   Listings have finite inventory (`quantity_available >= 1`). If multiple buyers submit requests simultaneously for the last remaining unit, the system must guarantee that exactly one buyer secures the reservation, preventing overselling.

2. **Vercel Hobby Tier Cron Limitations**:
   Vercel Hobby strictly limits cron schedules to once per day (`0 0 * * *`). Frequent background crons (e.g., polling every 5 minutes to expire 24-hour reservations) are not supported on the free tier.

3. **SRS 5.2 Amendment Regarding Out-of-Stock Listings**:
   SRS 5.2 states: *"Buyers can still make offers on reserved listings."* However, if unreserved quantity is 0 and inventory is held, accepting additional requests creates phantom reservations, queue buildup, and seller confusion.

4. **Phone Privacy & Spam Protection**:
   Nigerian student phone numbers are highly sensitive. Sellers and buyers must have valid Nigerian phone numbers (`+234...`), but phone numbers must never leak into public listing payloads or search feeds.

---

## Decision

1. **Pessimistic Concurrency via PostgreSQL `SELECT ... FOR UPDATE`**:
   Reservation evaluation executes within an interactive database transaction that locks the specific listing row:
   ```sql
   SELECT quantity_available, quantity_reserved FROM listing WHERE id = $1 FOR UPDATE;
   ```
   No concurrent transaction can read or modify the listing's reservation state until the lock is released.

2. **Two-Tier Expiry Strategy (Lazy Expiry + Daily Sweep)**:
   - **Lazy Expiry**: During any reservation transaction, the query first identifies active requests on the locked listing where `expires_at < NOW()`. The transaction automatically marks them `expired`, decrements `quantity_reserved`, and recalculates available inventory on the fly.
   - **Daily Sweep**: A single daily Vercel cron job runs at 02:00 UTC (`/api/cron/expire-requests`) to reconcile lingering expired requests across untracked listings.

3. **Specification Amendment: Strict Reservation Blocking**:
   When `quantity_available - quantity_reserved <= 0`, the listing transitions visually to **"Reserved"**, and the "Contact Seller" CTA is disabled for new buyers. New purchase requests and offers are blocked until existing reservations expire or are cancelled.

4. **JIT WhatsApp Link Generation with Zero Public Phone Disclosure**:
   - Seller phone numbers are stored strictly on the private `user` record (`phone` column).
   - Public listing detail endpoints project only seller display name, campus, and trust metrics.
   - The WhatsApp direct message URL (`https://wa.me/234...?text=...`) is generated server-side and returned *only* in the JSON response payload of an authenticated `POST /api/listings/[id]/requests` call.

---

## Alternatives Considered

1. **Optimistic Concurrency Control (OCC) with version columns**:
   - *Why rejected*: Under high contention for a single hot item (e.g., student selling an iPhone for ₦100,000), OCC causes repeated retry loops and serialization failures. `SELECT ... FOR UPDATE` queues transactions cleanly and resolves in deterministic order.

2. **External Distributed Queue / Redis (BullMQ / Upstash)**:
   - *Why rejected*: Violates Invariant and project non-goals (zero Redis / zero external message broker dependencies). PostgreSQL handles locking natively with ACID guarantees.

3. **Frequent Webhook / External Scheduler (QStash, Cron-Job.org)**:
   - *Why rejected*: Introduces third-party external services and secret management overhead. Lazy expiry requires zero external infrastructure.

---

## Trade-offs

- **Row-Lock Hold Time**: `SELECT ... FOR UPDATE` holds a row-level lock for the duration of the transaction.
  - *Mitigation*: The transaction performs only primary key lookups and inserts within the same database session, completing in < 15 ms.
- **Lazy State Reconciliation**: Expired requests remain in `status = 'pending'` in the database until either the listing is accessed or the daily sweep executes.
  - *Mitigation*: Public availability calculations always evaluate `expires_at < NOW()` dynamically, ensuring no buyer or seller sees stale availability.

---

## Consequences

- Guarantees zero overselling race conditions.
- Adheres 100% to Vercel Hobby tier limitations.
- Preserves absolute student privacy for phone numbers.
- Amends SRS 5.2 to prevent phantom offers on out-of-stock items.

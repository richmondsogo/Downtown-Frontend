# ADR 0006: University Staff Verification Architecture

## Status

Accepted

## Context

In initial requirements (GOAL.md section 3.2), staff accounts were proposed to be verified via "institutional/personal email OTP". However, verifying an account as university staff confers verified seller badges and heightened trust in the campus community. 

Relying on email OTP alone without restricting the email domain would allow anyone with a personal Gmail address to register with `role: "staff"` and claim staff trust status without verification. Furthermore, Nigerian university institutional domain email addresses (e.g. `@uniosun.edu.ng`) are not ubiquitously issued to all staff, and many legitimate staff members use personal email addresses.

## Decision

We will verify university staff through a dual-path mechanism:

1. **Official Domain Allowlist (`STAFF_OFFICIAL_EMAIL_DOMAINS`)**:
   - An environment-configured allowlist (e.g. `uniosun.edu.ng`).
   - Default value is **empty** (`""`).
   - If a user signs up with an email matching an official domain in the allowlist, email OTP verification automatically verifies staff status.
2. **Staff ID Card Verification Queue**:
   - If the staff user registers with a personal email (Gmail, etc.) or if `STAFF_OFFICIAL_EMAIL_DOMAINS` is unconfigured/empty, email OTP confirms only email ownership (`auth_status`).
   - Staff seller status (`sellerStatus`) remains `not_a_seller` or `pending_verification` until the staff member uploads a photograph of their university staff identity card for review in the admin verification queue.
   - Email OTP alone **never** grants verified staff seller privileges.

## Alternatives Considered

1. **Email OTP Alone for Staff**:
   - *Rejected*: Allows trivial identity spoofing where any attacker registers a throwaway personal email with `role: "staff"` to obtain trusted status.
2. **Mandatory `.edu.ng` Domain Requirement**:
   - *Rejected*: Excludes legitimate university staff, adjuncts, and contractors who do not possess active official institutional email inboxes.

## Trade-offs

- Requires manual admin queue review for staff members using personal email addresses.
- Adds administrative overhead in early launch phases, but guarantees marketplace trust integrity.

## Consequences

- Staff registration with personal emails is fully supported.
- Trust badges (`verified`, `staff`) cannot be spoofed by signing up with a personal email.
- The `STAFF_OFFICIAL_EMAIL_DOMAINS` environment variable can be populated whenever institutional domain authentication is coordinated with university IT.

# ADR 0004: Authentication Library Selection & Verification Flow

## Status

Accepted

## Context

Downtown requires an authentication architecture for students, staff, and vendors at UNIOSUN. In Step 01, we established a Next.js App Router API service layer (`apps/api`) reverse-proxied by Next.js Web (`apps/web`) to support same-origin `httpOnly` session cookies.

We needed to evaluate whether to adopt **Better Auth** or construct a custom authentication subsystem (scrypt/argon2 + manual session tables + crypto tokens) based on the following strict requirements:
1. Email and password authentication with min 8, max 128 character constraints.
2. Direct integration with Drizzle ORM and PostgreSQL database sessions.
3. Anti-enumeration protections (identical responses for existing vs non-existent accounts).
4. Configurable endpoint rate limiting stored in PostgreSQL / secondary storage, keying on real client IPs behind the Next.js rewrite proxy.
5. Email verification and password recovery with automatic session revocation on reset.

### The Nigerian Mobile Context: In-App Browser Session Fragmentation
A critical real-world friction point for Nigerian students is that verification links clicked inside Android email clients (e.g., Gmail, Yahoo Mail, or WhatsApp) frequently open inside ephemeral in-app webviews rather than the student's primary mobile browser (Chrome/Opera). If verification relies strictly on a link, the newly authenticated session is created inside the ephemeral webview, stranding the user when they return to their original browser tab.

## Decision

We chose **Better Auth** with the **Drizzle ORM Adapter** and the **`emailOTP` plugin** for email verification.

Key configurations:
1. **Drizzle Adapter & PostgreSQL Sessions**: Better Auth persists users, database sessions, accounts, and verifications in PostgreSQL with zero external auth SaaS dependency.
2. **6-Digit Email OTP for Verification**: Email verification uses a 6-digit OTP (10-minute expiry, max 5 attempts per code, rate-limited resend). The student views the code in their email notification and types/pastes it directly into their existing Downtown browser session, avoiding the Android in-app browser session loss trap.
3. **Link-Based Password Reset**: Password recovery remains link-based, directing users to a dedicated reset page, with `revokeSessionsOnPasswordReset: true` to invalidate any compromised sessions across all devices.
4. **Database Rate Limiting & Proxy IP Resolution**: Rate limits are stored in the database (`rateLimit.storage: "database"`) and keyed on the real client IP using `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]`.
5. **Contract Protection & DB Constraints**: Signup input is pre-validated with our shared `SignUpSchema` in a Better Auth `before` hook. A database `CHECK (role IN ('student', 'staff', 'vendor'))` constraint enforces role restrictions at the PostgreSQL layer.

## Alternatives Considered

1. **Custom Authentication Layer (scrypt/argon2 + custom tokens)**: Would require authoring and maintaining timing-safe password hashing, custom CSRF and cookie token rotation, custom DB session cleaners, and bespoke rate limiting middleware. Higher surface area for security oversights.
2. **NextAuth / Auth.js**: Heavily biased towards OAuth providers, awkward Drizzle database session adapters, lacking native rate limiting and OTP support.
3. **Clerk / Auth0 / Supabase Auth**: Introduces third-party external redirects, vendor lock-in, and monthly active user cost scaling inappropriate for a bootstrapped campus marketplace.

## Trade-offs

- **Library maturity**: Better Auth is newer than NextAuth, but its architecture is modular, TypeScript-first, and natively supports database sessions and Drizzle.
- **OTP entry step**: Requires the user to enter 6 digits rather than clicking a single link, but eliminates session loss on Android devices.

## Consequences

- Better Auth route handlers are mounted under `/api/auth/[...all]` in `apps/api`.
- Client requests go to `/api/auth/*` via `apps/web` proxy rewrite, maintaining same-origin `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- Comprehensive unit and integration test suites cover signup validation, admin role rejection, rate limiting, and account enumeration safety.

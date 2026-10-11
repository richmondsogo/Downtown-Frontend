# Step 02c: Production Email Guard & Feature Flag Protection

**Step Branch**: `step/02c-prod-email-guard`  
**Primary Branch**: `master`  
**Pull Request**: https://github.com/richmondsogo/Downtown-Frontend/pull/5  

---

## Objective

Prevent sensitive authentication tokens (OTP verification codes and password reset links) from leaking to production standard output / serverless function logs before a production email service (Resend) and custom domain are configured, while preventing premature public account registrations on production deployments.

---

## Scope

### Included
- `apps/api/src/services/email.service.ts`:
  - Added `ProductionEmailService` that suppresses outbound OTP and password reset logging to stdout.
  - Logs a masked recipient identifier (`j***@example.com`) without secrets or tokens.
  - Returns a clear error stating email delivery is disabled pending domain configuration.
  - Updated `getEmailService()` to select `ProductionEmailService` in production environments when Resend is disabled.
- `apps/api/src/services/auth.service.ts`:
  - Added `ENABLE_SIGNUP` feature flag check within the Better Auth `before` middleware hook specifically targeting `/sign-up/email`.
  - Rejects registration attempts with HTTP 403 `FORBIDDEN` when signup is disabled.

### Excluded
- Modifying sign-in or session verification routes.
- Introducing third-party SDK dependencies or configuring live DNS records.

---

## Implementation & Rationale

1. **Why `ProductionEmailService`**:
   `ConsoleEmailService` prints OTP codes and password reset URLs directly to `console.log` for local development and preview debugging. In a live production environment, streaming one-time passwords into platform log aggregators presents an account takeover vulnerability. `ProductionEmailService` acts as a fail-closed production stub that masks the target email address and logs an informational notice without exposing credentials.

2. **Why `ENABLE_SIGNUP` Guard**:
   Ahead of MVP launch, public access to the registration endpoint could allow unverified user accounts to accumulate in the production database prior to domain verification and automated email delivery. The guard intercepts POST requests to `/sign-up/email` in production (defaulting to disabled unless `ENABLE_SIGNUP="true"`) and returns HTTP 403.

---

## Code Review Findings (Step 02c Diff `e9ae001`)

Conducted two-axis review of the Step 02c commit (`e9ae001`):

### Standards
- **Logging Safety**: Compliant with `AGENTS.md` and repository secret hygiene standards. Recipient emails are regex-masked (`to.replace(/(?<=^.).+(?=@)/, "***")`) and no token arguments (`_otp`, `_resetUrl`) are interpolated into logs.
- **Environment Discrimination**: Explicitly evaluates `VERCEL_ENV === "production"`, aligning with established repository decisions documented in ADR 0005 and Step 02b.
- **Copy Hardcoding (Smell)**: The error message in `auth.service.ts` hardcoded the MVP launch date (`November 30, 2026`). Flagged for correction in Step 02d to use generic copy: `"Registration is not open yet."`

### Spec
- **Email Guard Implementation**: Matches requirements. Outbound production emails fail closed without stdout token leakage.
- **Signup Guard Isolation**: Verified that `ENABLE_SIGNUP` applies strictly to `/sign-up/email` via `ctx.path === "/sign-up/email"` and does not interfere with `/sign-in/email` or other auth routes.
- **Missing Documentation**: The step log `docs/steps/02c-prod-email-guard.md` was not committed alongside the implementation branch. Retroactively recorded here.

---

## Verification

### Automated Checks
- Verified `apps/api` builds and types pass cleanly.
- Unit tests in `apps/api/src/__tests__/email-service.test.ts` confirmed `ConsoleEmailService` throws in production and `ProductionEmailService` activates when `VERCEL_ENV === "production"`.

### Live Production Smoke Tests (`https://downtown-web-five.vercel.app`)
1. **Health Check**:
   - `GET /api/health` -> HTTP 200 (`status: "ok"`, `database.connected: true`).
2. **Role Escalation Rejection**:
   - `POST /api/auth/sign-up/email` with `role: "admin"` -> HTTP 400 (`Invalid discriminator value`).
3. **Production Signup Guard**:
   - `POST /api/auth/sign-up/email` with valid student payload -> HTTP 403 (`Student registration is currently disabled`).
   - Verified zero plaintext OTP tokens appeared in runtime logs.
4. **Rate Limiting Enforcement**:
   - Consecutive calls to `/api/auth/sign-in/email` tripped rate limiter at threshold with HTTP 429 (`TOO_MANY_REQUESTS`).

---

## Diff / Checkpoint

- Pull Request URL: https://github.com/richmondsogo/Downtown-Frontend/pull/5
- First commit SHA: `e9ae001cee92acf29a91525d2631e34de42a2909`
- Last commit SHA: `e9ae001cee92acf29a91525d2631e34de42a2909`
- Merge commit SHA: `072b1ea17fc6cebfa65e94b2938ebfc910b8cf89`
- Merge strategy: Standard merge commit (`--no-ff`)

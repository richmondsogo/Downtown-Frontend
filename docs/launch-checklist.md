# Downtown MVP Launch Checklist

This checklist defines mandatory operational, security, legal, and QA checkpoints required prior to opening public registration and promoting the Downtown platform to students and staff.

---

## 1. Domain & Communications Infrastructure

- [ ] **Custom Domain & Unified DNS Configuration**:
  - Configure production domain DNS records (Apex and `www` CNAMEs to Vercel).
  - Verify SSL certificate issuance and HTTPS termination on Vercel Edge.
  - Align unified domain strategy: use single apex domain for both transactional email routing (`mail.<domain>`) and Cloudflare R2 public asset serving (`cdn.<domain>` or `photos.<domain>`).
- [ ] **Resend Transactional Email Setup**:
  - Provision and verify sending domain DNS records (SPF, DKIM, DMARC) in Resend.
  - Set `RESEND_API_KEY` in Vercel production environment for `downtown-api`.
  - Set `ENABLE_RESEND_EMAIL="true"` in production environment.
- [ ] **Remove `ProductionEmailService` Stub**:
  - Verify that `getEmailService()` in `apps/api/src/services/email.service.ts` routes all outbound emails to `ResendEmailService`.
  - Confirm real OTP verification and password reset emails deliver successfully to real Gmail/Yahoo test accounts.
- [ ] **Vercel Blob Production Store & Quota Monitoring**:
  - Re-check Vercel Hobby commercial-use terms against Vercel's primary fair-use page before launch (upgrade to Pro if we charge anything on the platform).
  - Create the production Blob store (`downtown-listings-prod`) in Vercel dashboard with the default `BLOB` prefix (generating `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, etc.), connected to Production only if the dialog allows it.
  - Confirm production code strictly reads `BLOB_READ_WRITE_TOKEN` when `VERCEL_ENV === "production"` and fails closed if missing (never falls back to `DEV_*` tokens).
  - Set `STORAGE_PROVIDER="vercel_blob"` in Vercel production environment for `downtown-api`.
  - Verify `STORAGE_SOFT_CAP_BYTES="838860800"` (800 MB soft cap guarding the 1 GB Hobby limit).
  - Configure monitoring for store usage against the cap; operational upgrade/migrate trigger set at ~70% of 1 GB (~700 MB) to transition to Pro or migrate to Supabase Storage.
  - Verify public URLs and immutable edge cache headers (`cacheControlMaxAge: 31536000`) so CDN hits do not count toward Blob transfer.
- [x] **Student Areas Reference Data (`docs/data/student-areas.csv`)**:
  - Curated UNIOSUN student residential areas populated across Osogbo campus (19 rows).
  - Seeded into production PostgreSQL reference data via `scripts/run-prod-migrations.ps1 -Action seed-taxonomy`.
- [ ] **Founders' Decision: Launch Campuses & Student Areas Coverage**:
  - *Context*: `docs/data/student-areas.csv` currently only has Osogbo campus student residential areas (19 rows); the other 5 UNIOSUN campuses (Ikire, Okuku, Ifetedo, Ipetu-Ijesha, Ejigbo) currently have zero granular student areas and only campus-level fallback locations.
  - *Decision Required*: Founders must decide launch scope before public rollout:
    - **Option 1 (Osogbo Pilot)**: Launch exclusively at Osogbo campus for public MVP; expand to other 5 campuses once campus ambassador leads compile and verify granular hostel clusters.
    - **Option 2 (All Campuses with Campus-Level Fallbacks)**: Launch all 6 campuses simultaneously; campuses without student areas display campus-level locations (e.g. "Ikire Campus (Campus-wide)") and allow student-submitted custom locations (`POST /api/locations`).
  - *UI Safeguard*: The web client displays campus-level locations gracefully when a campus has no sub-areas, avoiding broken empty states.

---

## 2. Security & Access Control

- [ ] **Narrow `trustedOrigins` Verification**:
  - Confirm production Better Auth instance trusts **exclusively** the production canonical web domain.
  - Verify zero wildcard (`*.vercel.app`) origins exist in production configuration.
  - Run origin-header automated tests against production API deployment.
- [ ] **Secret Rotation**:
  - Rotate Neon production database credentials (`DATABASE_URL`).
  - Rotate `BETTER_AUTH_SECRET` (generate fresh 32-byte cryptographically secure hex).
  - Verify all old secrets are removed from shell history, local machines, and Vercel environment revisions.
- [ ] **Vercel Deployment Protection Re-evaluation**:
  - *Context*: Deployment protection (Vercel Authentication / password protection) was intentionally disabled on both `downtown-web` and `downtown-api` during early preview bootstrap to allow reverse-proxy rewriting and automated smoke testing without Vercel platform cookie friction.
  - *Decision*: Re-evaluate protection policy. Keep production public; assess standard bypass headers or IP restriction for preview environments if sensitive pre-release testing is required.

---

## 3. Legal & Governance Sign-Off

- [ ] **Privacy Policy & Terms of Service Sign-Off**:
  - Legal sign-off on NDPR (Nigeria Data Protection Regulation) compliance terms.
  - Explicit policy confirming:
    - Ephemeral retention and immediate destruction of student ID photos (maximum 24 hours if queued for manual review).
    - Platform disclaimer clarifying Downtown is an independent marketplace and does not claim official university registrar affiliation.
  - Publish `/privacy` and `/terms` public routes on the web app.

---

## 4. Feature Flag & Public Enablement

- [ ] **Flip `ENABLE_SIGNUP`**:
  - Set `ENABLE_SIGNUP="true"` on Vercel production environment for `downtown-api`.
  - Redeploy API or trigger environment variable reload.
  - Confirm `/api/auth/sign-up/email` permits student registrations and no longer returns HTTP 403 ("Registration is not open yet.").

---

## 5. Physical Device & Field Testing

- [ ] **Low-End Android Device Verification**:
  - Test core journeys on real physical Tecno and Infinix Android devices running Android 10–13 over real cellular networks (MTN, Airtel, Glo):
    - Guest browsing -> Soft-gate modal -> Student registration -> OTP receipt -> Login.
    - Category pill scrolling, location selection, image loading speeds.
  - Verify tap targets (minimum 44×44px), absence of horizontal overflow, and responsive rendering at 360px–390px viewports.
- [ ] **iOS Safari Verification**:
  - Verify touch interactions, form input zoom prevention (font size >= 16px), and session persistence on real iOS devices.

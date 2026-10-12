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
- [ ] **Cloudflare R2 Production Bucket & Token**:
  - Provision production R2 bucket (e.g. `downtown-photos-prod`).
  - Create scoped Cloudflare API token with Object Read/Write access restricted strictly to the production bucket.
  - Configure custom public CDN domain on the R2 bucket.
  - Inject `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` into Vercel production environment.
- [x] **Student Areas Reference Data (`docs/data/student-areas.csv`)**:
  - Curated UNIOSUN student residential areas populated across Osogbo campus.
  - Seeded into production PostgreSQL reference data via `scripts/run-prod-migrations.ps1 -Action seed-taxonomy`.

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

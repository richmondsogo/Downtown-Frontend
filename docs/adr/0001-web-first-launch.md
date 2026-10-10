# ADR 0001: Web-First Launch, Mobile Deferred (Expo After Nov 30)

## Status

Accepted

## Context

Downtown is targeting an MVP launch date of November 30, 2026, starting at Osun State University (UNIOSUN). The core engineering team consists of three people:
- One frontend engineer
- One backend engineer
- One product, QA, and growth lead

The original product specification (`GOAL.md`) plans for both a responsive web interface (Next.js) and cross-platform native mobile apps for Android and iOS using React Native + Expo.

Building, verifying, and publishing native apps through Google Play and the Apple App Store introduces several critical friction points:
1. **App Store Review Cycles**: Review times and store rejections introduce schedule variance that could delay a hard November 30 launch date.
2. **Installation Friction**: For an unproven campus marketplace, requiring students to download a ~30MB+ native app before browsing creates high churn. Open guest discovery on the web has zero friction.
3. **SEO & Link Sharing**: WhatsApp status updates and campus group chats are the primary distribution channels. Shared web URLs (`downtown.ng/listing/123`) open instantly in any browser without requiring an installed application.
4. **Engineering Bandwidth**: Splitting one frontend engineer across web and Expo EAS pipelines within 16 weeks risks delivering two half-finished products.

## Decision

We will build and launch **Web-First** for the November 30, 2026 MVP:
- The entire user-facing surface (buyer discovery, seller onboarding, listing management, admin dashboard) will be delivered via a responsive, mobile-first Next.js web application.
- The interface will be heavily optimized for entry-level Android devices (Tecno, Infinix) running mobile browsers (Chrome, Phoenix, Opera Mini).
- React Native + Expo mobile application development is deferred to post-MVP (after November 30, 2026).
- The Turborepo structure and backend services remain strictly contract-first and platform-agnostic, sharing TypeScript types and Zod schemas in `packages/` so that the Expo app can directly consume existing API endpoints post-launch without backend changes.

## Alternatives Considered

1. **Simultaneous Web + Expo Launch**:
   - *Pros*: Provides native app store presence from day one.
   - *Cons*: Stretches the sole frontend engineer across two UI runtimes; high risk of missing the November 30 deadline due to EAS build configuration and store review lag.
2. **Mobile-Only Launch (Expo First)**:
   - *Pros*: Single codebase for iOS and Android.
   - *Cons*: Completely destroys viral WhatsApp link sharing and Google search indexing; forces students to install an app just to view a single listing.

## Trade-offs

- Students will not have a native home-screen app icon or native push notifications at launch (mitigated by responsive mobile web, PWA manifest, and email/SMS/WhatsApp transaction notifications).
- Mobile browser performance on low-end hardware must be rigorously protected (requires disciplined bundle splitting, minimal client-side JS, and zero heavy CSS effects like glassmorphism).

## Consequences

- The frontend team can focus 100% of effort on shipping a polished, high-performance responsive web experience on Vercel.
- Instant, zero-friction deployments via Vercel allow daily iteration and immediate bug fixes during the critical campus launch window.
- The monorepo layout reserves space for `apps/mobile` while keeping `packages/types` and `packages/validation` ready for the post-launch Expo client.

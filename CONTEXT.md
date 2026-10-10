# Project Context

> This is the authoritative source of project/domain knowledge for this repository.
>
> Keep it synchronized with architectural decisions in `docs/adr/`.
>
> Agents should read this at the start of each session to avoid repeatedly
> rediscovering terminology, constraints, and intent.

---

## Product

Downtown is a trust-anchored campus marketplace starting at Osun State University (UNIOSUN), enabling students, staff, and local vendors to buy and sell goods and services. It provides a structured, verified alternative to scattered WhatsApp status updates and group chat commerce.

## Users

- **Students**: Buying daily essentials, textbooks, electronics, fashion, and food; selling used items or running student businesses.
- **Staff**: Buying and selling within the trusted campus ecosystem.
- **Local Vendors**: Commercial businesses located near campus selling meals, groceries, and student goods.
- **Admins**: Founding team managing verification queues, listing moderation, dispute escalations, and taxonomy.

## Core Problem

Peer-to-peer commerce on campus is informal, chaotic, and high-risk. Transactions happen via WhatsApp statuses and group chats with zero identity verification, no fraud protection, and no inventory management. Buyers risk scams and sellers struggle with discovery. Downtown provides discovery, student credential verification, and structured deal tracking while leaving physical negotiation to WhatsApp.

## Domain

Campus e-commerce, student identity verification, listing moderation, peer-to-peer trade with WhatsApp communication handoff, campus meetup safety, and two-party post-meetup transaction reconciliation.

### Listing Lifecycle
`Draft` → `Pending Moderation` → `Published` → `Reserved` → `Sold` → `Archived`
- **Inactivity**: 30 days without activity triggers a nudge notification to seller; 60 days auto-archives (can be relisted with one tap).
- **Listing Edits**: Low-risk edits (description, location) remain live without re-check; high-risk edits (price, title, photos, condition, category) are routed through automated moderation.

### Category Taxonomy (v1)
- Electronics
- Fashion & Accessories
- Food & Drinks
- Home & Living
- Books & Study Materials
- Beauty & Personal Care
- Services (tutoring, printing, laundry)
- Tickets & Events
- Other

### Safety & Moderation Escalation
- **Prohibited Items**: Weapons/ammunition, drugs and paraphernalia, counterfeit goods, stolen goods, live animals, adult content, academic dishonesty services (exam-writing, assignment mills).
- **Moderation Pipeline**: Policy check → Automated inspection → Human Admin Review for uncertain cases.
- **Escalation Policy**: 1st confirmed violation: Warning. 2nd: Listing removed + 7-day suspension. 3rd: Permanent ban. Severe incidents (fraud, weapons, harassment) skip directly to immediate suspension pending review.

## Important Terms

| Term | Definition |
|---|---|
| `University / Campus` | Multi-campus organizational model. Launching with UNIOSUN (Osogbo, Ikire, Okuku, Ifetedo, Ipetu-Ijesha, Ejigbo campuses). |
| `role` | Base user role: `student`, `staff`, `vendor`, `admin`. |
| `seller_status` | Account seller state: `not_a_seller`, `pending_verification`, `verified`, `suspended`, `banned`. |
| `seller_type` | Verified seller classification: `student_individual`, `student_vendor`, `staff`, `vendor`. |
| `auth_status` | Email confirmation state ("this email is owned by this user"). Distinct from seller verification. |
| `PurchaseRequest` | Structured intent created when a buyer clicks "Contact Seller" with requested quantity and optional offer price. |
| `Reservation` | Temporary 24-hour hold placed on listing inventory during an active `PurchaseRequest`. Stock returns if expired or rejected. |
| `TransactionConfirmation` | Mutually agreed post-meetup resolution prompt ("Did this purchase happen?") reconciling buyer and seller responses. |
| `Ephemeral ID` | Student ID photo uploaded for verification. Deleted immediately after automated checks or within 24h if queued for manual review. |
| `ID Hash` | One-way cryptographic/perceptual fingerprint stored permanently to detect duplicate ID submissions across accounts. |
| `Soft Gate` | Allowing guest browsing unconditionally, prompting signup only when initiating contact or selling. |
| `Curated Location` | Predefined list of UNIOSUN campuses and surrounding student residential areas. |

## Actors

- **Guest**: Unauthenticated visitor. Full access to browse, search, filter, and inspect listings and public seller profiles.
- **Buyer**: Authenticated user. Can save listings, submit purchase requests with offers, and review sellers after confirmed deals.
- **Student Seller (Individual)**: Student verified via automated student ID inspection. Can create listings and confirm sales.
- **Student Vendor**: Student verified with student ID plus business name/category.
- **Staff Seller**: University staff verified via institutional/personal email OTP.
- **Local Vendor**: Non-student business verified via application form and Downtown team phone call.
- **Admin**: Founding team member with Super Admin access to moderation, verification, and dispute queues.

## Constraints

- **Launch Scope**: Exclusively UNIOSUN for MVP.
- **Target Launch Date**: November 30, 2026.
- **Target Devices**: Low-to-mid-range Android smartphones (Tecno, Infinix) on unreliable mobile connections; demands server-side ranking, aggressive image optimization, minimal client JS, and small bundles.
- **Privacy & NDPR**: ID images must never be stored long-term (deleted within seconds or max 24h). No claim of official university registrar enrollment in copy.
- **No In-App Payments**: Downtown facilitates discovery and contact. Negotiation and payments happen directly between parties via WhatsApp and in-person meetups.

## Non-Goals

- In-app payment processing, escrow, or digital wallets.
- In-app chat (WhatsApp is the designated messaging channel for v1).
- Platform-managed delivery or courier logistics.
- Personalized recommendation engine (ranking remains global and indexed for MVP).
- Two-way buyer ratings (reviews are strictly buyer-to-seller; sellers can report abusive buyers).
- Multi-campus user interface at launch (supported in database model, but single campus UI for v1).

## Important Decisions

- **ADR 0001**: Web-First Launch (Next.js responsive web application prioritized for November 30, 2026 launch; React Native / Expo native mobile builds deferred to post-MVP).
- **Ephemeral Student ID Pipeline**: Automated OCR/verification with immediate file destruction, retaining only ID fingerprint hash for fraud detection.
- **WhatsApp Pre-Filled Handoff**: Standardized WhatsApp message generation paired with a 24-hour inventory reservation and dual-confirmation reconciliation loop.

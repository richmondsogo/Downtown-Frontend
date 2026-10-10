# Software Requirement Specification
Product: Downtown, a campus marketplace starting at UNIOSUN
Status: MVP planning, locked for build
Team: 3 people
Stack: TypeScript everywhere: Next.js (web + API), React Native + Expo (mobile), PostgreSQL
Target MVP launch: November 30, 2026
> Read this like a working doc, not a compliance document. Two items are still open, flagged where they come up and summarized again at the end. Everything else here is decided and ready to build.
### 1. What We're Building
Downtown is a campus marketplace where students, staff, and local vendors can buy and sell anything from a used laptop to sneakers to food with each other. Think of it as Craigslist for one campus, with actual trust built in.
The problem: buying and selling around campus today is informal, scattered across WhatsApp statuses and group chats, and has zero trust infrastructure. You're taking a stranger's word for everything.
What makes Downtown different from Campor (our closest comparable): a better buying/selling experience, and real trust, verification, and safety instead of an open free-for-all.
Launch scope: UNIOSUN only. The system is architected around a University → Campus concept so other schools can be added later without a rewrite, though there is no multi-campus UI in v1.
### 2. MVP Philosophy (read this before reading anything else)
- Anyone can browse. No account needed to look around.
- Anyone can become a buyer with almost no friction.
- Selling requires verification. That's where trust gets built.
- Listings are moderated automatically, with humans handling the exceptions.
- Downtown facilitates discovery and contact. It does not process payment or guarantee transactions in v1. WhatsApp handles the actual negotiation and meetup.
- Either party can confirm or dispute what actually happened, so we get real transaction data without owning the transaction.
- Trust is built from verification, completed sales, ratings, and moderation, not vibes.
### 3. Users & Roles
			Concept
			Values
			role
			student, staff, vendor, admin
			seller_status
			not_a_seller, pending_verification, verified, suspended, banned
			seller_type (once verified)
			student_individual, student_vendor, staff, vendor
			auth_status
			separate from verification: "this email belongs to this person" does not mean "this person is a verified student/vendor"
Everyone signs up the same way: create an account, use Downtown as a buyer, and optionally "Become a Seller" later. Selling is an upgrade to your account, not a separate registration flow.
### 4. Accounts, Onboarding & Verification
#### 4.1 Signup
- Guest browsing is fully open. No account needed to browse, search, filter, view listings, or view seller profiles.
- Account required only when it's actually needed: contacting a seller. A soft gate, triggered mid-action, not a wall on landing.
- Signup method: email + password + email verification (OTP/link). No social login in v1.
- Phone number is not collected at signup. It's requested later, when the user is about to contact a seller or sell.
- Password recovery: email reset link.
			Account type
			Info collected at signup
			Student
			Name, personal email, matric number, password
			Staff
			Name, personal email, password
			Vendor
			Name / business name, email, password
#### 4.2 Becoming a Seller
A verified regular user taps "Become a Seller" and picks one of:
Student Seller (individual)
1. Upload student ID photo.
2. Automated checks: image present, readable, expected ID fields present, name/matric number matches signup info, not a duplicate of another account's ID.
3. High-confidence pass → auto-approved, verified immediately.
4. Uncertain/failed → retry allowed; repeated failures escalate to a human Admin Review queue.
Student Vendor / Student Business: same ID verification, plus business name and business category.
Staff: verify staff/personal email via OTP or link, then verified immediately.
Vendor (non-student, local business): application form (contact name, business name, phone, business category, location, description, business/social link), followed by a phone call from the Downtown team, then admin approval or rejection, resulting in a Verified Vendor badge.
#### 4.3 ID Photo Handling
- Image is deleted immediately after the automated check completes (typically seconds).
- If escalated to manual admin review, the image is hard-deleted within 24 hours regardless of whether a human has reviewed it yet. The review decision must happen inside that window, or the case defaults to requiring resubmission.
- What we keep instead: verification status, timestamp, method, automated confidence/result, reviewing admin (if manual), and a hash/fingerprint of the ID to detect reuse across accounts. No raw ID image is ever persisted long-term.
- Visibility: only the verification system and authorized admins. Never public, never shown to other users.
- Downtown has no access to the school's official student database. "Verified Student" means "submitted plausible credentials that passed our checks," not "confirmed enrolled by the university." State this honestly in Terms/UX copy.
#### 4.4 Identity Shown Publicly
- Individuals default to first name + last initial (e.g., "Richmond O.").
- Vendors and student businesses can use a business/display name instead, subject to a basic appropriateness check.
- The underlying verified identity always stays tied to the account privately.
### 5. Listings
#### 5.1 Core Fields
Photos (1-5) · Name · Price · Negotiable (yes/no) · Category + subcategory · Description (category-aware) · Condition (category-specific) · Location · Quantity.
#### 5.2 Listing Lifecycle
```Draft → Pending Moderation → Published → Reserved → Sold → Archived

```
			State
			Meaning
			Draft
			Being created, not submitted
			Pending Moderation
			Automated checks running
			Published
			Live, fully discoverable, normal ranking
			Reserved
			Still visible, deprioritized in ranking, buyers can still make offers
			Sold
			Reachable via direct search or if saved, marked "Sold," excluded from recommendations/popular/new
			Archived
			Off the marketplace, can be relisted with one tap
#### 5.3 Category Taxonomy
Admin-controlled taxonomy. Sellers can suggest new categories; admins approve them.
v1 top-level categories: Electronics · Fashion & Accessories · Food & Drinks · Home & Living · Books & Study Materials · Beauty & Personal Care · Services (tutoring, printing, laundry, etc.) · Tickets & Events · Other.
Subcategories and per-category custom fields (e.g., Electronics → Phone: brand, storage, battery health) still need to be filled in. This is a spreadsheet exercise the team can do incrementally as real listings come in, not a launch blocker.
#### 5.4 Listing Inactivity
- 30 days with no activity on a Published listing → nudge notification to the seller ("still have this?").
- 60 days with no response → auto-archive (not deleted, one tap to relist).
#### 5.5 Editing a Live Listing
			Edit type
			Effect
			Low-risk (description wording, location clarification)
			Stays live, no re-check
			High-risk (price, category, photos, name, condition)
			Sent back through automated moderation
### 6. Search, Discovery & Ranking
#### 6.1 Home Screen
```Search bar → Categories → Popular/trending listings → Newest listings

```
No personalized section in v1.
#### 6.2 Search
Keyword search + autocomplete + filters + sort. Filters: category, subcategory, price range, condition, location, seller type, verified-seller-only, availability. Sort: Relevance (default), Newest, Price low→high, Price high→low.
#### 6.3 Filtering vs. Ranking vs. Sorting
- Filtering: what's eligible (published, available, matches the query).
- Ranking: default order is relevance → availability → location relevance → recency → seller trust → engagement.
- Sorting: explicit user override of the default ranking.
Location is one ranking signal among several, not a hard filter.
#### 6.4 Performance Requirement
Must run well on low/mid-range Android devices: server-side ranking, indexed queries, pagination/infinite scroll, compressed/lazy-loaded images, minimal client JS, graceful degradation when location is unavailable.
#### 6.5 Personalization
Deferred until there's real usage data. Build ranking as a swappable module so GlobalRanker → PersonalizedRanker doesn't require rebuilding search later.
#### 6.6 Listing Card & Page
Card: photo, name, price, condition, seller verification badge, location, availability.
Page hierarchy: photos → name → price → availability/negotiable status → seller trust signals → description → location/meetup info → Contact Seller CTA → similar listings (future).
#### 6.7 Saved Listings
Buyers can save/favorite listings. If a saved listing sells, it stays in the list but greys out and is marked "Sold," and the user gets notified. It doesn't silently vanish.
### 7. Contacting a Seller & the Purchase Flow
#### 7.1 The Flow
1. Buyer opens a listing, picks a quantity, and (if negotiable) enters an offer.
2. Buyer taps Contact Seller. Downtown creates a Purchase Request (listing, buyer, seller, requested quantity, unit price, offer if negotiable, status = pending).
3. Brief in-context safety reminder shows before WhatsApp opens.
4. WhatsApp opens immediately with a pre-filled message generated from the listing and offer data (no manual typing needed):
	- Non-negotiable: "Hi John, I saw your Nike Air Force 1 listed on Downtown on Aug 9 for ₦45,000. Is it still available?"
	- Negotiable: "Hi John, I saw your Nike Air Force 1 on Downtown for ₦45,000. I'd like to offer ₦40,000. Is it still available?"
5. Seller gets a notification.
6. Negotiation and meetup happen entirely on WhatsApp. Downtown doesn't manage this part.
7. Afterward, both buyer and seller separately get: "Did this purchase happen?"
#### 7.2 Reconciling What Happened
			Buyer says
			Seller says
			Result
			10
			10
			Completed: inventory decremented, sale counted, buyer prompted to review
			10
			11
			Disputed: inventory not auto-adjusted, flagged for admin
			10
			Didn't happen
			Disputed
			Didn't respond
			10
			Pending / follow-up
			Neither responds
			N/A
			Expired, no sale counted
Only a mutually-agreed Completed transaction touches inventory or reputation.
#### 7.3 Inventory & Reservation
- quantity_available only decreases on a Completed transaction.
- A Purchase Request temporarily reserves the requested quantity.
- Reservation expiry: 24 hours. If not resolved within that window, the reservation releases and the stock returns to available. This is a default rather than something the team confirmed directly, so flag it if you'd rather use a longer window, like 48 hours for lower-traffic categories.
- Only one active Purchase Request per buyer per listing at a time; closed ones (completed/disputed/expired/cancelled) become history.
- Honesty clause: Downtown's inventory numbers are seller-declared and reconciled after the fact, not guaranteed in real time.
#### 7.4 Meetup Safety
Lightweight, non-blocking reminder at the point of contact: "Meet in a public, familiar location and avoid sending money before you've verified the item and seller."
#### 7.5 Explicitly NOT in v1
No in-app payments. No in-app chat (WhatsApp is the channel). No in-app negotiation/offer tracking beyond the initial offer passed to WhatsApp. This groundwork is intentional: Purchase Request → Transaction Confirmation is designed so Order → Payment → Delivery can be layered on later without a redesign.
### 8. Trust, Reviews & Reputation
#### 8.1 Reviews
Only buyer to seller (sellers can report buyers, no public buyer rating). Eligible only after a Completed transaction. Format: 1-5 stars + predefined tags (Reliable, Product as described, Easy to communicate with, On time, Friendly) + optional comment. Reviews are immutable.
#### 8.2 What Buyers See (public)
```Verified Student Seller
4.8 stars · 127 reviews
98% successful transactions

```
#### 8.3 Internal Trust Score
No internal numeric trust score for MVP. There's no data yet to weight it sensibly, and a badly-tuned formula is worse than none. Admins sort/filter sellers by the raw stats above (rating, review count, completed transactions, dispute count, report count) manually. Revisit building a real weighted score once there are a few months of transaction data to tune it against.
#### 8.4 Reports vs. Reviews vs. Transactions
Kept as separate systems on purpose: a single angry report shouldn't tank someone's public rating. Reviews build public reputation. Reports feed moderation. Transactions provide evidence. Admins see all three together.
### 9. Moderation, Reporting & Safety
#### 9.1 Listing Moderation
Three layers: prohibited-items policy, then automated moderation, then human review for flagged/uncertain cases only.
Prohibited items (v1 list): weapons/ammunition, drugs and drug paraphernalia, counterfeit goods, stolen goods, live animals, adult content, anything illegal to sell to a minor, academic dishonesty services (paid exam-writing, assignment mills). Alcohol, cigarettes, and prescription meds aren't banned outright in v1, but worth revisiting if they become a recurring issue.
#### 9.2 Reporting & Escalation
			Report type
			Available when
			Listing
			Anytime
			Seller
			Anytime
			Transaction/problem
			Only after an actual Purchase Request exists between the two parties
Escalation: 1st confirmed violation → warning. 2nd → listing removed + 7-day suspension. 3rd → permanent ban. Severe single incidents (fraud, weapons, harassment) skip straight to suspension pending review, ban if confirmed.
### 10. Notifications (v1 scope)
Verification approved/rejected · Listing approved/rejected/flagged + status changes · Purchase/deal confirmation prompts · Important account/security notices.
### 11. Admin Dashboard
Core areas: Users · Seller verification queue · Listings · Moderation queue · Reports · Categories/subcategories · Locations · Suspensions/bans · Transaction/dispute reports · Basic analytics · Admin settings.
Permissions: all 3 team members are Super Admin (full access) for v1. Split into Moderator/Verification Admin tiers only once the team grows beyond the founders.
### 12. Analytics (v1 scope)
Core counts (users, sellers, listings, completed sales) · funnel (views → searches → purchase requests → completions) · popular categories/products/locations.
### 13. Locations
Free-text input with autocomplete, prioritizing curated campus and nearby student-area locations, custom entry always allowed. Scope: campus + surrounding student areas.
### 14. Data Model
Core entities:
- University / Campus: one instance (UNIOSUN) at launch.
- User: id, role, email, password_hash, phone, display_name, email_verified_at, account_status, created_at
- SellerProfile: user_id, seller_type, seller_status, business_name?, business_category?, bio?, verified_at, verification_method
- VerificationRecord: user_id, method, result/confidence, reviewed_by_admin_id?, id_hash, created_at
- Category: id, parent_id (nullable), name, category_specific_fields (schema), is_active
- Location: id, name, type (campus/student_area/custom), is_curated, usage_count
- Listing: id, seller_id, category_id, title, description, price, is_negotiable, condition, location_id, quantity_available, quantity_reserved, photos[], status, created_at, updated_at
- ModerationRecord: listing_id, type, result, flags, reviewed_by?, created_at
- PurchaseRequest: id, listing_id, buyer_id, seller_id, requested_quantity, unit_price, offer_price?, status, created_at, expires_at (created_at + 24h, per 7.3)
- TransactionConfirmation: purchase_request_id, buyer_confirmed_qty?, seller_confirmed_qty?, buyer_confirmed_at?, seller_confirmed_at?, resolution
- Review: id, purchase_request_id, buyer_id, seller_id, rating, tags[], comment?, created_at (immutable)
- Report: id, type, target_id, reporter_id, reason, status, admin_notes, created_at
- Notification: id, user_id, type, payload, read_at, created_at
- SavedListing: user_id, listing_id, created_at
- AdminUser: user_id, admin_role
Key relationships: User 1-0/1 SellerProfile · User 1-* Listing (as seller) · User 1-* PurchaseRequest (as buyer) · Listing 1-* PurchaseRequest · PurchaseRequest 1-1 TransactionConfirmation · PurchaseRequest 1-0/1 Review · Category 1-* Category (self-referential) · Listing *-1 Category, *-1 Location.
No raw ID image is persisted anywhere in this model, only a verification record with a hash.
### 15. System Architecture
#### 15.1 Stack
			Layer
			Choice
			Web
			Next.js + TypeScript
			Mobile (Android + iOS)
			React Native + Expo + TypeScript, one codebase
			Backend
			Next.js + TypeScript API, structured as a proper service layer
			Database
			PostgreSQL
			Validation
			Zod, shared across web/mobile/API
			Data fetching/cache
			TanStack Query
			Object storage
			S3-compatible + CDN
			Monorepo
			Turborepo + pnpm
React Native + Expo means Android and iOS share one codebase and the team stays inside one ecosystem (React + TypeScript) instead of maintaining Kotlin, Swift, and a web stack with 3 people. Next.js is kept for web for SSR/image optimization/SEO on public listings. The backend is API-first and platform-agnostic: web, Android, and iOS all consume the same API.
#### 15.2 Backend Layering
```HTTP/API → Auth → Validation → Application Services
   (ListingService, SearchService, RankingService, VerificationService,
    PurchaseRequestService, ModerationService, NotificationService)
   → Repositories → PostgreSQL

```
#### 15.3 Monorepo Layout
```downtown/
├── apps/
│   ├── web/        (Next.js)
│   ├── mobile/     (React Native + Expo)
│   └── api/        (Next.js API / services)
├── packages/
│   ├── types/
│   ├── validation/ (Zod schemas)
│   ├── api-client/
│   ├── config/
│   └── utils/

```
Shared types and validation schemas in packages/ are consumed by web, mobile, and the API. This is where the real "don't rewrite for iOS/Android" payoff comes from, not from sharing UI components.
#### 15.4 Hosting & Deployment
			Piece
			Choice
			Why
			Web + API
			Vercel
			Native Next.js hosting, zero-config deploys, generous free tier, automatic preview deployment per pull request, which pairs naturally with a PR-review workflow
			Database
			Neon
			Serverless Postgres, generous free tier, database branching per PR/feature
			Object storage
			Cloudflare R2
			S3-compatible API, no egress fees, which matters once people are browsing lots of listing photos on a free-tier budget
			Mobile builds
			Expo EAS (Build + Submit + Update)
			Handles Android/iOS builds, app store submission, and OTA updates without needing native Xcode/Android Studio config most of the time
All four have free tiers that comfortably cover a pre-revenue campus MVP.
#### 15.5 "Snappy" Comes From Discipline, Not Framework Choice
Small JS bundles, optimistic UI where safe, proper caching, pagination, image resizing, lazy loading, skeleton states, minimal client-side rendering, fast/indexed queries, minimal network round-trips. A "beautiful" frontend making 12 API calls to render one listing will still feel bad on a Tecno Spark.
### 16. Non-Functional Requirements
- Performance: must feel good on low/mid-range Android devices. Server-side ranking, indexed queries, lazy/compressed images, pagination.
- Scalability: verification and moderation pipelines must handle real volume without requiring a human to manually review everything.
- Security: hashed passwords, rate limiting on auth and verification endpoints, duplicate-ID detection, least-privilege access to verification data and admin tools.
- Privacy: ID images are temporary and narrowly scoped (Section 4.3). Still needs a real privacy policy and, ideally, review against Nigerian data protection requirements (NDPR) before launch. This is a legal/policy step, not something a spec doc can resolve. A starter Privacy Policy and Terms of Service can be drafted as a companion document, but it still needs a human to review and sign off before it's real.
- Honesty about verification: never claim or imply official institutional verification anywhere in the UI or marketing.
- Inventory honesty: availability numbers are seller-declared and reconciled after the fact.
### 17. Team & Responsibilities
- Frontend (you): Next.js web UI, later React Native mobile UI. Shared TypeScript/React skillset makes this a natural single owner across both.
- Backend (teammate 2): Next.js API, service layer, database, auth, verification pipeline. Contingency: because the whole stack is TypeScript, the frontend owner can absorb backend work directly if needed, no language switch required to cover a gap.
- Product, PR, and quality (teammate 3): owns whether the product actually feels good end to end (UX quality bar, testing across real devices, catching rough edges before users do) plus outreach and growth, actually getting UNIOSUN students onto the platform at launch. Not primarily a code-writing role, though can pick up light tasks.
#### Development Workflow: Feature-by-Feature, Contract-First
Since it's just two engineers (frontend + backend) building feature-by-feature, the highest-leverage move is agreeing on the shared TypeScript type + Zod schema for a feature before either side builds it (in packages/types / packages/validation). Then:
1. Backend and frontend both build against that agreed contract, roughly in parallel.
2. Backend implements the real endpoint; frontend builds the UI against the typed contract, using mock data if the endpoint isn't ready yet.
3. Frontend swaps mock data for the real endpoint once it ships.
This avoids the two classic failure modes: frontend sitting idle waiting on backend, or backend guessing the wrong response shape and frontend having to rework everything. It's also exactly why the shared-types monorepo architecture was chosen: use it.
Suggested feature order (not "layers": each one is a vertical slice, fully working end to end before moving on):
1. Auth + accounts (signup, login, email verification). Everything else needs this.
2. Listings (create, browse, categories, search). The core value prop.
3. Purchase Request, WhatsApp handoff, and transaction confirmation. The actual marketplace loop.
4. Trust, moderation, and reporting. The safety layer.
5. Admin dashboard. Can lag slightly behind user-facing features; the three of you can act as manual admins via direct database access early on if needed.
6. Notifications, saved listings, polish.
#### Milestones to November 30, 2026 (about 16 weeks from Aug 9)
			Window
			Focus
			Weeks 1-3 (through ~Aug 30)
			Monorepo + shared types/validation packages, database schema, auth flow, deployment pipeline live from day one (even an empty "hello world" deployed to Vercel + Neon in week 1, not week 10)
			Weeks 4-7 (through ~Sep 27)
			Listings: create/edit, categories, photo upload, browse/search/filter, listing detail page, "Become a Seller" + student ID verification
			Weeks 8-11 (through ~Oct 25)
			The marketplace loop: Purchase Request, WhatsApp handoff, transaction confirmation, saved listings, seller profiles, basic notifications
			Weeks 12-14 (through ~Nov 15)
			Trust & safety: reviews, reporting, moderation queue, core admin dashboard
			Weeks 15-16 (through Nov 30)
			Hardening: bug bash, real low-end-Android device testing, performance pass, soft launch to a small group of real UNIOSUN students, fix what breaks
This is front-loaded on auth and listings, since nothing else works without them, and deliberately leaves the last two weeks as buffer rather than feature work. A hard date with a 3-person team building around other commitments will slip without one. Sanity-check this against how many actual hours per week the three of you realistically have before treating it as a plan.
### 18. Out of Scope for v1
In-app chat · platform-mediated payments + service fee · delivery/dispatch (esp. food vendors) · personalized recommendations · two-way ratings (sellers rating buyers) · multi-campus expansion · in-app offer/negotiation tracking beyond the WhatsApp handoff · push notification infra beyond Section 10 · advanced/ML fraud detection.
Each was designed around, not ignored. For example, the Purchase Request model exists specifically so payments can be added later without a rewrite.
### 19. Still Genuinely Open
Everything else in this document is decided. Two things remain:
1. Privacy Policy / NDPR review (Section 16): needs real legal/policy sign-off before launch, not just an engineering assumption. A starter Privacy Policy and Terms of Service can be drafted as a companion document, but it will still need a human to review and approve it.
2. Sub-category and per-category field detail (Section 5.3): top-level taxonomy is set; the fine-grained fields per category are an incremental spreadsheet exercise, not a launch blocker.

### 20. Design Reference.
https://www.campor.live/
https://github.com/Kuzma02/Electronics-eCommerce-Shop-With-Admin-Dashboard-NextJS-NodeJS

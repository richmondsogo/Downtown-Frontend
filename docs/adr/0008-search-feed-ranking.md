# ADR 0008: Search Architecture, Indexing Strategy, and Multi-Signal Ranking

## Status

Accepted

## Context

Downtown is a campus-specific student marketplace operating on Osun State University campuses with plans to expand across Nigerian higher institutions. Student discovery requires robust, typo-tolerant search and a multi-signal marketplace feed per GOAL.md 6.1–6.3.

Several key constraints and forces govern this implementation:
1. **Infrastructure & Cost Constraints**: The platform operates on a lean budget with Neon Serverless Postgres. Introducing dedicated external search engines (e.g., Elasticsearch, Algolia, Typesense Cloud, or AWS OpenSearch) introduces hosting costs, data synchronization pipelines, and failure modes that violate our simplicity principles.
2. **Campus Domain Quirks**: Students use informal abbreviations, slang, tech abbreviations ("840 G5", "fx-991EX"), and local terminology. English stemming in standard dictionaries (e.g. `'english'` text search configuration) aggressively stems or drops domain words. The `'simple'` configuration treats words as literal tokens without unwanted stemming.
3. **Connectivity Realities**: Many students browse on spotty 3G/4G cellular connections. Long feeds must paginate efficiently without duplicate items or skipped records, and responses must be lightweight with CDN edge caching (`s-maxage` with `stale-while-revalidate`).
4. **Ranking Order (GOAL.md 6.3)**:
   - Relevance (keyword match quality)
   - Availability (in-stock > reserved > sold)
   - Location relevance (same campus boost as a soft ranking signal, NEVER a hard exclusion filter; works seamlessly without a location)
   - Recency (newer items prioritized)
   - Seller trust & engagement signals (stubbed with weight 0 in V1)
5. **Privacy Safeguards**: Public search results and cards must NEVER disclose student IDs, email addresses, phone numbers, matriculation numbers, or database user IDs.

## Decision

We will implement search, feed, and ranking natively in PostgreSQL and the application service layer:

1. **Generated Stored `tsvector` with GIN Index & `websearch_to_tsquery` Safety**:
   - Add a generated column `search_vector` on `listings`:
     `setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B')`
   - Store as `GENERATED ALWAYS AS (...) STORED` to eliminate application trigger overhead.
   - Create a GIN index on `search_vector` (`listings_search_vector_idx`).
   - Use `'simple'` dictionary to preserve alphanumeric codes, technical model numbers, and campus terms without English stemmer distortion.
   - Query parsing uses `websearch_to_tsquery('simple', :query)` (parameterized) so that unescaped characters, boolean symbols (`& | ! : * ( )`), quotes, emoji, and RTL input cannot cause tsquery syntax errors. Rejects input > 80 characters at the schema validation boundary.

2. **Typo Tolerance with `pg_trgm`**:
   - Utilize existing `pg_trgm` extension on `title` (`gin_trgm_ops` index).
   - When exact tsquery matches yield low or zero results, evaluate trigram word similarity (`word_similarity(q, title) > 0.3`) as a typo-resilient fallback.

3. **Multi-Signal Global Ranker (`GlobalRanker`) & Eligibility Engine**:
   - Single canonical eligibility rule:
     - `published`: visible in feed, category browsing, and search.
     - `reserved`: visible in feed, category browsing, and search; ranked below `published`.
     - `sold`: discoverable **ONLY** when an explicit search keyword (`q`) is provided, ranked last; **excluded** when availability filter is `"available"` (`"in_stock"`). Category browsing and the unsearched home feed **NEVER** show sold listings.
     - `draft`, `pending_moderation`, `archived`: **NEVER** discoverable under any circumstance.
   - Ranker scoring:
     - Text relevance score: normalized `ts_rank_cd` combined with trigram similarity.
     - Availability score: `published` = 1.0, `reserved` = 0.5, `sold` = 0.0.
     - Campus boost: +0.25 bonus score when `listing.campus_id === viewer.campus_id` (soft signal, never a hard filtering wall).
     - Recency score: time-decayed value computed from `created_at`.
     - Seller trust & engagement: weight 0.0 in initial V1 config.

4. **Keyset Pagination Without `COUNT(*)`**:
   - Cursor-based pagination using a deterministic tiebreaker tuple `(sort_score/sort_value, id)`.
   - Never executes `COUNT(*)` on full catalog searches to avoid Neon database scan overhead.
   - Fetches `limit + 1` rows to determine `hasNextPage` and compute `nextCursor`.
   - Guaranteed stability: walking all pages produces no duplicates and no skipped items even under tied sort values.

5. **Suggestions Service (`GET /api/search/suggest`)**:
   - Fast title prefix suggestion endpoint, payload limit 6 items, < 2 KB response.
   - Client contract: requires minimum 2 characters, 250 ms debounce, `AbortController` cancellation for in-flight requests, in-memory client prefix cache, and no request fired on page load.

6. **Edge Caching & Stale Window**:
   - Public GET `/api/listings` and `/api/search/suggest` return:
     `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`
   - **Documented Stale Window**: Listings cached at the edge have a freshness window of up to 60 seconds and a stale-while-revalidate window of up to 120 seconds. An item marked as sold, moderated, or archived may continue appearing to public browsers for at most ~1–2 minutes before the edge revalidates. This trade-off drastically reduces database load on Neon during traffic spikes while ensuring near real-time catalog consistency.

7. **Contract-First Public Boundary (`PublicListingCard`)**:
   - Strip all sensitive seller metadata at the API boundary (email, phone, matric number, user ID).
   - Compute privacy-safe `displayName`: individual sellers show first name + last initial (e.g. "Richmond O."), single-word names supported, unicode-safe and trimmed. Verified business vendors display their business name.

8. **Realistic WebP Seed Placeholders & Deletion Protection**:
   - Curate <= 5 real WebP files in `apps/web/public/placeholders/` sized matching production variants:
     - Thumbnail variant: ~20 KB at 400px.
     - Display variant: ~140 KB at 1000px.
   - Explicitly avoids SVG so Lighthouse audit metrics and network transfer numbers reflect authentic production performance.
   - Mark seed photos (`isSeed: true`) in database schema so that storage deletion routines (`deletePhoto`, `sweepOrphanPhotos`) never attempt to call Vercel Blob deletion for static placeholder assets.

9. **Server-Side Rendered (SSR) Feed Page**:
   - Home page (`/`) fetches the initial feed page in a single API request, eliminating client waterfall latency on first paint.
   - Feed cards: First 2–4 cards render eager with `fetchpriority="high"`, subsequent cards render lazy with explicit dimensions / `aspect-ratio` to guarantee <= 0.1 CLS.

## Alternatives Considered

1. **Algolia / Typesense Cloud / Bonsai Elasticsearch**:
   - *Rejected*: Adds recurring SaaS bills ($20–$100+/month), requires webhook/CDC sync queues, and adds third-party downtime risk.
2. **Application Memory In-Memory Search**:
   - *Rejected*: Fetching all listings into Node.js process memory to rank with Fuse.js does not scale beyond a few dozen items and exhausts memory on constrained serverless execution environments.
3. **Raw `ILIKE '%query%'` Queries**:
   - *Rejected*: Bypasses indexes, forces sequential full table scans, lacks scoring/relevance capabilities, and performs poorly on multi-thousand listing catalogs.

## Trade-offs

- **Storage Overhead**: The generated `tsvector` column and GIN index consume ~15–20% additional disk storage per listing row. On Neon PostgreSQL, this is well within acceptable limits.
- **Complex SQL Construction**: Calculating composite rank expressions dynamically in SQL requires parameterization and careful index utilization. We mitigate this through Drizzle SQL templates and automated `EXPLAIN` query verification tests.
- **Eventual Consistency on Edge**: Up to 60–120 seconds delay for listing status updates on cached public views, accepted for bandwidth and database cost control.

## Consequences

1. Zero external infrastructure dependencies; database migrations define the search engine entirely.
2. Fast title prefix suggestions (`GET /api/search/suggest`) powered by trigram index with tiny JSON payloads (< 2 KB).
3. Secure, injection-immune full-text search immune to syntax crashing via `websearch_to_tsquery`.
4. High performance discovery meeting <= 150 KB JS and <= 3s LCP budgets under Slow 4G + 4x CPU throttle.

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

1. **Generated Stored `tsvector` with GIN Index**:
   - Add a generated column `search_vector` on `listings`:
     `setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B')`
   - Store as `GENERATED ALWAYS AS (...) STORED` to eliminate application trigger overhead.
   - Create a GIN index on `search_vector` (`listings_search_vector_idx`).
   - Use `'simple'` dictionary to preserve alphanumeric codes, technical model numbers, and campus terms without English stemmer distortion.

2. **Typo Tolerance with `pg_trgm`**:
   - Utilize existing `pg_trgm` extension on `title` (`gin_trgm_ops` index).
   - When exact tsquery matches yield low or zero results, evaluate trigram word similarity (`word_similarity(q, title) > 0.3`) as a typo-resilient fallback.

3. **Multi-Signal Global Ranker (`GlobalRanker`)**:
   - Implement `RankingService` behind an interface with configurable weights in `@downtown/config`:
     - Text relevance score: normalized `ts_rank_cd` (weights `{0.1, 0.2, 0.4, 1.0}`) combined with trigram similarity.
     - Availability score: `published` = 1.0, `reserved` = 0.5, `sold` = 0.0 (sold listings rank last and are discoverable ONLY via explicit search query, never appearing on the unsearched home feed).
     - Campus boost: +0.25 bonus score when `listing.campus_id === viewer.campus_id`. Location acts strictly as a ranking signal, never a hard filtering wall.
     - Recency score: time-decayed value computed from `created_at`.
     - Seller trust & engagement: weight 0.0 in initial V1 config.

4. **Keyset Pagination**:
   - Cursor-based pagination using a deterministic tiebreaker tuple `(rank_score/sort_value, id)`.
   - Guaranteed stability: walking all pages produces no duplicates and no skipped items even under tied sort values.

5. **Contract-First Public Boundary (`PublicListingCard`)**:
   - Strip all sensitive seller metadata at the API boundary.
   - Compute privacy-safe `displayName`: individual sellers show first name + last initial (e.g. "Richmond O."), single-word names supported, unicode-safe and trimmed. Verified business vendors display their business name.

6. **Edge Caching**:
   - Public GET `/api/listings` and `/api/search/suggest` return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Responses contain no personalized data.

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

## Consequences

1. Zero external infrastructure dependencies; database migrations define the search engine entirely.
2. Fast title prefix suggestions (`GET /api/search/suggest`) powered by trigram index with tiny JSON payloads (< 2 KB).
3. The platform can scale seamlessly to tens of thousands of campus listings before needing dedicated search infrastructure.

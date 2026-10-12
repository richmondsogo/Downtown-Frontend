CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("description", '')), 'B')) STORED;

CREATE INDEX IF NOT EXISTS "listings_search_vector_idx" ON "listings" USING gin ("search_vector");

CREATE INDEX IF NOT EXISTS "listings_title_trgm_idx" ON "listings" USING gin ("title" gin_trgm_ops);

ALTER TABLE "listing_photos" ADD COLUMN IF NOT EXISTS "is_seed" boolean DEFAULT false NOT NULL;

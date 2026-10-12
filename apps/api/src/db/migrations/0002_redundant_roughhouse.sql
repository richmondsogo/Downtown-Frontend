CREATE TABLE "app_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"last_request" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "app_rate_limit_key_idx" ON "app_rate_limit" USING btree ("key");
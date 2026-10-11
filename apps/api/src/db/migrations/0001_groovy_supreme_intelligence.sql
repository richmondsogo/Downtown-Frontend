CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "campus" (
	"id" text PRIMARY KEY NOT NULL,
	"university_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_slug_unique" UNIQUE("slug"),
	CONSTRAINT "campus_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_name_unique" UNIQUE("name"),
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text DEFAULT 'campus' NOT NULL,
	"is_curated" boolean DEFAULT false NOT NULL,
	"creator_id" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_type_check" CHECK ("location"."type" IN ('campus', 'student_area', 'custom'))
);
--> statement-breakpoint
CREATE TABLE "university" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "university_slug_unique" UNIQUE("slug"),
	CONSTRAINT "university_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
ALTER TABLE "campus" ADD CONSTRAINT "campus_university_id_university_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."university"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_campus_idx" ON "location" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "location_curated_idx" ON "location" USING btree ("is_curated");--> statement-breakpoint
CREATE INDEX "location_creator_idx" ON "location" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "location_campus_curated_idx" ON "location" USING btree ("campus_id","is_curated");--> statement-breakpoint
CREATE INDEX "location_name_lower_idx" ON "location" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "location_name_trgm_idx" ON "location" USING gin ("name" gin_trgm_ops);
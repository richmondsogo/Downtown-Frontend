CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"is_negotiable" boolean DEFAULT false NOT NULL,
	"category_id" text NOT NULL,
	"condition" text,
	"location_id" text NOT NULL,
	"quantity_available" integer DEFAULT 1 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_status_check" CHECK ("listings"."status" IN ('draft', 'pending_moderation', 'published', 'reserved', 'sold', 'archived')),
	CONSTRAINT "listing_condition_check" CHECK ("listings"."condition" IS NULL OR "listings"."condition" IN ('new', 'like_new', 'good', 'fair')),
	CONSTRAINT "listing_price_check" CHECK ("listings"."price" >= 1),
	CONSTRAINT "listing_quantity_check" CHECK ("listings"."quantity_available" >= 1 AND "listings"."quantity_reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"listing_id" text,
	"key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photos_key_unique" UNIQUE("key"),
	CONSTRAINT "listing_photos_thumb_key_unique" UNIQUE("thumb_key")
);
--> statement-breakpoint
CREATE TABLE "moderation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"type" text DEFAULT 'keyword_scan' NOT NULL,
	"result" text NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_record_result_check" CHECK ("moderation_records"."result" IN ('clean', 'flagged'))
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_seller_status_idx" ON "listings" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "listing_status_created_at_idx" ON "listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "listing_category_idx" ON "listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "listing_location_idx" ON "listings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "listing_photo_listing_pos_idx" ON "listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_photo_owner_unattached_idx" ON "listing_photos" USING btree ("owner_id","listing_id");--> statement-breakpoint
CREATE INDEX "moderation_record_listing_idx" ON "moderation_records" USING btree ("listing_id");
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"requested_quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"offer_price" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"cancelled_by" text,
	"reservation_expires_at" timestamp with time zone NOT NULL,
	"resolution_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_request_status_check" CHECK ("purchase_requests"."status" IN ('pending', 'completed', 'disputed', 'expired', 'cancelled')),
	CONSTRAINT "purchase_request_cancelled_by_check" CHECK ("purchase_requests"."cancelled_by" IS NULL OR "purchase_requests"."cancelled_by" IN ('buyer', 'seller', 'system')),
	CONSTRAINT "purchase_request_quantity_check" CHECK ("purchase_requests"."requested_quantity" >= 1),
	CONSTRAINT "purchase_request_offer_check" CHECK ("purchase_requests"."offer_price" IS NULL OR "purchase_requests"."offer_price" >= 1)
);
--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listing_quantity_check";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_request_buyer_listing_pending_idx" ON "purchase_requests" USING btree ("buyer_id","listing_id") WHERE "purchase_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "purchase_request_listing_status_idx" ON "purchase_requests" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "purchase_request_buyer_status_idx" ON "purchase_requests" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "purchase_request_seller_status_idx" ON "purchase_requests" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "purchase_request_expires_idx" ON "purchase_requests" USING btree ("status","reservation_expires_at");--> statement-breakpoint
CREATE INDEX "purchase_request_deadline_idx" ON "purchase_requests" USING btree ("status","resolution_deadline");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listing_quantity_check" CHECK ("listings"."quantity_available" >= 1 AND "listings"."quantity_reserved" >= 0 AND "listings"."quantity_reserved" <= "listings"."quantity_available");
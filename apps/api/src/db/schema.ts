import { pgTable, text, timestamp, boolean, integer, bigint, check, index, customType, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    role: text("role").notNull().default("student"),
    matricNumber: text("matric_number"),
    phone: text("phone"),
    sellerStatus: text("seller_status").notNull().default("not_a_seller"),
    accountStatus: text("account_status").notNull().default("active"),
  },
  (table) => [
    check("user_role_check", sql`${table.role} IN ('student', 'staff', 'vendor')`),
  ]
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const appRateLimit = pgTable(
  "app_rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    count: integer("count").notNull().default(1),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("app_rate_limit_key_idx").on(table.key),
  ]
);

export const university = pgTable("university", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortCode: text("short_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campus = pgTable("campus", {
  id: text("id").primaryKey(),
  universityId: text("university_id")
    .notNull()
    .references(() => university.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull().unique(),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const category = pgTable("category", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const location = pgTable(
  "location",
  {
    id: text("id").primaryKey(),
    campusId: text("campus_id")
      .notNull()
      .references(() => campus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: text("type").notNull().default("campus"),
    isCurated: boolean("is_curated").notNull().default(false),
    creatorId: text("creator_id").references(() => user.id, { onDelete: "set null" }),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("location_type_check", sql`${table.type} IN ('campus', 'student_area', 'custom')`),
    index("location_campus_idx").on(table.campusId),
    index("location_curated_idx").on(table.isCurated),
    index("location_creator_idx").on(table.creatorId),
    index("location_campus_curated_idx").on(table.campusId, table.isCurated),
    index("location_name_lower_idx").on(sql`lower(${table.name})`),
    index("location_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
  ]
);

export const listing = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(),
    isNegotiable: boolean("is_negotiable").notNull().default(false),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    condition: text("condition"),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    quantityAvailable: integer("quantity_available").notNull().default(1),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    status: text("status").notNull().default("draft"),
    searchVector: tsvector("search_vector"),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("listing_status_check", sql`${table.status} IN ('draft', 'pending_moderation', 'published', 'reserved', 'sold', 'archived')`),
    check("listing_condition_check", sql`${table.condition} IS NULL OR ${table.condition} IN ('new', 'like_new', 'good', 'fair')`),
    check("listing_price_check", sql`${table.price} >= 1`),
    check("listing_quantity_check", sql`${table.quantityAvailable} >= 1 AND ${table.quantityReserved} >= 0 AND ${table.quantityReserved} <= ${table.quantityAvailable}`),
    index("listing_seller_status_idx").on(table.sellerId, table.status),
    index("listing_status_created_at_idx").on(table.status, table.createdAt),
    index("listing_category_idx").on(table.categoryId),
    index("listing_location_idx").on(table.locationId),
    index("listings_search_vector_idx").using("gin", table.searchVector),
    index("listings_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
  ]
);
export const listings = listing;

export const listingPhoto = pgTable(
  "listing_photos",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id").references(() => listing.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    thumbKey: text("thumb_key").notNull().unique(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull().default(0),
    isSeed: boolean("is_seed").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listing_photo_listing_pos_idx").on(table.listingId, table.position),
    index("listing_photo_owner_unattached_idx").on(table.ownerId, table.listingId),
  ]
);
export const listingPhotos = listingPhoto;

export const moderationRecord = pgTable(
  "moderation_records",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("keyword_scan"),
    result: text("result").notNull(),
    flags: text("flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("moderation_record_result_check", sql`${table.result} IN ('clean', 'flagged')`),
    index("moderation_record_listing_idx").on(table.listingId),
  ]
);
export const moderationRecords = moderationRecord;

export const savedListing = pgTable(
  "saved_listings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.listingId] }),
    index("saved_listings_user_created_idx").on(table.userId, table.createdAt),
    index("saved_listings_listing_idx").on(table.listingId),
  ]
);
export const savedListings = savedListing;

export const purchaseRequest = pgTable(
  "purchase_requests",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedQuantity: integer("requested_quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    offerPrice: integer("offer_price"),
    status: text("status").notNull().default("pending"),
    cancelledBy: text("cancelled_by"),
    reservationExpiresAt: timestamp("reservation_expires_at", { withTimezone: true }).notNull(),
    resolutionDeadline: timestamp("resolution_deadline", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("purchase_request_status_check", sql`${table.status} IN ('pending', 'completed', 'disputed', 'expired', 'cancelled')`),
    check("purchase_request_cancelled_by_check", sql`${table.cancelledBy} IS NULL OR ${table.cancelledBy} IN ('buyer', 'seller', 'system')`),
    check("purchase_request_quantity_check", sql`${table.requestedQuantity} >= 1`),
    check("purchase_request_offer_check", sql`${table.offerPrice} IS NULL OR ${table.offerPrice} >= 1`),
    uniqueIndex("purchase_request_buyer_listing_pending_idx")
      .on(table.buyerId, table.listingId)
      .where(sql`${table.status} = 'pending'`),
    index("purchase_request_listing_status_idx").on(table.listingId, table.status),
    index("purchase_request_buyer_status_idx").on(table.buyerId, table.status),
    index("purchase_request_seller_status_idx").on(table.sellerId, table.status),
    index("purchase_request_expires_idx").on(table.status, table.reservationExpiresAt),
    index("purchase_request_deadline_idx").on(table.status, table.resolutionDeadline),
  ]
);
export const purchaseRequests = purchaseRequest;

export const notification = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload").notNull().default("{}"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_unread_idx").on(table.userId, table.readAt),
    index("notification_user_created_idx").on(table.userId, table.createdAt),
  ]
);
export const notifications = notification;




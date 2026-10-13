import { db } from "../db/index";
import { listing, listingPhoto, location, campus, category, user } from "../db/schema";
import {
  SearchQueryInput,
  isListingDiscoverable,
} from "@downtown/validation";
import {
  PublicListingCard,
  SearchResultPage,
  ListingCondition,
} from "@downtown/types";
import { formatDisplayName } from "@downtown/utils";
import { getStorageService } from "./storage.service";
import {
  buildRankScoreSql,
  decodeCursor,
  encodeCursor,
} from "./ranking.service";
import { sql, eq, and, or, inArray, gte, lte, desc, asc, SQL } from "drizzle-orm";

export class SearchService {
  /**
   * Search and discovery feed query runner.
   * Employs websearch_to_tsquery, multi-signal rank scoring, keyset pagination without COUNT(*),
   * and strict privacy boundary mapping.
   */
  async search(
    query: SearchQueryInput,
    viewerCampusId?: string
  ): Promise<SearchResultPage> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 30);
    const isSearchQuery = Boolean(query.q && query.q.trim().length > 0);
    const cleanQ = isSearchQuery ? query.q!.trim() : undefined;
    const availabilityFilter = query.availability ?? "all";

    const conditions: SQL[] = [];

    // 1. Centralized Lifecycle Eligibility (ADR 0008 & Step 05 Amendment e)
    // Draft, pending_moderation, and archived are NEVER discoverable.
    const liveReservedExpr = sql<number>`COALESCE((
      SELECT SUM(pr.requested_quantity)
      FROM purchase_requests pr
      WHERE pr.listing_id = ${listing.id}
        AND pr.status = 'pending'
        AND pr.reservation_expires_at > now()
    ), 0)`;

    if (availabilityFilter === "in_stock") {
      conditions.push(inArray(listing.status, ["published", "reserved"]));
      conditions.push(sql`(${listing.quantityAvailable} - ${liveReservedExpr}) > 0`);
    } else if (!isSearchQuery) {
      conditions.push(inArray(listing.status, ["published", "reserved"]));
    } else {
      // Search query present and availability != in_stock -> show published, reserved, and sold (sold ranked last)
      conditions.push(inArray(listing.status, ["published", "reserved", "sold"]));
    }

    // 2. Full-Text Search and Trigram Typo-Tolerance (ADR 0008 & Amendment f)
    if (cleanQ) {
      // websearch_to_tsquery ensures user input cannot cause tsquery syntax errors
      const ftsCondition = sql`(${listing.searchVector} @@ websearch_to_tsquery('simple', ${cleanQ}) OR word_similarity(${cleanQ}, ${listing.title}) > 0.4)`;
      conditions.push(ftsCondition);
    }

    // 3. Category Filter
    if (query.categoryId) {
      conditions.push(eq(listing.categoryId, query.categoryId));
    }

    // 4. Price Bounds Filters
    if (query.minPrice !== undefined) {
      conditions.push(gte(listing.price, query.minPrice));
    }
    if (query.maxPrice !== undefined) {
      conditions.push(lte(listing.price, query.maxPrice));
    }

    // 5. Condition Filter
    if (query.condition && query.condition.length > 0) {
      conditions.push(inArray(listing.condition, query.condition));
    }

    // 6. Location & Campus Filters
    if (query.locationId) {
      conditions.push(eq(listing.locationId, query.locationId));
    }
    if (query.campusId) {
      conditions.push(eq(location.campusId, query.campusId));
    }

    // 7. Verified Seller Only Filter
    if (query.verifiedOnly) {
      conditions.push(eq(user.sellerStatus, "verified"));
    }

    // 8. Keyset Cursor Decoding & Pagination WHERE Clause (Amendment g)
    const cursor = decodeCursor(query.cursor);
    const sort = query.sort ?? "relevance";
    const rankScoreExpr = buildRankScoreSql(cleanQ, viewerCampusId);

    if (cursor) {
      if (sort === "relevance") {
        const cursorVal = Number(cursor.v);
        conditions.push(
          sql`(${rankScoreExpr} < ${cursorVal} OR (${rankScoreExpr} = ${cursorVal} AND ${listing.id} < ${cursor.id}))`
        );
      } else if (sort === "newest") {
        const cursorTime = new Date(Number(cursor.v));
        conditions.push(
          sql`(${listing.createdAt} < ${cursorTime} OR (${listing.createdAt} = ${cursorTime} AND ${listing.id} < ${cursor.id}))`
        );
      } else if (sort === "price_asc") {
        const cursorPrice = Number(cursor.v);
        conditions.push(
          sql`(${listing.price} > ${cursorPrice} OR (${listing.price} = ${cursorPrice} AND ${listing.id} > ${cursor.id}))`
        );
      } else if (sort === "price_desc") {
        const cursorPrice = Number(cursor.v);
        conditions.push(
          sql`(${listing.price} < ${cursorPrice} OR (${listing.price} = ${cursorPrice} AND ${listing.id} < ${cursor.id}))`
        );
      }
    }

    // 9. Execute Query with LIMIT + 1 to detect hasMore without COUNT(*)
    let orderByClauses: SQL[];
    if (sort === "relevance") {
      orderByClauses = [desc(rankScoreExpr), desc(listing.id)];
    } else if (sort === "newest") {
      orderByClauses = [desc(listing.createdAt), desc(listing.id)];
    } else if (sort === "price_asc") {
      orderByClauses = [asc(listing.price), asc(listing.id)];
    } else {
      orderByClauses = [desc(listing.price), desc(listing.id)];
    }

    const rows = await db
      .select({
        listing,
        locationName: location.name,
        campusName: campus.name,
        campusSlug: campus.slug,
        sellerName: user.name,
        sellerStatus: user.sellerStatus,
        rankScore: rankScoreExpr,
        effectiveReserved: sql<number>`COALESCE((
          SELECT SUM(pr.requested_quantity)
          FROM purchase_requests pr
          WHERE pr.listing_id = ${listing.id}
            AND pr.status = 'pending'
            AND pr.reservation_expires_at > now()
        ), 0)`,
      })
      .from(listing)
      .leftJoin(location, eq(listing.locationId, location.id))
      .leftJoin(campus, eq(location.campusId, campus.id))
      .leftJoin(user, eq(listing.sellerId, user.id))
      .where(and(...conditions))
      .orderBy(...orderByClauses)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    if (pageRows.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    // 10. Fetch Cover Photos for Page Listings (first photo by position)
    const listingIds = pageRows.map((r) => r.listing.id);
    const photos = await db
      .select()
      .from(listingPhoto)
      .where(inArray(listingPhoto.listingId, listingIds))
      .orderBy(asc(listingPhoto.position));

    const photosByListing = new Map<string, typeof listingPhoto.$inferSelect>();
    for (const p of photos) {
      if (p.listingId && !photosByListing.has(p.listingId)) {
        photosByListing.set(p.listingId, p);
      }
    }

    const storage = getStorageService();

    // 11. Strict Privacy Mapping (Zero PII Exposed)
    const items: PublicListingCard[] = pageRows.map((r) => {
      const cover = photosByListing.get(r.listing.id);
      let thumb = null;
      if (cover) {
        let thumbUrl = cover.thumbKey;
        if (cover.isSeed && thumbUrl.includes("?")) {
          thumbUrl = thumbUrl.split("?")[0];
        }
        if (!thumbUrl.startsWith("http://") && !thumbUrl.startsWith("https://") && !thumbUrl.startsWith("/")) {
          thumbUrl = storage.getPublicUrl(cover.thumbKey);
        }
        thumb = {
          url: thumbUrl,
          width: cover.width,
          height: cover.height,
        };
      }

      const unreserved = Math.max(0, r.listing.quantityAvailable - Number(r.effectiveReserved || 0));
      let availability: "available" | "reserved" | "sold" = "available";
      if (r.listing.status === "sold") availability = "sold";
      else if (unreserved <= 0) availability = "reserved";

      return {
        id: r.listing.id,
        title: r.listing.title,
        price: r.listing.price,
        isNegotiable: r.listing.isNegotiable,
        condition: (r.listing.condition as ListingCondition) || null,
        thumb,
        locationName: r.locationName || "Main Campus",
        campusName: r.campusName || "UNIOSUN",
        campusSlug: r.campusSlug || "osogbo",
        seller: {
          displayName: formatDisplayName(r.sellerName || "Verified Seller"),
          isVerified: r.sellerStatus === "verified",
        },
        availability,
        status: r.listing.status as any,
        createdAt: r.listing.createdAt.toISOString(),
      };
    });

    // 12. Build Keyset Next Cursor
    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const lastRow = pageRows[pageRows.length - 1];
      let sortVal: number | string;
      if (sort === "relevance") {
        sortVal = Number(lastRow.rankScore);
      } else if (sort === "newest") {
        sortVal = lastRow.listing.createdAt.getTime();
      } else {
        sortVal = lastRow.listing.price;
      }
      nextCursor = encodeCursor(sortVal, lastRow.listing.id);
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Title prefix suggestions endpoint (Amendment c).
   * - Enforces minimum 2 characters.
   * - Limit 6 results.
   * - Searches only published listings.
   */
  async suggest(q: string): Promise<string[]> {
    const cleanQ = q.trim();
    if (cleanQ.length < 2) return [];

    const rows = await db
      .selectDistinct({ title: listing.title })
      .from(listing)
      .where(
        and(
          eq(listing.status, "published"),
          or(
            sql`lower(${listing.title}) LIKE lower(${cleanQ}) || '%'`,
            sql`word_similarity(${cleanQ}, ${listing.title}) > 0.4`
          )
        )
      )
      .orderBy(asc(listing.title))
      .limit(6);

    return rows.map((r) => r.title);
  }
}

export const searchService = new SearchService();

import { db } from "../db/index";
import {
  listing,
  listingPhoto,
  location,
  campus,
  category,
  user,
  savedListing,
} from "../db/schema";
import { eq, and, desc, inArray, asc } from "drizzle-orm";
import { formatDisplayName } from "@downtown/utils";
import { NotFoundError } from "./listing.service";
import { getStorageService } from "./storage.service";
import type { SavedListingItem, ListingStatus } from "@downtown/types";

export class SavedService {
  /**
   * Toggles the saved status of a listing for an authenticated user:
   * - If already saved, removes the save and returns { saved: false }.
   * - If not saved, inserts a new saved_listings row and returns { saved: true }.
   */
  async toggleSave(userId: string, listingId: string): Promise<{ saved: boolean }> {
    const [existing] = await db
      .select({ id: listing.id })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Listing not found.");
    }

    const [saved] = await db
      .select()
      .from(savedListing)
      .where(and(eq(savedListing.userId, userId), eq(savedListing.listingId, listingId)))
      .limit(1);

    if (saved) {
      await db
        .delete(savedListing)
        .where(and(eq(savedListing.userId, userId), eq(savedListing.listingId, listingId)));
      return { saved: false };
    } else {
      await db.insert(savedListing).values({
        userId,
        listingId,
      });
      return { saved: true };
    }
  }

  /**
   * Checks whether a listing is saved by a specific user.
   */
  async isListingSaved(userId: string, listingId: string): Promise<boolean> {
    const [saved] = await db
      .select()
      .from(savedListing)
      .where(and(eq(savedListing.userId, userId), eq(savedListing.listingId, listingId)))
      .limit(1);
    return Boolean(saved);
  }

  /**
   * Returns all saved listings for an authenticated user, ordered by saved date descending.
   * Preserves sold status: sold listings are returned so the client can display them greyed out.
   */
  async getSavedListings(userId: string): Promise<SavedListingItem[]> {
    const rows = await db
      .select({
        savedListing,
        listing,
        category,
        location,
        campus,
        user,
      })
      .from(savedListing)
      .innerJoin(listing, eq(savedListing.listingId, listing.id))
      .leftJoin(category, eq(listing.categoryId, category.id))
      .leftJoin(location, eq(listing.locationId, location.id))
      .leftJoin(campus, eq(location.campusId, campus.id))
      .leftJoin(user, eq(listing.sellerId, user.id))
      .where(eq(savedListing.userId, userId))
      .orderBy(desc(savedListing.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const listingIds = rows.map((r) => r.listing.id);
    const photos = await db
      .select()
      .from(listingPhoto)
      .where(inArray(listingPhoto.listingId, listingIds))
      .orderBy(asc(listingPhoto.position));

    const photoMap = new Map<string, typeof listingPhoto.$inferSelect>();
    for (const p of photos) {
      if (p.listingId && !photoMap.has(p.listingId)) {
        photoMap.set(p.listingId, p);
      }
    }

    const storage = getStorageService();

    return rows.map((r) => {
      const p = photoMap.get(r.listing.id);
      let thumb = null;
      if (p) {
        const thumbUrl = p.thumbKey.startsWith("http")
          ? p.thumbKey.split("?")[0]
          : storage.getPublicUrl(p.thumbKey).split("?")[0];
        thumb = {
          url: thumbUrl,
          width: p.width,
          height: p.height,
        };
      }

      const availability =
        r.listing.status === "sold"
          ? "sold"
          : r.listing.status === "reserved"
          ? "reserved"
          : "available";

      return {
        listing: {
          id: r.listing.id,
          title: r.listing.title,
          price: r.listing.price,
          isNegotiable: r.listing.isNegotiable,
          condition: (r.listing.condition as any) || null,
          thumb,
          locationName: r.location?.name || "Campus",
          campusName: r.campus?.name || "UNIOSUN",
          campusSlug: r.campus?.slug || "uniosun",
          seller: {
            displayName: formatDisplayName(r.user?.name || "Seller"),
            isVerified: r.user?.sellerStatus === "verified",
          },
          availability,
          status: r.listing.status as ListingStatus,
          createdAt: r.listing.createdAt.toISOString(),
        },
        savedAt: r.savedListing.createdAt.toISOString(),
      };
    });
  }
}

export const savedService = new SavedService();

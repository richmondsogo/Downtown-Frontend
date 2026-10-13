import { db } from "../db/index";
import {
  listing,
  listingPhoto,
  moderationRecord,
  category,
  location,
  campus,
  user,
  savedListing,
  purchaseRequest,
  notification,
} from "../db/schema";
import { eq, and, isNull, desc, inArray, asc, sql, lt, count } from "drizzle-orm";
import {
  DraftListingInput,
  SubmitListingInput,
  UpdateListingInput,
  SubmitListingSchema,
  isAllowedListingTransition,
  isHighRiskListingEdit,
  getCategoryConditionRequirement,
  ListingStatus,
} from "@downtown/validation";
import { defaultModerationService } from "./moderation.service";
import { getStorageService } from "./storage.service";
import { processListingPhoto } from "./image.service";
import { checkRateLimit } from "./rate-limit.service";
import { formatDisplayName, formatMemberSince } from "@downtown/utils";
import type { Listing, ListingPhoto, PublicListingDetail, PublicListingPhoto } from "@downtown/types";
import crypto from "crypto";

export const DEFAULT_STORAGE_SOFT_CAP_BYTES = 800 * 1024 * 1024; // 800 MB

export function getStorageSoftCapBytes(): number {
  if (process.env.STORAGE_SOFT_CAP_BYTES) {
    const parsed = parseInt(process.env.STORAGE_SOFT_CAP_BYTES, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_STORAGE_SOFT_CAP_BYTES;
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to access or modify this resource") {
    super(403, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

export class QuotaExceededError extends ApiError {
  constructor(message = "Quota exceeded") {
    super(429, message);
  }
}

function mapPhoto(photoRow: typeof listingPhoto.$inferSelect): ListingPhoto {
  const storage = getStorageService();
  return {
    id: photoRow.id,
    ownerId: photoRow.ownerId,
    listingId: photoRow.listingId,
    key: photoRow.key,
    thumbKey: photoRow.thumbKey,
    url: storage.getPublicUrl(photoRow.key),
    thumbUrl: storage.getPublicUrl(photoRow.thumbKey),
    width: photoRow.width,
    height: photoRow.height,
    bytes: photoRow.bytes,
    position: photoRow.position,
    createdAt: photoRow.createdAt,
  };
}

export class ListingService {
  /**
   * Validates category is active.
   */
  private async validateCategory(categoryId: string) {
    const [cat] = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);

    if (!cat) {
      throw new BadRequestError(`Category not found.`);
    }
    if (!cat.isActive) {
      throw new BadRequestError(`Category '${cat.name}' is currently inactive.`);
    }
    return cat;
  }

  /**
   * Validates location is either curated or created by the seller.
   */
  private async validateLocation(locationId: string, sellerId: string) {
    const [loc] = await db
      .select()
      .from(location)
      .where(eq(location.id, locationId))
      .limit(1);

    if (!loc) {
      throw new BadRequestError(`Location not found.`);
    }
    if (!loc.isCurated && loc.creatorId !== sellerId) {
      throw new BadRequestError(
        `Selected custom location does not belong to you.`
      );
    }
    return loc;
  }

  /**
   * Validates photo ownership and attaches photos to the listing in order.
   */
  private async attachPhotos(
    listingId: string,
    sellerId: string,
    photoIds: string[]
  ): Promise<void> {
    if (photoIds.length > 5) {
      throw new BadRequestError("A listing may have at most 5 photos.");
    }

    if (photoIds.length === 0) {
      // Detach any previously attached photos
      await db
        .update(listingPhoto)
        .set({ listingId: null, position: 0 })
        .where(eq(listingPhoto.listingId, listingId));
      return;
    }

    // Fetch photos
    const photos = await db
      .select()
      .from(listingPhoto)
      .where(inArray(listingPhoto.id, photoIds));

    // Verify all photos exist and belong to the seller
    if (photos.length !== photoIds.length) {
      throw new BadRequestError("One or more photo IDs could not be found.");
    }
    for (const p of photos) {
      if (p.ownerId !== sellerId) {
        throw new ForbiddenError("Cannot attach photos owned by another user.");
      }
    }

    // Detach old photos that are no longer in photoIds
    const existing = await db
      .select({ id: listingPhoto.id })
      .from(listingPhoto)
      .where(eq(listingPhoto.listingId, listingId));

    const toDetach = existing
      .filter((e) => !photoIds.includes(e.id))
      .map((e) => e.id);

    if (toDetach.length > 0) {
      await db
        .update(listingPhoto)
        .set({ listingId: null, position: 0 })
        .where(inArray(listingPhoto.id, toDetach));
    }

    // Update positions and link to listing
    for (let i = 0; i < photoIds.length; i++) {
      const pId = photoIds[i];
      await db
        .update(listingPhoto)
        .set({ listingId, position: i })
        .where(eq(listingPhoto.id, pId));
    }
  }

  /**
   * Creates or saves a draft listing.
   */
  async createDraft(sellerId: string, input: DraftListingInput): Promise<Listing> {
    if (input.categoryId) {
      await this.validateCategory(input.categoryId);
    }
    if (input.locationId) {
      await this.validateLocation(input.locationId, sellerId);
    }

    const listingId = `lst_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const [created] = await db
      .insert(listing)
      .values({
        id: listingId,
        sellerId,
        title: input.title || "Untitled Draft",
        description: input.description || "",
        price: input.price || 1,
        isNegotiable: input.isNegotiable ?? false,
        categoryId: input.categoryId || "cat_other",
        condition: input.condition || null,
        locationId: input.locationId || "loc_campus_osogbo",
        quantityAvailable: input.quantityAvailable ?? 1,
        quantityReserved: 0,
        status: "draft",
      })
      .returning();

    if (input.photoIds && input.photoIds.length > 0) {
      await this.attachPhotos(listingId, sellerId, input.photoIds);
    }

    return this.getListingById(sellerId, listingId);
  }

  /**
   * Updates an existing listing owned by seller.
   * Handles high-risk edit evaluation if listing is published.
   */
  async updateListing(
    sellerId: string,
    listingId: string,
    input: UpdateListingInput
  ): Promise<Listing> {
    const [existing] = await db
      .select()
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Listing not found.");
    }

    // IDOR protection
    if (existing.sellerId !== sellerId) {
      throw new ForbiddenError("You cannot modify a listing that does not belong to you.");
    }

    if (["reserved", "sold", "archived"].includes(existing.status)) {
      throw new BadRequestError(`Cannot edit listing with status '${existing.status}'.`);
    }

    if (input.categoryId) {
      await this.validateCategory(input.categoryId);
    }
    if (input.locationId) {
      await this.validateLocation(input.locationId, sellerId);
    }

    if (input.quantityAvailable !== undefined) {
      const [liveSumRow] = await db
        .select({
          totalReserved: sql<number>`COALESCE(SUM(${purchaseRequest.requestedQuantity}), 0)`,
        })
        .from(purchaseRequest)
        .where(
          and(
            eq(purchaseRequest.listingId, listingId),
            eq(purchaseRequest.status, "pending"),
            sql`${purchaseRequest.reservationExpiresAt} > now()`
          )
        );
      const liveReserved = Number(liveSumRow?.totalReserved) || 0;
      if (input.quantityAvailable < liveReserved) {
        throw new BadRequestError(
          `Cannot set quantity available (${input.quantityAvailable}) below currently reserved quantity (${liveReserved}).`
        );
      }
    }

    // Existing photos
    const currentPhotos = await db
      .select({ id: listingPhoto.id })
      .from(listingPhoto)
      .where(eq(listingPhoto.listingId, listingId))
      .orderBy(asc(listingPhoto.position));

    const currentPhotoIds = currentPhotos.map((p) => p.id);

    let nextStatus: ListingStatus = existing.status as ListingStatus;

    // Check if high-risk edit when currently published
    if (existing.status === "published") {
      const isHighRisk = isHighRiskListingEdit(
        {
          title: existing.title,
          price: existing.price,
          categoryId: existing.categoryId,
          condition: existing.condition,
          photoIds: currentPhotoIds,
        },
        {
          title: input.title,
          price: input.price,
          categoryId: input.categoryId,
          condition: input.condition,
          photoIds: input.photoIds,
        }
      );

      if (isHighRisk) {
        // Re-evaluate content moderation
        const titleToScan = input.title !== undefined ? input.title : existing.title;
        const descToScan =
          input.description !== undefined ? input.description : existing.description;

        const scanResult = defaultModerationService.scanContent(titleToScan, descToScan);

        const recId = `mod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        await db.insert(moderationRecord).values({
          id: recId,
          listingId,
          type: "keyword_scan",
          result: scanResult.result,
          flags: scanResult.flags,
        });

        if (scanResult.result === "flagged") {
          // Drop from published to pending_moderation
          if (isAllowedListingTransition("published", "pending_moderation")) {
            nextStatus = "pending_moderation";
          }
        }
      }
    }

    // Apply updates
    await db
      .update(listing)
      .set({
        title: input.title !== undefined ? input.title : existing.title,
        description:
          input.description !== undefined ? input.description : existing.description,
        price: input.price !== undefined ? input.price : existing.price,
        isNegotiable:
          input.isNegotiable !== undefined ? input.isNegotiable : existing.isNegotiable,
        categoryId:
          input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        condition:
          input.condition !== undefined ? input.condition : existing.condition,
        locationId:
          input.locationId !== undefined ? input.locationId : existing.locationId,
        quantityAvailable:
          input.quantityAvailable !== undefined
            ? input.quantityAvailable
            : existing.quantityAvailable,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, listingId));

    if (input.photoIds !== undefined) {
      await this.attachPhotos(listingId, sellerId, input.photoIds);
    }

    return this.getListingById(sellerId, listingId);
  }

  /**
   * Submits a draft listing for moderation and publication.
   */
  async submitListing(
    sellerId: string,
    listingId: string,
    input?: SubmitListingInput
  ): Promise<Listing> {
    const [existing] = await db
      .select()
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Listing not found.");
    }

    if (existing.sellerId !== sellerId) {
      throw new ForbiddenError("You cannot submit a listing that does not belong to you.");
    }

    // Must be in draft status to submit
    if (existing.status !== "draft") {
      throw new BadRequestError(
        `Only draft listings can be submitted. Current status: '${existing.status}'.`
      );
    }

    // If input is provided, update first
    if (input) {
      await this.updateListing(sellerId, listingId, input);
    }

    // Refetch latest state
    const currentListing = await this.getListingById(sellerId, listingId);

    // Validate complete submission requirements
    const currentPhotoIds = currentListing.photos?.map((p) => p.id) || [];
    const validationPayload = {
      title: currentListing.title,
      description: currentListing.description,
      price: currentListing.price,
      isNegotiable: currentListing.isNegotiable,
      categoryId: currentListing.categoryId,
      condition: currentListing.condition || null,
      locationId: currentListing.locationId,
      quantityAvailable: currentListing.quantityAvailable,
      photoIds: currentPhotoIds,
    };

    const parsed = SubmitListingSchema.safeParse(validationPayload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Validation failed";
      throw new BadRequestError(firstError);
    }

    // Validate category condition requirement rule
    const cat = await this.validateCategory(parsed.data.categoryId);
    const requirement = getCategoryConditionRequirement(cat.slug);

    if (requirement === "required" && !parsed.data.condition) {
      throw new BadRequestError(
        `Item condition is required for category '${cat.name}'.`
      );
    }
    if (requirement === "not_applicable" && parsed.data.condition) {
      // Clear condition if not applicable
      await db
        .update(listing)
        .set({ condition: null })
        .where(eq(listing.id, listingId));
    }

    // Validate location
    await this.validateLocation(parsed.data.locationId, sellerId);

    // Run moderation scan on title + description
    const scan = defaultModerationService.scanContent(
      parsed.data.title,
      parsed.data.description
    );

    const recId = `mod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await db.insert(moderationRecord).values({
      id: recId,
      listingId,
      type: "keyword_scan",
      result: scan.result,
      flags: scan.flags,
    });

    let newStatus: ListingStatus = "pending_moderation";
    if (scan.result === "clean") {
      // Auto-publish clean listings
      newStatus = "published";
    }

    await db
      .update(listing)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, listingId));

    return this.getListingById(sellerId, listingId);
  }

  /**
   * Deletes a draft listing.
   */
  async deleteDraft(sellerId: string, listingId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Listing not found.");
    }

    if (existing.sellerId !== sellerId) {
      throw new ForbiddenError("You cannot delete a listing that does not belong to you.");
    }

    if (existing.status !== "draft") {
      throw new BadRequestError("Only draft listings can be deleted.");
    }

    // Deletion hygiene: delete attached photo blobs from storage
    const attachedPhotos = await db
      .select()
      .from(listingPhoto)
      .where(eq(listingPhoto.listingId, listingId));

    if (attachedPhotos.length > 0) {
      const storage = getStorageService();
      const successfullyDeletedPhotoIds: string[] = [];
      for (const p of attachedPhotos) {
        if (p.isSeed) {
          successfullyDeletedPhotoIds.push(p.id);
          continue;
        }
        try {
          await storage.delete(p.key);
          await storage.delete(p.thumbKey);
          successfullyDeletedPhotoIds.push(p.id);
        } catch (err: any) {
          console.error(
            `[Storage Error] Failed to delete photo blobs for ${p.id}: ${err instanceof Error ? err.message : String(err)}`
          );
          // Detach from listing so sweepOrphanPhotos will retry cleaning the blobs
          await db
            .update(listingPhoto)
            .set({ listingId: null })
            .where(eq(listingPhoto.id, p.id));
        }
      }
      if (successfullyDeletedPhotoIds.length > 0) {
        await db
          .delete(listingPhoto)
          .where(inArray(listingPhoto.id, successfullyDeletedPhotoIds));
      }
    }

    await db.delete(listing).where(eq(listing.id, listingId));
  }

  /**
   * Archives a listing. Cancels any live pending purchase requests and notifies buyers.
   */
  async archiveListing(sellerId: string, listingId: string): Promise<Listing> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(listing)
        .where(eq(listing.id, listingId))
        .for("update")
        .limit(1);

      if (!existing) {
        throw new NotFoundError("Listing not found.");
      }
      if (existing.sellerId !== sellerId) {
        throw new ForbiddenError("You cannot archive a listing that does not belong to you.");
      }

      // Find and cancel any live pending requests
      const liveReqs = await tx
        .select()
        .from(purchaseRequest)
        .where(
          and(
            eq(purchaseRequest.listingId, listingId),
            eq(purchaseRequest.status, "pending"),
            sql`${purchaseRequest.reservationExpiresAt} > now()`
          )
        )
        .for("update");

      if (liveReqs.length > 0) {
        await tx
          .update(purchaseRequest)
          .set({
            status: "cancelled",
            cancelledBy: "system",
            updatedAt: sql`now()`,
          })
          .where(
            inArray(
              purchaseRequest.id,
              liveReqs.map((r) => r.id)
            )
          );

        for (const req of liveReqs) {
          const notifId = crypto.randomUUID();
          await tx.insert(notification).values({
            id: notifId,
            userId: req.buyerId,
            type: "purchase_request_cancelled",
            payload: JSON.stringify({
              requestId: req.id,
              listingId,
              cancelledBy: "system",
              reason: "Listing was archived by seller.",
            }),
            readAt: null,
            createdAt: sql`now()`,
          });
        }
      }

      await tx
        .update(listing)
        .set({
          status: "archived",
          quantityReserved: 0,
          updatedAt: sql`now()`,
        })
        .where(eq(listing.id, listingId));

      return this.getListingById(sellerId, listingId);
    });
  }

  /**
   * Retrieves all listings belonging to seller with photos, category, and location.
   */
  async getMyListings(sellerId: string): Promise<Listing[]> {
    const rows = await db
      .select({
        listing,
        category,
        location,
      })
      .from(listing)
      .leftJoin(category, eq(listing.categoryId, category.id))
      .leftJoin(location, eq(listing.locationId, location.id))
      .where(eq(listing.sellerId, sellerId))
      .orderBy(desc(listing.createdAt));

    if (rows.length === 0) return [];

    const listingIds = rows.map((r) => r.listing.id);
    const photos = await db
      .select()
      .from(listingPhoto)
      .where(inArray(listingPhoto.listingId, listingIds))
      .orderBy(asc(listingPhoto.position));

    const photosByListing = new Map<string, ListingPhoto[]>();
    for (const p of photos) {
      if (!p.listingId) continue;
      const arr = photosByListing.get(p.listingId) || [];
      arr.push(mapPhoto(p));
      photosByListing.set(p.listingId, arr);
    }

    return rows.map((r) => ({
      id: r.listing.id,
      sellerId: r.listing.sellerId,
      title: r.listing.title,
      description: r.listing.description,
      price: r.listing.price,
      isNegotiable: r.listing.isNegotiable,
      categoryId: r.listing.categoryId,
      category: r.category || undefined,
      condition: (r.listing.condition as any) || null,
      locationId: r.listing.locationId,
      location: (r.location as any) || undefined,
      quantityAvailable: r.listing.quantityAvailable,
      quantityReserved: r.listing.quantityReserved,
      status: r.listing.status as ListingStatus,
      createdAt: r.listing.createdAt,
      updatedAt: r.listing.updatedAt,
      photos: photosByListing.get(r.listing.id) || [],
    }));
  }

  /**
   * Retrieves listing by ID. Owner only in Step 04 (IDOR check enforced).
   */
  async getListingById(sellerId: string, listingId: string): Promise<Listing> {
    const [row] = await db
      .select({
        listing,
        category,
        location,
      })
      .from(listing)
      .leftJoin(category, eq(listing.categoryId, category.id))
      .leftJoin(location, eq(listing.locationId, location.id))
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Listing not found.");
    }

    if (row.listing.sellerId !== sellerId) {
      throw new ForbiddenError("You do not have permission to view this listing.");
    }

    const photos = await db
      .select()
      .from(listingPhoto)
      .where(eq(listingPhoto.listingId, listingId))
      .orderBy(asc(listingPhoto.position));

    return {
      id: row.listing.id,
      sellerId: row.listing.sellerId,
      title: row.listing.title,
      description: row.listing.description,
      price: row.listing.price,
      isNegotiable: row.listing.isNegotiable,
      categoryId: row.listing.categoryId,
      category: row.category || undefined,
      condition: (row.listing.condition as any) || null,
      locationId: row.listing.locationId,
      location: (row.location as any) || undefined,
      quantityAvailable: row.listing.quantityAvailable,
      quantityReserved: row.listing.quantityReserved,
      status: row.listing.status as ListingStatus,
      createdAt: row.listing.createdAt,
      updatedAt: row.listing.updatedAt,
      photos: photos.map(mapPhoto),
    };
  }

  /**
   * Uploads and processes a photo, enforcing unattached quota (max 20) and global storage soft cap.
   */
  async uploadPhoto(ownerId: string, fileBuffer: Buffer): Promise<ListingPhoto> {
    // Storage guard: check global storage usage against soft cap
    const [usageResult] = await db
      .select({
        totalBytes: sql<string>`coalesce(sum(${listingPhoto.bytes}), 0)`,
      })
      .from(listingPhoto);

    const currentTotalBytes = Number(usageResult?.totalBytes || 0);
    const softCapBytes = getStorageSoftCapBytes();

    if (currentTotalBytes >= softCapBytes) {
      console.error(
        `[Storage Guard] Storage soft cap reached (${currentTotalBytes} >= ${softCapBytes} bytes). Refusing upload.`
      );
      throw new ApiError(
        503,
        "Uploads are temporarily unavailable due to storage limits. Please try again later."
      );
    }

    if (currentTotalBytes >= 0.7 * softCapBytes) {
      console.warn(
        `[Storage Guard Warning] Storage usage is at ${Math.round((currentTotalBytes / softCapBytes) * 100)}% of soft cap (${currentTotalBytes}/${softCapBytes} bytes).`
      );
    }

    // Quota check: max 20 unattached photos
    const unattached = await db
      .select({ id: listingPhoto.id })
      .from(listingPhoto)
      .where(
        and(eq(listingPhoto.ownerId, ownerId), isNull(listingPhoto.listingId))
      );

    if (unattached.length >= 20) {
      throw new QuotaExceededError(
        "You have reached the limit of 20 unattached photos. Please attach or delete pending photos before uploading more."
      );
    }

    const photoId = `pht_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // Process image through Sharp: strip EXIF GPS, generate display & thumb WebP
    const processed = await processListingPhoto(fileBuffer, ownerId, photoId);

    const storage = getStorageService();
    await storage.upload(processed.displayKey, processed.displayBuffer, "image/webp");
    await storage.upload(processed.thumbKey, processed.thumbBuffer, "image/webp");

    const [created] = await db
      .insert(listingPhoto)
      .values({
        id: photoId,
        ownerId,
        listingId: null,
        key: processed.displayKey,
        thumbKey: processed.thumbKey,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        position: 0,
      })
      .returning();

    return mapPhoto(created);
  }

  /**
   * Deletes a photo owned by ownerId.
   */
  async deletePhoto(ownerId: string, photoId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(listingPhoto)
      .where(eq(listingPhoto.id, photoId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Photo not found.");
    }

    if (existing.ownerId !== ownerId) {
      throw new ForbiddenError("You cannot delete a photo that does not belong to you.");
    }

    if (!existing.isSeed) {
      const storage = getStorageService();
      try {
        await storage.delete(existing.key);
        await storage.delete(existing.thumbKey);
        await db.delete(listingPhoto).where(eq(listingPhoto.id, photoId));
      } catch (err: any) {
        console.error(
          `[Storage Error] Failed to delete photo blobs for ${photoId}: ${err instanceof Error ? err.message : String(err)}`
        );
        // Ensure photo is detached so sweepOrphanPhotos will retry deleting it later
        await db
          .update(listingPhoto)
          .set({ listingId: null })
          .where(eq(listingPhoto.id, photoId));
        throw new ApiError(502, "Storage provider failed to delete image. Photo marked for retry cleanup.");
      }
    } else {
      await db.delete(listingPhoto).where(eq(listingPhoto.id, photoId));
    }
  }

  /**
   * Sweeps orphan photos (unattached and older than cutoffHours, default 24h).
   * Deletes blobs from object storage and deletes database records.
   */
  async sweepOrphanPhotos(cutoffHours: number = 24): Promise<{ count: number; bytesFreed: number }> {
    const cutoffDate = new Date(Date.now() - cutoffHours * 60 * 60 * 1000);

    const orphans = await db
      .select()
      .from(listingPhoto)
      .where(
        and(
          isNull(listingPhoto.listingId),
          lt(listingPhoto.createdAt, cutoffDate)
        )
      );

    if (orphans.length === 0) {
      return { count: 0, bytesFreed: 0 };
    }

    const storage = getStorageService();
    let bytesFreed = 0;
    const idsToDelete: string[] = [];

    for (const p of orphans) {
      if (p.isSeed) {
        idsToDelete.push(p.id);
        continue;
      }
      try {
        await storage.delete(p.key);
        await storage.delete(p.thumbKey);
        bytesFreed += p.bytes;
        idsToDelete.push(p.id);
      } catch (err: any) {
        console.error(
          `[Storage Error] Failed to sweep orphan photo blobs for ${p.id}: ${err instanceof Error ? err.message : String(err)}`
        );
        // Photo stays in database so subsequent sweep runs can retry deleting it
      }
    }

    if (idsToDelete.length > 0) {
      await db.delete(listingPhoto).where(inArray(listingPhoto.id, idsToDelete));
    }

    return { count: idsToDelete.length, bytesFreed };
  }

  /**
   * Retrieves high-fidelity public listing detail projection with strict privacy boundaries:
   * - Publicly visible for published, reserved, and sold listings.
   * - Private for draft, pending_moderation, and archived listings (owner-only access, throws 403 otherwise).
   * - Zero seller PII exposed (no email, phone, matric number, or internal seller userId).
   */
  async getPublicListingDetail(
    listingId: string,
    currentUserId?: string | null
  ): Promise<PublicListingDetail> {
    const [row] = await db
      .select({
        listing,
        category,
        location,
        campus,
        user,
      })
      .from(listing)
      .leftJoin(category, eq(listing.categoryId, category.id))
      .leftJoin(location, eq(listing.locationId, location.id))
      .leftJoin(campus, eq(location.campusId, campus.id))
      .leftJoin(user, eq(listing.sellerId, user.id))
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Listing not found.");
    }

    const isPrivateStatus = ["draft", "pending_moderation", "archived"].includes(row.listing.status);
    if (isPrivateStatus) {
      if (!currentUserId || currentUserId !== row.listing.sellerId) {
        throw new ForbiddenError("You do not have permission to view this listing.");
      }
    }

    const photos = await db
      .select()
      .from(listingPhoto)
      .where(eq(listingPhoto.listingId, listingId))
      .orderBy(asc(listingPhoto.position));

    const storage = getStorageService();
    const publicPhotos: PublicListingPhoto[] = photos.map((p) => {
      const displayUrl = p.key.startsWith("http")
        ? p.key.split("?")[0]
        : storage.getPublicUrl(p.key).split("?")[0];
      const thumbUrl = p.thumbKey.startsWith("http")
        ? p.thumbKey.split("?")[0]
        : storage.getPublicUrl(p.thumbKey).split("?")[0];

      return {
        id: p.id,
        url: displayUrl,
        thumbUrl: thumbUrl,
        width: p.width,
        height: p.height,
        position: p.position,
      };
    });

    let isSaved = false;
    if (currentUserId) {
      const [savedRow] = await db
        .select({ count: count() })
        .from(savedListing)
        .where(and(eq(savedListing.userId, currentUserId), eq(savedListing.listingId, listingId)))
        .limit(1);
      isSaved = (Number(savedRow?.count) || 0) > 0;
    }

    const [{ count: activeCount }] = await db
      .select({ count: count() })
      .from(listing)
      .where(and(eq(listing.sellerId, row.listing.sellerId), eq(listing.status, "published")));

    const studentVerificationStatus: "verified" | "pending" | "not_a_seller" =
      row.user?.emailVerified && row.user?.matricNumber
        ? "verified"
        : row.user?.sellerStatus === "pending_verification"
        ? "pending"
        : "not_a_seller";

    // Recompute live reserved quantity from source of truth
    const [liveSumRow] = await db
      .select({
        totalReserved: sql<number>`COALESCE(SUM(${purchaseRequest.requestedQuantity}), 0)`,
      })
      .from(purchaseRequest)
      .where(
        and(
          eq(purchaseRequest.listingId, listingId),
          eq(purchaseRequest.status, "pending"),
          sql`${purchaseRequest.reservationExpiresAt} > now()`
        )
      );

    const liveReserved = Number(liveSumRow?.totalReserved) || 0;
    const effectiveUnreserved = Math.max(0, row.listing.quantityAvailable - liveReserved);

    let availability: "available" | "reserved" | "sold" = "available";
    if (row.listing.status === "sold") {
      availability = "sold";
    } else if (effectiveUnreserved <= 0) {
      availability = "reserved";
    }

    let activeRequest = null;
    if (currentUserId) {
      const [activeReqRow] = await db
        .select()
        .from(purchaseRequest)
        .where(
          and(
            eq(purchaseRequest.buyerId, currentUserId),
            eq(purchaseRequest.listingId, listingId),
            eq(purchaseRequest.status, "pending"),
            sql`${purchaseRequest.reservationExpiresAt} > now()`
          )
        )
        .limit(1);

      if (activeReqRow) {
        activeRequest = {
          id: activeReqRow.id,
          requestedQuantity: activeReqRow.requestedQuantity,
          offerPrice: activeReqRow.offerPrice,
          reservationExpiresAt: activeReqRow.reservationExpiresAt.toISOString(),
        };
      }
    }

    return {
      id: row.listing.id,
      title: row.listing.title,
      description: row.listing.description,
      price: row.listing.price,
      isNegotiable: row.listing.isNegotiable,
      condition: (row.listing.condition as any) || null,
      categoryId: row.listing.categoryId,
      locationId: row.listing.locationId,
      category: {
        id: row.category?.id || row.listing.categoryId,
        name: row.category?.name || "Other",
        slug: row.category?.slug || "other",
      },
      location: {
        id: row.location?.id || row.listing.locationId,
        name: row.location?.name || "Campus",
        campusName: row.campus?.name || "UNIOSUN",
        campusSlug: row.campus?.slug || "uniosun",
        type: (row.location?.type as any) || "campus",
      },
      photos: publicPhotos,
      seller: {
        displayName: formatDisplayName(row.user?.name || "Seller"),
        avatarUrl: row.user?.image || null,
        isVerifiedSeller: row.user?.sellerStatus === "verified",
        campusName: row.campus?.name || "UNIOSUN",
        studentVerificationStatus,
        memberSince: formatMemberSince(row.user?.createdAt),
        totalActiveListings: Number(activeCount) || 0,
      },
      availability,
      effectiveAvailability: effectiveUnreserved,
      quantityAvailable: row.listing.quantityAvailable,
      status: row.listing.status as ListingStatus,
      viewCount: row.listing.viewCount ?? 0,
      isSaved,
      activeRequest,
      createdAt: row.listing.createdAt.toISOString(),
      updatedAt: row.listing.updatedAt.toISOString(),
    };
  }

  /**
   * Lightweight view count increment with IP rate limiting.
   */
  async incrementViewCount(
    listingId: string,
    clientIp: string
  ): Promise<{ ok: boolean; viewCount: number }> {
    const [target] = await db
      .select({ id: listing.id, viewCount: listing.viewCount })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!target) {
      throw new NotFoundError("Listing not found.");
    }

    const rateLimitKey = `view:${listingId}:${clientIp}`;
    const rlResult = await checkRateLimit(rateLimitKey, 1, 60_000);

    if (!rlResult.success) {
      return { ok: true, viewCount: target.viewCount ?? 0 };
    }

    const [updated] = await db
      .update(listing)
      .set({
        viewCount: sql`${listing.viewCount} + 1`,
      })
      .where(eq(listing.id, listingId))
      .returning({ viewCount: listing.viewCount });

    return { ok: true, viewCount: updated?.viewCount ?? (target.viewCount + 1) };
  }
}

export const listingService = new ListingService();


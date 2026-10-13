import { db } from "../db/index";
import {
  listing,
  purchaseRequest,
  notification,
  user,
  campus,
  location,
  listingPhoto,
} from "../db/schema";
import {
  CreatePurchaseRequestInput,
  isAllowedPurchaseRequestTransition,
  PurchaseRequestStatus,
  CancelledBy,
} from "@downtown/validation";
import {
  PurchaseRequest,
  PurchaseRequestResponse,
} from "@downtown/types";
import {
  generateWhatsAppUrl,
  normalizeNigerianPhone,
  formatDisplayName,
} from "@downtown/utils";
import { checkRateLimit } from "./rate-limit.service";
import { ApiError, NotFoundError, ForbiddenError, BadRequestError } from "./listing.service";
import { sql, eq, and, desc, count, SQL } from "drizzle-orm";
import crypto from "crypto";

export interface CreatePurchaseRequestOptions {
  buyerId: string;
  listingId: string;
  input: CreatePurchaseRequestInput;
  clientIp?: string;
  origin?: string;
}

/**
 * Shared SQL expression for effective reserved quantity on a listing.
 * Evaluates strictly live pending requests: status = 'pending' AND reservation_expires_at > now().
 */
export function getEffectiveReservedSql(listingIdCol: SQL = sql`${listing.id}`): SQL<number> {
  return sql<number>`COALESCE((
    SELECT SUM(pr.requested_quantity)
    FROM purchase_requests pr
    WHERE pr.listing_id = ${listingIdCol}
      AND pr.status = 'pending'
      AND pr.reservation_expires_at > now()
  ), 0)`;
}

/**
 * Shared SQL expression for effective available (unreserved) quantity on a listing.
 */
export function getEffectiveAvailableSql(listingIdCol: SQL = sql`${listing.id}`): SQL<number> {
  return sql<number>`GREATEST(0, ${listing.quantityAvailable} - ${getEffectiveReservedSql(listingIdCol)})`;
}

export class PurchaseRequestService {
  /**
   * Creates or returns an idempotent purchase request.
   * Transactional concurrency guarded by SELECT ... FOR UPDATE.
   */
  async createRequest(options: CreatePurchaseRequestOptions): Promise<PurchaseRequestResponse> {
    const { buyerId, listingId, input, clientIp, origin } = options;
    const requestedQuantity = input.requestedQuantity ?? 1;

    // 1. IP Rate Limiting
    if (clientIp) {
      await checkRateLimit(`purchase_request_ip:${clientIp}`, 30, 3600 * 1000);
    }

    // 2. Buyer Profile & Verification Validation
    const [buyer] = await db
      .select()
      .from(user)
      .where(eq(user.id, buyerId))
      .limit(1);

    if (!buyer) {
      throw new NotFoundError("Buyer user account not found.");
    }
    if (buyer.accountStatus !== "active") {
      throw new ForbiddenError("Your account is not active.");
    }
    if (!buyer.emailVerified) {
      throw new ForbiddenError("Please verify your email address before contacting sellers.");
    }
    if (!buyer.phone) {
      throw new BadRequestError("A valid Nigerian phone number is required on your profile before contacting sellers.");
    }

    // 3. Abuse Caps Validation
    // Cap A: Maximum 5 live pending requests across platform
    const [liveRequestsCountRow] = await db
      .select({ count: count() })
      .from(purchaseRequest)
      .where(
        and(
          eq(purchaseRequest.buyerId, buyerId),
          eq(purchaseRequest.status, "pending"),
          sql`${purchaseRequest.reservationExpiresAt} > now()`
        )
      );
    const liveRequestsCount = Number(liveRequestsCountRow?.count) || 0;
    if (liveRequestsCount >= 5) {
      throw new ApiError(
        429,
        "You have reached the maximum limit of 5 active purchase requests. Please cancel an existing request or wait for it to expire."
      );
    }

    // Cap B: Maximum 15 new requests created in rolling 24 hours
    const [rollingRequestsCountRow] = await db
      .select({ count: count() })
      .from(purchaseRequest)
      .where(
        and(
          eq(purchaseRequest.buyerId, buyerId),
          sql`${purchaseRequest.createdAt} > now() - interval '24 hours'`
        )
      );
    const rollingRequestsCount = Number(rollingRequestsCountRow?.count) || 0;
    if (rollingRequestsCount >= 15) {
      throw new ApiError(
        429,
        "Daily request limit reached (maximum 15 requests per 24 hours)."
      );
    }

    // 4. Contact Idempotency Check (B.3)
    // If a live pending request already exists for (buyerId, listingId), return it with HTTP 200
    const [existingLiveRequest] = await db
      .select({
        request: purchaseRequest,
        seller: {
          name: user.name,
          phone: user.phone,
        },
        listingTitle: listing.title,
      })
      .from(purchaseRequest)
      .innerJoin(listing, eq(purchaseRequest.listingId, listing.id))
      .innerJoin(user, eq(purchaseRequest.sellerId, user.id))
      .where(
        and(
          eq(purchaseRequest.buyerId, buyerId),
          eq(purchaseRequest.listingId, listingId),
          eq(purchaseRequest.status, "pending")
        )
      )
      .limit(1);

    const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "https://downtown.ng";

    if (existingLiveRequest && existingLiveRequest.seller.phone) {
      const whatsappUrl = generateWhatsAppUrl({
        sellerPhone: existingLiveRequest.seller.phone,
        sellerName: existingLiveRequest.seller.name,
        listingTitle: existingLiveRequest.listingTitle,
        listingUrl: `${baseUrl}/listings/${listingId}`,
        quantity: existingLiveRequest.request.requestedQuantity,
        offerPrice: existingLiveRequest.request.offerPrice,
      });

      return {
        request: this.mapPurchaseRequest(existingLiveRequest.request, {
          listingTitle: existingLiveRequest.listingTitle,
          sellerFirstName: existingLiveRequest.seller.name.split(" ")[0],
          whatsappUrl,
        }),
        whatsappUrl,
        isExisting: true,
      };
    }

    // 5. Pessimistic Interactive Concurrency via SELECT ... FOR UPDATE
    const result = await db.transaction(async (tx) => {
      // Lock target listing row
      const [listingRow] = await tx
        .select()
        .from(listing)
        .where(eq(listing.id, listingId))
        .for("update")
        .limit(1);

      if (!listingRow) {
        throw new NotFoundError("Listing not found.");
      }
      if (listingRow.sellerId === buyerId) {
        throw new BadRequestError("You cannot contact or make purchase requests on your own listing.");
      }
      if (["draft", "pending_moderation", "archived"].includes(listingRow.status)) {
        throw new BadRequestError("This listing is not currently available.");
      }
      if (listingRow.status === "sold") {
        throw new BadRequestError("This listing has already been sold.");
      }

      // Recompute live reserved inventory from source of truth
      const [liveSumRow] = await tx
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
      const unreserved = Math.max(0, listingRow.quantityAvailable - liveReserved);

      // Spec Amendment: If unreserved is 0, item is fully reserved -> block new requests
      if (unreserved <= 0) {
        if (listingRow.status !== "reserved" || listingRow.quantityReserved !== liveReserved) {
          await tx
            .update(listing)
            .set({
              status: "reserved",
              quantityReserved: liveReserved,
              updatedAt: sql`now()`,
            })
            .where(eq(listing.id, listingId));
        }
        throw new ApiError(409, "This item is currently fully reserved by another buyer.");
      }

      // Quantity validation
      if (requestedQuantity < 1) {
        throw new BadRequestError("Requested quantity must be at least 1.");
      }
      if (requestedQuantity > unreserved) {
        throw new BadRequestError(
          `Requested quantity (${requestedQuantity}) exceeds currently unreserved stock (${unreserved}).`
        );
      }

      // Offer validation (B.7)
      if (input.offerPrice !== undefined && input.offerPrice !== null) {
        if (!listingRow.isNegotiable) {
          throw new BadRequestError("This listing does not accept custom offers (price is non-negotiable).");
        }
        if (!Number.isInteger(input.offerPrice)) {
          throw new BadRequestError("Offer price must be a whole integer Naira amount.");
        }
        const minOffer = Math.round(listingRow.price * 0.10);
        const maxOffer = listingRow.price;
        if (input.offerPrice < minOffer || input.offerPrice > maxOffer) {
          throw new BadRequestError(
            `Offer price must be between 10% and 100% of listing price (₦${minOffer.toLocaleString()} - ₦${maxOffer.toLocaleString()}).`
          );
        }
      }

      // Fetch seller for phone and notification
      const [sellerRow] = await tx
        .select()
        .from(user)
        .where(eq(user.id, listingRow.sellerId))
        .limit(1);

      if (!sellerRow || !sellerRow.phone) {
        throw new BadRequestError("Seller does not have a reachable phone number on file.");
      }

      const requestId = crypto.randomUUID();

      // Insert purchase request
      const [newRequest] = await tx
        .insert(purchaseRequest)
        .values({
          id: requestId,
          listingId,
          buyerId,
          sellerId: listingRow.sellerId,
          requestedQuantity,
          unitPrice: listingRow.price,
          offerPrice: input.offerPrice ?? null,
          status: "pending",
          cancelledBy: null,
          reservationExpiresAt: sql`now() + interval '24 hours'`,
          resolutionDeadline: sql`now() + interval '7 days'`,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .returning();

      // Recompute and write quantity_reserved and status atomically
      const newLiveReserved = liveReserved + requestedQuantity;
      const newStatus = newLiveReserved >= listingRow.quantityAvailable ? "reserved" : "published";

      await tx
        .update(listing)
        .set({
          quantityReserved: newLiveReserved,
          status: newStatus,
          updatedAt: sql`now()`,
        })
        .where(eq(listing.id, listingId));

      // Insert seller notification
      const notifId = crypto.randomUUID();
      await tx.insert(notification).values({
        id: notifId,
        userId: listingRow.sellerId,
        type: "purchase_request_created",
        payload: JSON.stringify({
          requestId,
          listingId,
          listingTitle: listingRow.title,
          buyerName: formatDisplayName(buyer.name),
          requestedQuantity,
          offerPrice: input.offerPrice ?? null,
        }),
        readAt: null,
        createdAt: sql`now()`,
      });

      // Generate WhatsApp link
      const whatsappUrl = generateWhatsAppUrl({
        sellerPhone: sellerRow.phone,
        sellerName: sellerRow.name,
        listingTitle: listingRow.title,
        listingUrl: `${baseUrl}/listings/${listingId}`,
        quantity: requestedQuantity,
        offerPrice: input.offerPrice,
      });

      return {
        request: this.mapPurchaseRequest(newRequest, {
          listingTitle: listingRow.title,
          sellerFirstName: sellerRow.name.split(" ")[0],
          buyerName: buyer.name,
          whatsappUrl,
        }),
        whatsappUrl,
        isExisting: false,
      };
    });

    return result;
  }

  /**
   * Cancels a pending purchase request.
   * Allowed actors: buyer (own request) or seller (own listing).
   */
  async cancelRequest(userId: string, requestId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return await db.transaction(async (tx) => {
      const [reqRow] = await tx
        .select()
        .from(purchaseRequest)
        .where(eq(purchaseRequest.id, requestId))
        .for("update")
        .limit(1);

      if (!reqRow) {
        throw new NotFoundError("Purchase request not found.");
      }

      if (reqRow.status !== "pending") {
        throw new BadRequestError(`Cannot cancel a purchase request that is already ${reqRow.status}.`);
      }

      let actor: CancelledBy;
      let targetNotifyUserId: string;

      if (userId === reqRow.buyerId) {
        actor = "buyer";
        targetNotifyUserId = reqRow.sellerId;
      } else if (userId === reqRow.sellerId) {
        actor = "seller";
        targetNotifyUserId = reqRow.buyerId;
      } else {
        throw new ForbiddenError("You are not authorized to cancel this purchase request.");
      }

      if (!isAllowedPurchaseRequestTransition(reqRow.status as PurchaseRequestStatus, "cancelled", actor)) {
        throw new BadRequestError("Invalid purchase request state transition.");
      }

      // Lock target listing
      const [listingRow] = await tx
        .select()
        .from(listing)
        .where(eq(listing.id, reqRow.listingId))
        .for("update")
        .limit(1);

      // Update request to cancelled
      await tx
        .update(purchaseRequest)
        .set({
          status: "cancelled",
          cancelledBy: actor,
          updatedAt: sql`now()`,
        })
        .where(eq(purchaseRequest.id, requestId));

      if (listingRow) {
        // Recompute live reserved
        const [liveSumRow] = await tx
          .select({
            totalReserved: sql<number>`COALESCE(SUM(${purchaseRequest.requestedQuantity}), 0)`,
          })
          .from(purchaseRequest)
          .where(
            and(
              eq(purchaseRequest.listingId, reqRow.listingId),
              eq(purchaseRequest.status, "pending"),
              sql`${purchaseRequest.reservationExpiresAt} > now()`
            )
          );

        const liveReserved = Number(liveSumRow?.totalReserved) || 0;
        const newStatus =
          listingRow.status === "reserved" && liveReserved < listingRow.quantityAvailable
            ? "published"
            : listingRow.status;

        await tx
          .update(listing)
          .set({
            quantityReserved: liveReserved,
            status: newStatus,
            updatedAt: sql`now()`,
          })
          .where(eq(listing.id, reqRow.listingId));
      }

      // Notify the other party
      const notifId = crypto.randomUUID();
      await tx.insert(notification).values({
        id: notifId,
        userId: targetNotifyUserId,
        type: "purchase_request_cancelled",
        payload: JSON.stringify({
          requestId,
          listingId: reqRow.listingId,
          cancelledBy: actor,
          reason: reason || undefined,
        }),
        readAt: null,
        createdAt: sql`now()`,
      });

      return {
        success: true,
        message: "Purchase request cancelled successfully.",
        status: "cancelled",
        cancelledBy: actor,
      };
    });
  }

  /**
   * Retrieves single request detail.
   * Strict privacy:
   * - Buyer sees listing snapshot and active WhatsApp URL.
   * - Seller sees request and buyer display name, but NEVER buyer phone number.
   */
  async getRequestById(userId: string, requestId: string, origin?: string): Promise<PurchaseRequest> {
    const [row] = await db
      .select({
        request: purchaseRequest,
        listing: {
          id: listing.id,
          title: listing.title,
        },
        seller: {
          id: user.id,
          name: user.name,
          phone: user.phone,
        },
        buyer: {
          id: user.id,
          name: user.name,
        },
      })
      .from(purchaseRequest)
      .innerJoin(listing, eq(purchaseRequest.listingId, listing.id))
      .innerJoin(user, eq(purchaseRequest.sellerId, user.id))
      .where(eq(purchaseRequest.id, requestId))
      .limit(1);

    if (!row) {
      throw new NotFoundError("Purchase request not found.");
    }

    const isBuyer = userId === row.request.buyerId;
    const isSeller = userId === row.request.sellerId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenError("You are not authorized to view this purchase request.");
    }

    let whatsappUrl: string | undefined;
    if (isBuyer && row.request.status === "pending" && row.seller.phone) {
      const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "https://downtown.ng";
      whatsappUrl = generateWhatsAppUrl({
        sellerPhone: row.seller.phone,
        sellerName: row.seller.name,
        listingTitle: row.listing.title,
        listingUrl: `${baseUrl}/listings/${row.listing.id}`,
        quantity: row.request.requestedQuantity,
        offerPrice: row.request.offerPrice,
      });
    }

    return this.mapPurchaseRequest(row.request, {
      listingTitle: row.listing.title,
      sellerFirstName: row.seller.name.split(" ")[0],
      buyerName: formatDisplayName(row.buyer.name),
      whatsappUrl,
    });
  }

  /**
   * Retrieves all purchase requests created by a buyer.
   */
  async getBuyerRequests(buyerId: string, origin?: string): Promise<PurchaseRequest[]> {
    const rows = await db
      .select({
        request: purchaseRequest,
        listing: {
          id: listing.id,
          title: listing.title,
        },
        seller: {
          name: user.name,
          phone: user.phone,
        },
      })
      .from(purchaseRequest)
      .innerJoin(listing, eq(purchaseRequest.listingId, listing.id))
      .innerJoin(user, eq(purchaseRequest.sellerId, user.id))
      .where(eq(purchaseRequest.buyerId, buyerId))
      .orderBy(desc(purchaseRequest.createdAt));

    const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "https://downtown.ng";

    return rows.map((r) => {
      let whatsappUrl: string | undefined;
      if (r.request.status === "pending" && r.seller.phone) {
        whatsappUrl = generateWhatsAppUrl({
          sellerPhone: r.seller.phone,
          sellerName: r.seller.name,
          listingTitle: r.listing.title,
          listingUrl: `${baseUrl}/listings/${r.listing.id}`,
          quantity: r.request.requestedQuantity,
          offerPrice: r.request.offerPrice,
        });
      }

      return this.mapPurchaseRequest(r.request, {
        listingTitle: r.listing.title,
        sellerFirstName: r.seller.name.split(" ")[0],
        whatsappUrl,
      });
    });
  }

  /**
   * Retrieves all incoming purchase requests received by a seller.
   * Buyer phone number is NEVER projected.
   */
  async getSellerRequests(sellerId: string): Promise<PurchaseRequest[]> {
    const rows = await db
      .select({
        request: purchaseRequest,
        listing: {
          id: listing.id,
          title: listing.title,
        },
        buyer: {
          name: user.name,
        },
      })
      .from(purchaseRequest)
      .innerJoin(listing, eq(purchaseRequest.listingId, listing.id))
      .innerJoin(user, eq(purchaseRequest.buyerId, user.id))
      .where(eq(purchaseRequest.sellerId, sellerId))
      .orderBy(desc(purchaseRequest.createdAt));

    return rows.map((r) =>
      this.mapPurchaseRequest(r.request, {
        listingTitle: r.listing.title,
        buyerName: formatDisplayName(r.buyer.name),
      })
    );
  }

  /**
   * Daily maintenance cron sweep:
   * Sets status to 'expired' only when resolution_deadline <= now().
   */
  async sweepExpiredRequests(): Promise<{ expiredCount: number }> {
    const expiredRows = await db
      .update(purchaseRequest)
      .set({
        status: "expired",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(purchaseRequest.status, "pending"),
          sql`${purchaseRequest.resolutionDeadline} <= now()`
        )
      )
      .returning({ id: purchaseRequest.id });

    return { expiredCount: expiredRows.length };
  }

  /**
   * Helper mapper to domain PurchaseRequest type.
   */
  private mapPurchaseRequest(
    row: typeof purchaseRequest.$inferSelect,
    extras?: {
      listingTitle?: string;
      listingThumbUrl?: string | null;
      sellerFirstName?: string;
      buyerName?: string;
      whatsappUrl?: string;
    }
  ): PurchaseRequest {
    return {
      id: row.id,
      listingId: row.listingId,
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      requestedQuantity: row.requestedQuantity,
      unitPrice: row.unitPrice,
      offerPrice: row.offerPrice,
      status: row.status as PurchaseRequestStatus,
      cancelledBy: (row.cancelledBy as CancelledBy) || null,
      reservationExpiresAt: row.reservationExpiresAt.toISOString(),
      resolutionDeadline: row.resolutionDeadline.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      listingTitle: extras?.listingTitle,
      listingThumbUrl: extras?.listingThumbUrl,
      sellerFirstName: extras?.sellerFirstName,
      buyerName: extras?.buyerName,
      whatsappUrl: extras?.whatsappUrl,
    };
  }
}

export const purchaseRequestService = new PurchaseRequestService();
